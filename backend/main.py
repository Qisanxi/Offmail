"""FastAPI app — Offmail backend.

Security model:
- TrustedHostMiddleware rejects requests with foreign Host headers
  (defends against DNS-rebinding).
- Mutating routes require a per-install X-Offmail-Token header
  (defends against CSRF — simple cross-site POSTs can't set custom headers).
- Backend bound to 127.0.0.1 only (set in Makefile).
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from .auth import get_install_token, require_token
from .classifier import classify, extract_contact_name
from .config import settings
from .db import get_db, init_db
from .imap_client import fetch_recent_social_emails
from .llm import LLMError, check_ollama_health, generate_draft, regenerate_draft
from .models import (
    MAX_SEND_ATTEMPTS,
    Contact,
    Draft,
    DraftStatus,
    Email,
    EmailCategory,
)
from .send_queue import flush_queue_once, queue_loop, retry_failed_drafts

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
    token = get_install_token()
    logger.info("Per-install auth token generated (path: .offmail_token)")
    logger.info("Token: %s...", token[:8])
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

# TrustedHostMiddleware — rejects requests with foreign Host headers
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts + ["*"] if not settings.trusted_hosts else settings.trusted_hosts,
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
    contact_headline: Optional[str] = None  # e.g. "Recruiter at Stripe" — for the inbox row
    destination_label: Optional[str] = None  # e.g. "Sends as a LinkedIn message" / "Copy and paste into LinkedIn"
    safe_to_auto_send: bool = True  # False when reply_to is missing or from an untrusted domain
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
    body: Optional[str] = Field(default=None, min_length=1, max_length=8000)


class RegenerateRequest(BaseModel):
    variant: str = Field(description="One of: shorter, warmer, more_formal, more_casual")
    existing_body: Optional[str] = Field(default=None, max_length=8000)


class HealthResponse(BaseModel):
    gmail_configured: bool
    ollama: dict
    model: str


# ============================================================
# Helpers
# ============================================================

def _latest_draft(email: Email) -> Optional[Draft]:
    """Return the latest draft for an email (sorted by created_at desc)."""
    if not email.drafts:
        return None
    # drafts relationship has order_by created_at.desc() — so [0] is newest
    return email.drafts[0]


def _domain_of(email_address: str) -> str:
    """Return the lowercase domain of an email address, or '' if malformed."""
    if not email_address or "@" not in email_address:
        return ""
    return email_address.split("@", 1)[1].lower().strip()


def _is_linkedin_sender(from_address: str) -> bool:
    domain = _domain_of(from_address)
    return domain == "linkedin.com" or domain.endswith(".linkedin.com")


def _destination_info(email: Email) -> tuple[str, bool]:
    """Compute destination_label + safe_to_auto_send for an email.

    Returns:
      (label, safe)
      - label: human-readable description of where the reply goes
      - safe: True if the reply-to address is on a trusted domain (linkedin.com),
              False if reply-to is missing or from an untrusted domain (copy required)
    """
    reply_to = email.reply_to
    if not reply_to:
        # No reply-to — we'd send to the original From address. For LinkedIn
        # acceptance emails, that's invitations@linkedin.com (a black hole).
        # Tell the user they need to copy-paste into LinkedIn manually.
        if _is_linkedin_sender(email.from_address):
            return ("Copy and paste into LinkedIn", False)
        return (f"Reply to {email.from_address}", True)

    rt_domain = _domain_of(reply_to)
    if rt_domain == "linkedin.com" or rt_domain.endswith(".linkedin.com"):
        return ("Sends as a LinkedIn message", True)
    # Reply-to on an untrusted domain — could be a spoofing attempt.
    # Show a warning; user must explicitly copy.
    return (f"Reply via {rt_domain} — verify before sending", False)


def _email_to_out(email: Email) -> EmailOut:
    """Convert an Email ORM object to an EmailOut response model."""
    draft = _latest_draft(email)
    contact_name = (
        email.contact_name_extracted
        or (email.contact.name if email.contact else None)
        or email.from_name
    )
    contact_headline = email.contact.headline if email.contact else None
    destination_label, safe_to_send = _destination_info(email)
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
        contact_name=contact_name,
        contact_headline=contact_headline,
        destination_label=destination_label,
        safe_to_auto_send=safe_to_send,
        draft_id=draft.id if draft else None,
        draft_body=draft.body if draft else None,
        draft_status=draft.status.value if draft else None,
    )


def _draft_to_out(draft: Draft) -> DraftOut:
    return DraftOut(
        id=draft.id,
        email_id=draft.email_id,
        body=draft.body,
        status=draft.status.value,
        error_message=draft.error_message,
        attempts=draft.attempts or 0,
        created_at=draft.created_at,
        approved_at=draft.approved_at,
        sent_at=draft.sent_at,
    )


# ============================================================
# Routes — read-only, no auth required (CSRF safe)
# ============================================================

@app.get("/api/health")
async def health() -> HealthResponse:
    return HealthResponse(
        gmail_configured=settings.is_configured,
        ollama=await check_ollama_health(),
        model=settings.ollama_model,
    )


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


@app.get("/api/drafts", response_model=list[DraftOut])
def list_drafts(status: Optional[str] = None):
    """List drafts, optionally filtered by status."""
    with get_db() as db:
        stmt = (
            select(Draft)
            .options(selectinload(Draft.email))
            .order_by(Draft.created_at.desc())
            .limit(100)
        )
        if status:
            try:
                st = DraftStatus(status)
                stmt = stmt.where(Draft.status == st)
            except ValueError:
                raise HTTPException(400, f"Invalid status: {status}")
        rows = list(db.scalars(stmt))
        return [_draft_to_out(d) for d in rows]


@app.get("/api/stats")
def stats() -> dict:
    """Single grouped query — much faster than 5 separate COUNTs."""
    with get_db() as db:
        rows = db.execute(
            select(Draft.status, func.count(Draft.id))
            .group_by(Draft.status)
        ).all()
        status_counts = {row[0]: row[1] for row in rows}
        emails = db.scalar(select(func.count(Email.id))) or 0
        return {
            "emails": emails,
            "drafts": sum(status_counts.values()),
            "approved_pending_send": status_counts.get(DraftStatus.APPROVED, 0),
            "sending": status_counts.get(DraftStatus.SENDING, 0),
            "sent": status_counts.get(DraftStatus.SENT, 0),
            "failed": status_counts.get(DraftStatus.FAILED, 0),
            "dead": status_counts.get(DraftStatus.DEAD, 0),
        }


# ============================================================
# Routes — mutating, require X-Offmail-Token header
# ============================================================

@app.post("/api/inbox/refresh", response_model=list[EmailOut])
async def refresh_inbox(_=Depends(require_token)) -> list[EmailOut]:
    """Fetch latest emails from Gmail Social category, classify, store."""
    if not settings.is_configured:
        raise HTTPException(
            400,
            "Gmail not configured. Set GMAIL_ADDRESS + GMAIL_APP_PASSWORD in .env",
        )

    try:
        raws = await asyncio.to_thread(fetch_recent_social_emails)
    except Exception as e:
        logger.exception("IMAP fetch failed")
        raise HTTPException(502, f"IMAP fetch failed: {e}")

    saved = []
    with get_db() as db:
        # Batch dedup: get all existing message_ids in one query
        msg_ids = [r.message_id for r in raws]
        existing_ids = set()
        if msg_ids:
            existing_ids = {
                row[0]
                for row in db.execute(
                    select(Email.message_id).where(Email.message_id.in_(msg_ids))
                ).all()
            }

        for raw in raws:
            if raw.message_id in existing_ids:
                continue

            category = classify(raw)
            name = extract_contact_name(raw)

            # Find or create contact (keyed by from_address — but note for
            # LinkedIn, all emails share the same sender; the per-email
            # name lives on Email.contact_name_extracted instead)
            contact = db.scalar(select(Contact).where(Contact.email == raw.from_address))
            if not contact:
                contact = Contact(email=raw.from_address, name=name)
                db.add(contact)
                db.flush()

            email_row = Email(
                message_id=raw.message_id,
                from_address=raw.from_address,
                from_name=raw.from_name or name,
                reply_to=raw.reply_to,
                subject=raw.subject,
                body_snippet=(raw.body_text or "")[:500],
                body_full=raw.body_text,
                category=category,
                received_at=raw.received_at,
                contact_id=contact.id,
                contact_name_extracted=name,
            )
            db.add(email_row)
            saved.append(email_row)

        # Single commit per refresh — much faster than per-row
        db.commit()

        # Refresh + eager-load for serialization
        for email_row in saved:
            db.refresh(email_row)
            db.scalar(
                select(Email)
                .options(selectinload(Email.drafts), selectinload(Email.contact))
                .where(Email.id == email_row.id)
            )

    logger.info("Refreshed inbox: %d new emails", len(saved))
    return [_email_to_out(e) for e in saved]


@app.post("/api/emails/{email_id}/draft", response_model=DraftOut)
async def generate_draft_for_email(
    email_id: str,
    _=Depends(require_token),
) -> DraftOut:
    """Generate a new LLM draft for an email.

    Always creates a fresh draft. If a non-rejected draft already exists,
    returns it instead of generating a new one (prevents double-click
    duplicate drafts).
    """
    # Load email WITHOUT holding DB session across the LLM call
    with get_db() as db:
        email = db.scalar(
            select(Email)
            .options(selectinload(Email.drafts), selectinload(Email.contact))
            .where(Email.id == email_id)
        )
        if not email:
            raise HTTPException(404, "Email not found")

        # If there's an existing non-rejected draft, return it
        for d in email.drafts:
            if d.status != DraftStatus.REJECTED:
                return _draft_to_out(d)

        # Pull the fields we need for the LLM call, then close the session
        category_value = email.category.value if email.category else "needs_reply"
        contact_name = (
            email.contact_name_extracted
            or (email.contact.name if email.contact else None)
            or email.from_name
        )
        from_address = email.from_address
        subject = email.subject or ""
        body = email.body_full or ""
        email_id_str = email.id

    # LLM call — outside DB session so we don't hold it open for 120s
    try:
        draft_body = await generate_draft(
            category=category_value,
            contact_name=contact_name,
            from_address=from_address,
            subject=subject,
            body=body,
        )
    except LLMError as e:
        raise HTTPException(502, str(e))

    # Open fresh session to persist the new draft
    with get_db() as db:
        draft = Draft(
            email_id=email_id_str,
            body=draft_body,
            status=DraftStatus.PENDING,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return _draft_to_out(draft)


@app.post("/api/drafts/{draft_id}/approve", response_model=DraftOut)
def approve_draft(
    draft_id: str,
    req: DraftApproveRequest,
    _=Depends(require_token),
) -> DraftOut:
    """Approve a draft for sending. Optionally override the body.

    State transitions allowed: PENDING → APPROVED, FAILED → APPROVED.
    SENT / REJECTED / DEAD drafts cannot be re-approved.
    """
    with get_db() as db:
        draft = db.scalar(select(Draft).where(Draft.id == draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found")

        allowed_from = {DraftStatus.PENDING, DraftStatus.FAILED}
        if draft.status not in allowed_from:
            raise HTTPException(
                409,
                f"Cannot approve draft in status '{draft.status.value}'. "
                f"Allowed: pending, failed.",
            )

        if req.body is not None:
            draft.body = req.body
        draft.status = DraftStatus.APPROVED
        draft.approved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(draft)
        return _draft_to_out(draft)


@app.post("/api/drafts/{draft_id}/reject", response_model=DraftOut)
def reject_draft(
    draft_id: str,
    _=Depends(require_token),
) -> DraftOut:
    """Reject a draft — user doesn't want to reply."""
    with get_db() as db:
        draft = db.scalar(select(Draft).where(Draft.id == draft_id))
        if not draft:
            raise HTTPException(404, "Draft not found")
        # Reject is allowed from any non-terminal state
        if draft.status in {DraftStatus.SENT, DraftStatus.SENDING}:
            raise HTTPException(
                409,
                f"Cannot reject draft in status '{draft.status.value}'.",
            )
        draft.status = DraftStatus.REJECTED
        db.commit()
        db.refresh(draft)
        return _draft_to_out(draft)


