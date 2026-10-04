"""Gmail IMAP client — fetches Social tab emails."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from imap_tools import AND, MailBox

from .config import settings


@dataclass
class RawEmail:
    message_id: str
    from_address: str
    from_name: Optional[str]
    reply_to: Optional[str]
    subject: str
    body_text: str
    received_at: datetime


def _decode_header_value(raw: Optional[str]) -> str:
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def _extract_body(msg: MailMessage) -> str:
    """Prefer plain text; fall back to HTML stripped."""
    if msg.text:
        return msg.text[:5000]
    if msg.html:
        # very rough HTML strip — good enough for LLM context
        import re
        text = re.sub(r"<[^>]+>", " ", msg.html)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:5000]
    return ""


def _get_social_folder(mailbox: MailBox) -> str:
    """Find the Gmail Social folder. Gmail exposes it as '[Gmail]/Social Promotions' or similar."""
    # Common Gmail folder names
    candidates = [
        '"[Gmail]/Social Promotions"',
        '"[Gmail]/Promotions"',
        "Social",
        "INBOX",  # fall back to inbox if Social not found
    ]
    folders = mailbox.folder.list()
    folder_names = [f.name for f in folders]
    for candidate in candidates:
        if candidate in folder_names:
            return candidate
    # try substring match
    for name in folder_names:
        if "social" in name.lower():
            return name
    return "INBOX"


def fetch_recent_social_emails() -> List[RawEmail]:
    """Fetch emails from the Social folder within the fetch window."""
    if not settings.is_configured:
        raise RuntimeError("Gmail credentials not configured. Check .env file.")

    window = datetime.now(timezone.utc) - timedelta(days=settings.fetch_window_days)
    results: List[RawEmail] = []

    with MailBox(settings.imap_host).login(
        settings.gmail_address, settings.gmail_app_password
    ) as mailbox:
        folder = _get_social_folder(mailbox)
        mailbox.folder.set(folder)

        for msg in mailbox.fetch(
            AND(date_gte=window.date()),
            limit=50,
            reverse=True,
            mark_seen=False,
        ):
            # Reply-to: imap_tools exposes it on msg.headers dict
            reply_to = None
            if msg.headers:
                rt_list = msg.headers.get("reply-to") or msg.headers.get("Reply-To")
                if rt_list:
                    reply_to = _decode_header_value(rt_list[0])

            # From: imap_tools exposes msg.from_values as list of Address(name, email)
            from_name = None
            if getattr(msg, "from_values", None):
                from_name = _decode_header_value(msg.from_values[0].name) if msg.from_values[0].name else None

            results.append(
                RawEmail(
                    message_id=msg.id or msg.uid,
                    from_address=msg.from_ or "",
                    from_name=from_name,
                    reply_to=reply_to,
                    subject=_decode_header_value(msg.subject),
                    body_text=_extract_body(msg),
                    received_at=msg.date or datetime.now(timezone.utc),
                )
            )

    return results
