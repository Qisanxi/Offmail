"""FastAPI app — Offmail backend."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from .classifier import classify, extract_contact_name
from .config import settings
from .db import get_db, init_db
from .imap_client import RawEmail, fetch_recent_social_emails
from .llm import check_ollama_health, generate_draft
from .models import Contact, Draft, DraftStatus, Email, EmailCategory
from .queue import flush_queue_once, queue_loop, retry_failed_drafts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("offmail")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start background queue."""
    init_db()
    logger.info("DB initialized at %s", settings.database_url)
    queue_task = asyncio.create_task(queue_loop())
    logger.info("Background queue task started")
    try:
        yield
    finally:
        queue_task.cancel()
        try:
            await queue_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Offmail",
    description="Local-first email triage for job seekers — built for Arpit.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Schemas
# ============================================================

class EmailOut(BaseModel):
    id: str
    message_id: str
    from_address: str
    from_name: Optional[str]
    reply_to: Optional[str]
    subject: Optional[str]
    body_snippet: Optional[str]
    category: str
    received_at: datetime
    contact_name: Optional[str] = None
    draft_id: Optional[str] = None
    draft_body: Optional[str] = None
    draft_status: Optional[str] = None


class DraftOut(BaseModel):
    id: str
    email_id: str
    body: str
    status: str
    error_message: Optional[str]
    attempts: int
    created_at: datetime
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]


class DraftApproveRequest(BaseModel):
    body: Optional[str] = None  # if provided, override the LLM draft


class HealthResponse(BaseModel):
    gmail_configured: bool
    ollama: dict
    db_url: str
    model: str


# ============================================================
# Helpers
# ============================================================

def _email_to_out(email: Email) -> EmailOut:
    draft = email.drafts[0] if email.drafts else None
    return EmailOut(
        id=email.id,
        message_id=email.message_id,
        from_address=email.from_address,
        from_name=email.from_name,
        reply_to=email.reply_to,
        subject=email.subject,
        body_snippet=email.body_snippet,
        category=email.category.value if email.category else "unknown",
        received_at=email.received_at or datetime.now(timezone.utc),
        contact_name=email.contact.name if email.contact else None,
        draft_id=draft.id if draft else None,
        draft_body=draft.body if draft else None,
        draft_status=draft.status.value if draft else None,
    )


# ============================================================
# Routes
# ============================================================

@app.get("/api/health")
async def health() -> HealthResponse:
    return HealthResponse(
        gmail_configured=settings.is_configured,
        ollama=await check_ollama_health(),
        db_url=settings.database_url,
        model=settings.ollama_model,
    )


@app.post("/api/inbox/refresh", response_model=list[EmailOut])
async def refresh_inbox() -> list[EmailOut]:
    """Fetch latest emails from Gmail Social tab, classify, store, return."""
    if not settings.is_configured:
        raise HTTPException(400, "Gmail not configured. Set GMAIL_ADDRESS + GMAIL_APP_PASSWORD in .env")

    try:
        raws = await asyncio.to_thread(fetch_recent_social_emails)
    except Exception as e:
        logger.exception("IMAP fetch failed")
        raise HTTPException(502, f"IMAP fetch failed: {e}")

    saved = []
    with get_db() as db:
        for raw in raws:
            # Skip if we already have this message_id
            existing = db.scalar(
                select(Email).where(Email.message_id == raw.message_id)
            )
            if existing:
                saved.append(_email_to_out(existing))
                continue

            category = classify(raw)
            name = extract_contact_name(raw)

            # Find or create contact
            contact = db.scalar(select(Contact).where(Contact.email == raw.from_address))
            if not contact:
                contact = Contact(
                    email=raw.from_address,
                    name=name,
                )
                db.add(contact)
                db.flush()
            elif name and not contact.name:
                contact.name = name

            email_row = Email(
                message_id=raw.message_id,
                from_address=raw.from_address,
                from_name=raw.from_name or name,
                reply_to=raw.reply_to,
                subject=raw.subject,
                body_snippet=raw.body_text[:500],
                body_full=raw.body_text,
                category=category,
                received_at=raw.received_at,
                contact_id=contact.id,
            )
            db.add(email_row)
            db.commit()
            db.refresh(email_row)
            saved.append(_email_to_out(email_row))

    logger.info("Refreshed inbox: %d emails", len(saved))
    return saved


@app.get("/api/emails", response_model=list[EmailOut])
def list_emails(category: Optional[str] = None, limit: int = 50):
    """List stored emails, optionally filtered by category."""
    with get_db() as db:
        stmt = (
            select(Email)
            .options(selectinload(Email.drafts), selectinload(Email.contact))
            .order_by(Email.received_at.desc())
            .limit(limit)
        )
        if category:
            try:
                cat = EmailCategory(category)
                stmt = stmt.where(Email.category == cat)
            except ValueError:
                raise HTTPException(400, f"Invalid category: {category}")
        rows = list(db.scalars(stmt))
        return [_email_to_out(e) for e in rows]


