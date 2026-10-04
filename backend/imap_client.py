"""Gmail IMAP client — fetches Social tab emails via X-GM-RAW search."""
from __future__ import annotations

import hashlib
import html as html_lib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr
from typing import Optional

from imap_tools import AND, MailBox

from .config import settings


@dataclass
class RawEmail:
    message_id: str          # RFC822 Message-ID header value (dedup key)
    uid: str                 # IMAP UID (informational only — unstable across folders)
    from_address: str
    from_name: Optional[str]
    reply_to: Optional[str]   # parsed address (just the email part)
    subject: str
    body_text: str
    received_at: datetime    # always timezone-aware UTC


def _decode_header_value(raw: Optional[str]) -> str:
    """Decode an RFC2047-encoded header value like =?UTF-8?B?...?= into a str."""
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        # Last-resort: return as-is rather than silently swallowing
        return str(raw)


def _strip_html(html: str) -> str:
    """Convert HTML to plain text. Removes scripts/styles, then tags, then entities."""
    # Remove script/style blocks entirely
    text = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", html, flags=re.IGNORECASE)
    # Drop remaining tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Decode HTML entities (&amp; &nbsp; etc.)
    text = html_lib.unescape(text)
    return text


def _extract_body(msg) -> str:
    """Prefer plain text; fall back to HTML stripped of tags."""
    if getattr(msg, "text", None):
        return msg.text[:5000]
    if getattr(msg, "html", None):
        return _strip_html(msg.html)[:5000]
    return ""


def _stable_message_id(msg) -> str:
    """Return a stable identifier for deduplication.

    imap_tools does not expose a MailMessage.id attribute; we use the
    Message-ID header. If missing (rare), we fall back to a hash of
    from+subject+date so duplicates are still caught.
    """
    headers = getattr(msg, "headers", {}) or {}
    msg_id_raw = (headers.get("message-id") or headers.get("Message-ID") or [None])[0]
    if msg_id_raw:
        # Strip angle brackets, trim whitespace
        return msg_id_raw.strip().strip("<>").strip()
    # Fallback: stable hash
    from_addr = (headers.get("from") or [""])[0] if headers else ""
    subject = (headers.get("subject") or [""])[0] if headers else ""
    date = (headers.get("date") or [""])[0] if headers else ""
    h = hashlib.sha256(f"{from_addr}|{subject}|{date}".encode()).hexdigest()
    return f"generated-{h[:16]}"


def _get_received_date(msg) -> datetime:
    """Return a timezone-aware UTC datetime for the message date.

    msg.date is sometimes naive or a sentinel (1900-01-01). Normalize.
    """
    d = getattr(msg, "date", None)
    if d is None:
        return datetime.now(timezone.utc)
    # If naive, assume UTC
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    # Treat 1900-01-01 sentinel as "now"
    if d.year < 1970:
        return datetime.now(timezone.utc)
    return d.astimezone(timezone.utc)


def fetch_recent_social_emails() -> list[RawEmail]:
    """Fetch emails from Gmail's Social category via X-GM-RAW search.

    Gmail doesn't expose Social/Promotions as IMAP folders — they are
    labels applied by Gmail's classifier. We use Gmail's X-GM-RAW
    extension to search within INBOX using the 'category:social' query.
    """
    if not settings.is_configured:
        raise RuntimeError("Gmail credentials not configured. Check .env file.")

    window = datetime.now(timezone.utc) - timedelta(days=settings.fetch_window_days)
    results: list[RawEmail] = []

    with MailBox(settings.imap_host).login(
        settings.gmail_address, settings.gmail_app_password
    ) as mailbox:
        mailbox.folder.set("INBOX")

        # Gmail X-GM-RAW search for the Social category, within the date window.
        # imap_tools supports raw search criteria via a string starting with '('
        # but the cleanest path is to pass the X-GM-RAW literal.
        # We combine with AND(date_gte=...) for the window.
        criteria = AND(date_gte=window.date())
        # imap_tools lets us inject raw criteria via the `header` arg or by
        # passing a raw string. We use Gmail's X-GM-RAW extension explicitly:
        gm_raw = 'X-GM-RAW "category:social"'

        for msg in mailbox.fetch(
            criteria=[criteria, gm_raw],
            limit=50,
            reverse=True,
            mark_seen=False,
            bulk=True,  # fetch in bulk — much faster for 50 messages
        ):
            headers = msg.headers or {}

            # Reply-To: parse with parseaddr so "Name <addr>" is handled
            reply_to_raw = (headers.get("reply-to") or headers.get("Reply-To") or [None])[0]
            reply_to = None
            if reply_to_raw:
                reply_to_decoded = _decode_header_value(reply_to_raw)
                reply_to = parseaddr(reply_to_decoded)[1] or None

            # From: imap_tools exposes msg.from_values (list of Address(name,email))
            from_name = None
            from_values = getattr(msg, "from_values", None)
            if from_values:
                name_raw = getattr(from_values[0], "name", None) if from_values[0] else None
                if name_raw:
                    from_name = _decode_header_value(name_raw)

            from_address = getattr(msg, "from_", "") or ""

            results.append(
                RawEmail(
                    message_id=_stable_message_id(msg),
                    uid=str(getattr(msg, "uid", "") or ""),
                    from_address=from_address,
                    from_name=from_name,
                    reply_to=reply_to,
                    subject=_decode_header_value(getattr(msg, "subject", None)),
                    body_text=_extract_body(msg),
                    received_at=_get_received_date(msg),
                )
            )

    return results
