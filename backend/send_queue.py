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
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import MAX_SEND_ATTEMPTS, Draft, DraftStatus, Email
from .smtp_sender import send_email_async

logger = logging.getLogger(__name__)

# Module-level lock to serialize flush attempts (prevents loop + manual race).
_flush_lock = asyncio.Lock()


def _backoff_seconds(attempts: int) -> int:
    """Exponential backoff: 60s, 120s, 240s, 480s, ..."""
    base = settings.queue_retry_seconds
    return base * (2 ** max(0, attempts - 1))


def get_sendable_drafts(db: Session, limit: int = 10) -> list[Draft]:
    """Return drafts eligible for sending: APPROVED + FAILED-with-backoff-elapsed.

    We don't include SENDING here (those are in-flight). We DO include
    FAILED drafts whose backoff window has elapsed, so they auto-retry.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Draft)
        .where(
            (Draft.status == DraftStatus.APPROVED)
            | (
                (Draft.status == DraftStatus.FAILED)
                & (Draft.attempts < MAX_SEND_ATTEMPTS)
                & (
                    (Draft.last_attempt_at.is_(None))
                    | (Draft.last_attempt_at <= now - timedelta(seconds=1))
                )
            )
        )
        .order_by(Draft.approved_at.asc().nulls_last(), Draft.created_at.asc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


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

    # Determine recipient: prefer reply_to (LinkedIn routing), fall back to from_address
    reply_to = email.reply_to
    to_address = reply_to or email.from_address
    if not to_address:
        return False, "No recipient address (no reply_to and no from_address)."

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
            from sqlalchemy import func
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


def retry_failed_drafts() -> int:
    """Reset FAILED (non-DEAD) drafts back to APPROVED for immediate retry.

    DEAD drafts are NOT touched (user must explicitly want them retried).
    """
    with get_db() as db:
        result = db.execute(
            update(Draft)
            .where(Draft.status == DraftStatus.FAILED)
            .values(
                status=DraftStatus.APPROVED,
                last_attempt_at=datetime.now(timezone.utc) - timedelta(seconds=3600),
            )
        )
        db.commit()
        return result.rowcount or 0
