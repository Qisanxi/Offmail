"""Offline draft queue — auto-sends approved drafts, retries on failure."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Draft, DraftStatus, Email
from .smtp_sender import send_email_async
from .config import settings

logger = logging.getLogger(__name__)


def get_pending_sendable_drafts(db: Session, limit: int = 10) -> list[Draft]:
    """Return approved-but-unsent drafts, oldest first."""
    stmt = (
        select(Draft)
        .where(Draft.status == DraftStatus.APPROVED)
        .order_by(Draft.approved_at.asc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


async def try_send_draft(draft: Draft, db: Session) -> tuple[bool, Optional[str]]:
    """Attempt to send one draft. Returns (success, error_message)."""
    email = draft.email
    if not email:
        return False, "No linked email for this draft."

    to_address = email.reply_to or email.from_address
    if not to_address:
        return False, "No recipient address (no reply_to and no from_address)."

    try:
        await send_email_async(
            to_address=to_address,
            subject=email.subject or "(no subject)",
            body=draft.body,
            reply_to=email.reply_to,
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
    draft.status = DraftStatus.FAILED
    draft.error_message = error
    draft.attempts = (draft.attempts or 0) + 1
    draft.last_attempt_at = datetime.now(timezone.utc)
    db.commit()


async def flush_queue_once() -> dict:
    """One pass over the queue. Send what we can. Returns a summary dict."""
    sent, failed = 0, 0
    with get_db() as db:
        drafts = get_pending_sendable_drafts(db, limit=10)
        for draft in drafts:
            ok, err = await try_send_draft(draft, db)
            if ok:
                mark_sent(draft, db)
                sent += 1
                logger.info("Sent draft %s", draft.id)
            else:
                mark_failed(draft, err or "unknown error", db)
                failed += 1
                logger.warning("Failed draft %s: %s", draft.id, err)
    return {"sent": sent, "failed": failed, "queue_remaining": 0}


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
    """Reset FAILED drafts back to APPROVED for the next queue pass.
    Called manually via API endpoint /retry-failed.
    """
    with get_db() as db:
        stmt = select(Draft).where(Draft.status == DraftStatus.FAILED)
        drafts = list(db.scalars(stmt))
        count = 0
        for d in drafts:
            d.status = DraftStatus.APPROVED
            count += 1
        db.commit()
        return count
