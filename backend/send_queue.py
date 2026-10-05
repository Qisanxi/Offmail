"""Background sender queue — auto-sends approved drafts with retry + backoff.

Key design choices:
- Atomic claim: before sending, atomically UPDATE status from APPROVED →
  SENDING (or FAILED → SENDING) WHERE current status matches. This
  prevents double-send when the background loop and a manual flush race.
- Auto-retry: FAILED drafts are retried automatically (with exponential
  backoff based on attempt count). After MAX_ATTEMPTS, they move to DEAD.
- asyncio.Lock: serializes flush attempts so manual /api/queue/flush
  doesn't race with the background loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import MAX_SEND_ATTEMPTS, Draft, DraftStatus, Email, EmailCategory
from .smtp_sender import send_email_async

logger = logging.getLogger(__name__)

# Module-level lock to serialize flush attempts (prevents loop + manual race).
_flush_lock = asyncio.Lock()


def _backoff_seconds(attempts: int) -> int:
    """Exponential backoff: 60s, 120s, 240s, 480s, ..."""
    base = settings.queue_retry_seconds
    return base * (2 ** max(0, attempts - 1))


def _as_utc(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; everything we store is UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def is_retry_due(draft: Draft, now: datetime | None = None) -> bool:
    """True if a FAILED draft's exponential backoff window has elapsed."""
    now = now or datetime.now(timezone.utc)
    last = _as_utc(draft.last_attempt_at)
    if last is None:
        return True
    return now >= last + timedelta(seconds=_backoff_seconds(draft.attempts or 1))


