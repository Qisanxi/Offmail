"""SMTP sender — sends approved drafts via the user's own Gmail.

Key design choices:
- Uses email.message.EmailMessage (modern API) with a strict policy that
  rejects header injection (CR/LF in headers).
- The 'To' header is the original sender's address. The 'Reply-To' header
  is set to the LinkedIn reply-to address (if present), so Gmail's SMTP
  routes the message through LinkedIn's reply-to mechanism and it lands
  as a LinkedIn DM.
- The signature is appended at SEND time (not generation time) so user
  edits to the draft can't drop or duplicate it.
- Recipient address (for SMTP RCPT TO) is the LinkedIn reply-to if present,
  otherwise the original sender — because that's where the message needs
  to go to be routed to the recipient.
"""
from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Optional

from .config import settings


def _sanitize_header(value: str) -> str:
    """Strip CR/LF from header values to prevent header injection.

    The modern EmailMessage policy would reject these anyway, but we strip
    first for defense in depth.
    """
    if not value:
        return ""
    # Remove any CR or LF characters (and the surrounding whitespace they hide in)
    cleaned = value.replace("\r", " ").replace("\n", " ").replace("\0", "")
    return cleaned.strip()


def _append_signature(body: str) -> str:
    """Append the configured signature to the body. Doesn't double-append."""
    sig = settings.signature
    if not sig:
        return body
    if sig in body:
        return body
    return f"{body.rstrip()}\n\n{sig}"


def _build_message(
    to_address: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> EmailMessage:
    """Build an EmailMessage ready to send via SMTP."""
    msg = EmailMessage()

    # Sanitize all untrusted inputs to prevent header injection
    clean_subject = _sanitize_header(subject or "(no subject)")
    if not clean_subject.lower().startswith("re:"):
        clean_subject = f"Re: {clean_subject}"

    msg["From"] = settings.gmail_address
    msg["To"] = _sanitize_header(to_address)
    msg["Subject"] = clean_subject

    # If the email had a LinkedIn-style reply-to address, set it as the
    # outgoing Reply-To header. This is the trick that routes the message
    # through LinkedIn's reply-to mechanism.
    if reply_to:
        # parseaddr returns (name, email) — we only want the email part
        reply_to_addr = parseaddr(reply_to)[1]
        if reply_to_addr:
            msg["Reply-To"] = _sanitize_header(reply_to_addr)

    # Threading headers
    if in_reply_to:
        # Wrap in angle brackets if not already
        mid = _sanitize_header(in_reply_to)
        if not mid.startswith("<"):
            mid = f"<{mid}>"
        if not mid.endswith(">"):
            mid = f"{mid}>"
        msg["In-Reply-To"] = mid
        msg["References"] = mid

    # Append signature at send time (not generation time)
    final_body = _append_signature(body)
    msg.set_content(final_body)
    return msg


def send_email(
    to_address: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> None:
    """Send a single email synchronously via Gmail SMTP. Raises on failure.

    The SMTP RCPT TO is set to `to_address` — caller is responsible for
    passing the right destination. For LinkedIn acceptance emails, this
    is the reply-to address (so the message routes to LinkedIn's reply
    handler). For normal replies, it's the original From address.
    """
    if not settings.is_configured:
        raise RuntimeError("Gmail credentials not configured.")

    msg = _build_message(to_address, subject, body, reply_to, in_reply_to, references)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
        server.starttls()
        server.login(settings.gmail_address, settings.gmail_app_password)
        server.send_message(msg)


async def send_email_async(
    to_address: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> None:
    """Async wrapper around send_email — runs in threadpool."""
    await asyncio.to_thread(
        send_email,
        to_address,
        subject,
        body,
        reply_to,
        in_reply_to,
        references,
    )
