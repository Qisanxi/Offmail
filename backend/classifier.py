"""Classifier — detects LinkedIn 'accepted your invitation' emails, etc."""
from __future__ import annotations

import re
from typing import Optional

from .models import EmailCategory
from .imap_client import RawEmail


# Patterns for LinkedIn acceptance emails
LINKEDIN_ACCEPTED_PATTERNS = [
    r"accepted your (?:invitation|connection request|request to connect)",
    r"you are now connected with",
    r"accepted your request to join",
    r"\baccept(?:ed)? your invitation\b",
    r"accepted your connection",
]

# Patterns indicating the email genuinely needs a reply
NEEDS_REPLY_PATTERNS = [
    r"\bplease reply\b",
    r"\blooking forward to hearing from you\b",
    r"\bwhat (?:time|day) works\b",
    r"\blet'?s (?:schedule|book|set up) (?:a )?(?:call|meeting)\b",
    r"\bcan we hop on a (?:call|zoom)\b",
    r"\bquestion for you\b",
    r"\bwould love to (?:chat|connect|talk)\b",
]

# FYI patterns — clearly digest / notification / no-reply expected
FYI_PATTERNS = [
    r"noreply@",
    r"no-reply@",
    r"do[- ]?not[- ]?reply",
    r"digest",
    r"weekly summary",
    r"your weekly",
    r"trending",
    r"people you may know",
    r"jobs you might be interested in",
]


def _match_any(patterns: list[str], text: str) -> bool:
    text_lower = text.lower()
    return any(re.search(p, text_lower, re.IGNORECASE) for p in patterns)


def classify(raw: RawEmail) -> EmailCategory:
    """Classify an email into one of the EmailCategory buckets."""
    text = f"{raw.subject}\n{raw.body_text}"

    # Strongest signal first: LinkedIn acceptance
    if _match_any(LINKEDIN_ACCEPTED_PATTERNS, text):
        return EmailCategory.LINKEDIN_ACCEPTED

    # FYI signals (digests, no-reply)
    if _match_any(FYI_PATTERNS, text) or _match_any(FYI_PATTERNS, raw.from_address):
        return EmailCategory.FYI

    # Needs-reply signals
    if _match_any(NEEDS_REPLY_PATTERNS, text):
        return EmailCategory.NEEDS_REPLY

    # Default: unknown (still draftable, user can dismiss)
    return EmailCategory.UNKNOWN


def extract_contact_name(raw: RawEmail) -> Optional[str]:
    """Try to extract a human name from 'From' header or subject.
    For LinkedIn acceptance emails, the name usually appears in the subject
    like: 'Arpit Sharma accepted your invitation'.
    """
    # LinkedIn acceptance pattern: "<Name> accepted your invitation"
    m = re.search(
        r"([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,2})\s+accepted your (?:invitation|connection request|request to connect)",
        raw.subject or "",
    )
    if m:
        return m.group(1).strip()

    # Fall back to from_name
    if raw.from_name:
        return raw.from_name.strip()

    # Fall back to local part of email
    if raw.from_address and "@" in raw.from_address:
        local = raw.from_address.split("@")[0]
        # turn "arpit.sharma" into "Arpit Sharma"
        parts = [p.capitalize() for p in re.split(r"[._-]+", local) if p]
        if parts:
            return " ".join(parts)

    return None