@app.post("/api/emails/{email_id}/regenerate", response_model=DraftOut)
async def regenerate_email_draft(
    email_id: str,
    req: RegenerateRequest,
    _=Depends(require_token),
) -> DraftOut:
    """Regenerate a draft with a different variant (shorter, warmer, etc.).

    Creates a NEW draft row for the email (preserves history of variants).
    The new draft is in PENDING status — user reviews + approves as usual.
    """
    # Load email fields without holding session across LLM call
    with get_db() as db:
        email = db.scalar(
            select(Email)
            .options(selectinload(Email.drafts), selectinload(Email.contact))
            .where(Email.id == email_id)
        )
        if not email:
            raise HTTPException(404, "Email not found")

        # Use existing body if provided, else latest draft's body
        existing_body = req.existing_body
        if not existing_body:
            latest = _latest_draft(email)
            existing_body = latest.body if latest else ""
        if not existing_body:
            raise HTTPException(400, "No existing draft to regenerate from. Generate a draft first.")

        contact_name = (
            email.contact_name_extracted
            or (email.contact.name if email.contact else None)
            or email.from_name
        )
        subject = email.subject or ""
        email_id_str = email.id

    # LLM call — outside DB session
    try:
        new_body = await regenerate_draft(
            variant=req.variant,
            existing_body=existing_body,
            contact_name=contact_name,
            subject=subject,
        )
    except LLMError as e:
        raise HTTPException(502, str(e))

    # Persist new draft
    with get_db() as db:
        draft = Draft(
            email_id=email_id_str,
            body=new_body,
            status=DraftStatus.PENDING,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return _draft_to_out(draft)


@app.post("/api/queue/flush")
async def manual_flush(_=Depends(require_token)) -> dict:
    """Manually trigger one queue pass."""
    return await flush_queue_once()


@app.post("/api/queue/retry-failed")
def retry_failed(_=Depends(require_token)) -> dict:
    """Reset FAILED (non-DEAD) drafts back to APPROVED for immediate retry."""
    count = retry_failed_drafts()
    return {"reset_count": count, "max_attempts": MAX_SEND_ATTEMPTS}


@app.get("/api/token")
def show_token() -> dict:
    """Convenience endpoint for local dev — returns the install token.

    Only useful when running locally. Combined with TrustedHostMiddleware
    this is safe (foreign hosts can't reach it).
    """
    return {"token": get_install_token()}


@app.get("/")
def root() -> dict:
    return {
        "name": "Offmail",
        "version": "0.1.0",
        "tagline": "Local-first email triage for job seekers. Built for Arpit.",
        "docs": "/docs",
        "github": "https://github.com/Qisanxi/Offmail",
    }
