"""SMTP sender — sends approved drafts via user's own Gmail."""
from __future__ import annotations

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from .config import settings


def _build_message(
    to_address: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.gmail_address
    msg["To"] = to_address
    msg["Subject"] = f"Re: {subject}" if not subject.lower().startswith("re:") else subject

    # If the email has a LinkedIn-style reply-to address, route through it.
    # This makes the reply land as a LinkedIn DM instead of going to LinkedIn's server.
    if reply_to:
        msg["Reply-To"] = reply_to

    # Threading headers (helps Gmail thread the message)
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references

    msg.attach(MIMEText(body, "plain", "utf-8"))
    return msg


def send_email(
    to_address: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> None:
    """Send a single email synchronously via Gmail SMTP. Raises on failure."""
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