def get_sendable_drafts(db: Session, limit: int = 10) -> list[Draft]:
    """Return drafts eligible for sending: APPROVED + FAILED whose backoff elapsed.

    SENDING drafts are in-flight and never returned here.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Draft)
        .where(
            (Draft.status == DraftStatus.APPROVED)
            | ((Draft.status == DraftStatus.FAILED) & (Draft.attempts < MAX_SEND_ATTEMPTS))
        )
        .order_by(Draft.approved_at.asc().nulls_last(), Draft.created_at.asc())
        .limit(limit * 5)
    )
    due = [
        d for d in db.scalars(stmt)
        if d.status == DraftStatus.APPROVED or is_retry_due(d, now)
    ]
    return due[:limit]


def recover_interrupted_sends() -> int:
    """Called at startup: any draft still SENDING belongs to a dead process.

    The SMTP call may or may not have completed, so we do NOT auto-retry
    (that could double-send). They go to DEAD with an explanatory message so
    the user can check their Sent folder and retry manually.
    """
    with get_db() as db:
        result = db.execute(
            update(Draft)
            .where(Draft.status == DraftStatus.SENDING)
            .values(
                status=DraftStatus.DEAD,
                error_message=(
                    "Interrupted while sending. Check your Gmail Sent folder "
                    "before retrying — it may already have gone out."
                ),
            )
        )
        db.commit()
        return result.rowcount or 0


def claim_draft(db: Session, draft_id: str) -> bool:
    """Atomically transition a draft to SENDING. Returns True if claimed.

    Uses UPDATE ... WHERE status IN (approved, failed) so concurrent
    callers can't both claim the same draft.
    """
    now = datetime.now(timezone.utc)
    result = db.execute(
        update(Draft)
        .where(
            Draft.id == draft_id,
            Draft.status.in_([DraftStatus.APPROVED, DraftStatus.FAILED]),
        )
        .values(status=DraftStatus.SENDING, last_attempt_at=now)
    )
    db.commit()
    return result.rowcount > 0


def _is_linkedin_domain(address: str | None) -> bool:
    addr = parseaddr(address or "")[1].lower()
    domain = addr.rsplit("@", 1)[-1] if "@" in addr else ""
    return domain == "linkedin.com" or domain.endswith(".linkedin.com")


def resolve_recipient(email: Email) -> tuple[str | None, str | None, str | None]:
    """Decide where a reply goes. Returns (to_address, reply_to, error).

    Reply-To is attacker-controlled, so it is only honoured for genuine
    LinkedIn acceptance mail whose Reply-To is itself a linkedin.com address.
    Anything else is replied to the From address (or refused).
    """
    if email.category == EmailCategory.LINKEDIN_ACCEPTED:
        reply_to = parseaddr(email.reply_to or "")[1]
        if reply_to and _is_linkedin_domain(reply_to):
            return reply_to, reply_to, None
        return None, None, (
            "This LinkedIn email has no valid linkedin.com Reply-To address, so it "
            "can't be routed as a DM. Copy the draft into LinkedIn instead."
        )
    to_address = parseaddr(email.from_address or "")[1]
    if not to_address:
        return None, None, "No recipient address on this email."
    return to_address, None, None


async def try_send_draft(draft: Draft, db: Session) -> tuple[bool, Optional[str]]:
    """Attempt to send one draft. Returns (success, error_message).

    NOTE: caller must have already claimed the draft (status=SENDING).
    """
    # Re-fetch email fresh (draft.email may be stale)
    email = db.scalar(
        select(Email).where(Email.id == draft.email_id)
    )
    if not email:
        return False, "No linked email for this draft."

    to_address, reply_to, problem = resolve_recipient(email)
    if problem:
        return False, problem

    try:
        await send_email_async(
            to_address=to_address,
            subject=email.subject or "(no subject)",
            body=draft.body,
            reply_to=reply_to,
            in_reply_to=email.message_id,
            references=email.message_id,
        )
        return True, None
    except Exception as e:
        return False, str(e)


def mark_sent(draft: Draft, db: Session) -> None:
    draft.status = DraftStatus.SENT
    draft.sent_at = datetime.now(timezone.utc)
    db.commit()


def mark_failed(draft: Draft, error: str, db: Session) -> None:
    """Mark a draft as failed, with backoff-aware retry scheduling.

    If attempts >= MAX_SEND_ATTEMPTS, transition to DEAD.
    Otherwise, set status=FAILED so the next backoff window will pick it up.
    """
    new_attempts = (draft.attempts or 0) + 1
    draft.error_message = (error or "unknown error")[:1000]
    draft.attempts = new_attempts
    draft.last_attempt_at = datetime.now(timezone.utc)
    if new_attempts >= MAX_SEND_ATTEMPTS:
        draft.status = DraftStatus.DEAD
        logger.warning(
            "Draft %s moved to DEAD after %d failed attempts",
            draft.id, new_attempts,
        )
    else:
        draft.status = DraftStatus.FAILED
    db.commit()


async def flush_queue_once() -> dict:
    """One pass over the queue. Send what we can. Returns a summary dict.

    Serialized by an asyncio.Lock so the background loop and manual
    /api/queue/flush can't race.
    """
    async with _flush_lock:
        sent, failed, claimed = 0, 0, 0
        with get_db() as db:
            drafts = get_sendable_drafts(db, limit=10)
            for draft in drafts:
                if not claim_draft(db, draft.id):
                    continue  # someone else got it
                claimed += 1
                db.refresh(draft)  # ensure status reflects SENDING
                ok, err = await try_send_draft(draft, db)
                if ok:
                    mark_sent(draft, db)
                    sent += 1
                    logger.info("Sent draft %s", draft.id)
                else:
                    mark_failed(draft, err or "unknown error", db)
                    failed += 1
                    logger.warning("Failed draft %s: %s", draft.id, err)
        # Count remaining queued (approved + failed-non-dead)
        with get_db() as db:
            remaining = db.scalar(
                select(func.count(Draft.id)).where(
                    Draft.status.in_([DraftStatus.APPROVED, DraftStatus.FAILED])
                )
            ) or 0
        return {
            "sent": sent,
            "failed": failed,
            "claimed": claimed,
            "queue_remaining": remaining,
        }


async def queue_loop() -> None:
    """Background task: every N seconds, flush the queue once."""
    logger.info("Queue loop started (interval=%ss)", settings.queue_retry_seconds)
    while True:
        try:
            summary = await flush_queue_once()
            if summary["sent"] or summary["failed"]:
                logger.info("Queue: %s", summary)
        except Exception as e:
            logger.exception("Queue loop error: %s", e)
        await asyncio.sleep(settings.queue_retry_seconds)


def retry_failed_drafts(include_dead: bool = False) -> int:
    """Reset FAILED drafts back to APPROVED for immediate retry.

    DEAD drafts (retries exhausted, or interrupted mid-send) are only touched
    when include_dead=True, which also resets their attempt counter. Check
    your Sent folder first — an interrupted draft may already have gone out.
    """
    statuses = [DraftStatus.FAILED] + ([DraftStatus.DEAD] if include_dead else [])
    with get_db() as db:
        values = {
            "status": DraftStatus.APPROVED,
            "last_attempt_at": datetime.now(timezone.utc) - timedelta(seconds=3600),
        }
        if include_dead:
            values["attempts"] = 0
            values["error_message"] = None
        result = db.execute(
            update(Draft).where(Draft.status.in_(statuses)).values(**values)
        )
        db.commit()
        return result.rowcount or 0