@app.post("/api/emails/{email_id}/draft", response_model=DraftOut)
async def generate_draft_for_email(email_id: str) -> DraftOut:
    """Generate (or return existing) LLM draft for a given email."""
    with get_db() as db:
        email = db.scalar(
            select(Email)
            .options(selectinload(Email.drafts))
            .where(Email.id == email_id)
        )
        if not email:
            raise HTTPException(404, "Email not found")

        # If there's an existing non-rejected draft, return it
        existing_draft = next(
            (d for d in email.drafts if d.status != DraftStatus.REJECTED),
            None,
        )
        if existing_draft:
            return DraftOut(
                id=existing_draft.id,
                email_id=existing_draft.email_id,
                body=existing_draft.body,
                status=existing_draft.status.value,
                error_message=existing_draft.error_message,
                attempts=existing_draft.attempts or 0,
                created_at=existing_draft.created_at,
                approved_at=existing_draft.approved_at,
                sent_at=existing_draft.sent_at,
            )

        # Generate new draft
        try:
            body = await generate_draft(
                category=email.category.value if email.category else "needs_reply",
                contact_name=email.contact.name if email.contact else None,
                from_address=email.from_address,
                subject=email.subject or "",
                body=email.body_full or "",
            )
        except RuntimeError as e:
            raise HTTPException(502, str(e))

        draft = Draft(
            email_id=email.id,
            body=body,
            status=DraftStatus.PENDING,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return DraftOut(
            id=draft.id,
            email_id=draft.email_id,
            body=draft.body,
            status=draft.status.value,
            error_message=None,
            attempts=0,
            created_at=draft.created_at,
            approved_at=None,
            sent_at=None,
        )


@app.post("/api/drafts/{draft_id}/approve", response_model=DraftOut)
def approve_draft(draft_id: str, req: DraftApproveRequest) -> DraftOut:
    """Approve a draft for sending. Optionally override the body."""
    with get_db() as db:
        draft = db.scalar(select(Draft).where(Draft.id == draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found")

        if req.body is not None:
            draft.body = req.body
        draft.status = DraftStatus.APPROVED
        draft.approved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(draft)
        return DraftOut(
            id=draft.id,
            email_id=draft.email_id,
            body=draft.body,
            status=draft.status.value,
            error_message=None,
            attempts=draft.attempts or 0,
            created_at=draft.created_at,
            approved_at=draft.approved_at,
            sent_at=None,
        )


@app.post("/api/drafts/{draft_id}/reject", response_model=DraftOut)
def reject_draft(draft_id: str) -> DraftOut:
    """Reject a draft — user doesn't want to reply."""
    with get_db() as db:
        draft = db.scalar(select(Draft).where(Draft.id == draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found")
        draft.status = DraftStatus.REJECTED
        db.commit()
        db.refresh(draft)
        return DraftOut(
            id=draft.id,
            email_id=draft.email_id,
            body=draft.body,
            status=draft.status.value,
            error_message=None,
            attempts=draft.attempts or 0,
            created_at=draft.created_at,
            approved_at=None,
            sent_at=None,
        )


@app.post("/api/queue/flush")
async def manual_flush() -> dict:
    """Manually trigger one queue pass (useful after going back online)."""
    return await flush_queue_once()


@app.post("/api/queue/retry-failed")
def retry_failed() -> dict:
    """Reset all FAILED drafts back to APPROVED."""
    count = retry_failed_drafts()
    return {"reset_count": count}


@app.get("/api/drafts", response_model=list[DraftOut])
def list_drafts(status: Optional[str] = None):
    """List drafts, optionally filtered by status."""
    with get_db() as db:
        stmt = select(Draft).order_by(Draft.created_at.desc()).limit(100)
        if status:
            try:
                st = DraftStatus(status)
                stmt = stmt.where(Draft.status == st)
            except ValueError:
                raise HTTPException(400, f"Invalid status: {status}")
        rows = list(db.scalars(stmt))
        return [
            DraftOut(
                id=d.id,
                email_id=d.email_id,
                body=d.body,
                status=d.status.value,
                error_message=d.error_message,
                attempts=d.attempts or 0,
                created_at=d.created_at,
                approved_at=d.approved_at,
                sent_at=d.sent_at,
            )
            for d in rows
        ]


@app.get("/api/stats")
def stats() -> dict:
    with get_db() as db:
        emails = db.scalar(select(func.count(Email.id)))
        drafts = db.scalar(select(func.count(Draft.id)))
        approved = db.scalar(select(func.count(Draft.id)).where(Draft.status == DraftStatus.APPROVED))
        sent = db.scalar(select(func.count(Draft.id)).where(Draft.status == DraftStatus.SENT))
        failed = db.scalar(select(func.count(Draft.id)).where(Draft.status == DraftStatus.FAILED))
        return {
            "emails": emails,
            "drafts": drafts,
            "approved_pending_send": approved,
            "sent": sent,
            "failed": failed,
        }


@app.get("/")
def root() -> dict:
    return {
        "name": "Offmail",
        "version": "0.1.0",
        "tagline": "Local-first email triage for job seekers. Built for Arpit.",
        "docs": "/docs",
        "github": "https://github.com/Qisanxi/Offmail",
    }
