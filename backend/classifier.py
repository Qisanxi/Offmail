"""Classifier — detects LinkedIn 'accepted your invitation' emails, etc.

Security note: classification is sender-aware. The body-text match alone is
NOT enough — a newsletter quoting "accepted your invitation" would otherwise
be misclassified. We require the From domain to be linkedin.com for the
LINKEDIN_ACCEPTED bucket, and we restrict FYI signals to subject + sender
(not body — too many false positives from words like 'digest').
"""
from __future__ import annotations

import re
from typing import Optional

from .imap_client import RawEmail
from .models import EmailCategory

# Patterns for LinkedIn acceptance emails — checked against subject only.
LINKEDIN_ACCEPTED_PATTERNS = [
    r"accepted your (?:invitation|connection request|request to connect)",
    r"you are now connected with",
    r"accepted your request to join",
    r"accepted your connection",
]

# Patterns indicating the email genuinely needs a reply — checked against full text.
NEEDS_REPLY_PATTERNS = [
    r"\bplease reply\b",
    r"\blooking forward to hearing from you\b",
    r"\bwhat (?:time|day) works\b",
    r"\blet'?s (?:schedule|book|set up) (?:a )?(?:call|meeting)\b",
    r"\bcan we hop on a (?:call|zoom)\b",
    r"\bquestion for you\b",
    r"\bwould love to (?:chat|connect|talk)\b",
]

# FYI patterns — checked against SUBJECT + from_address ONLY (not body),
# because words like 'digest' or 'trending' in body cause false positives.
FYI_SUBJECT_PATTERNS = [
    r"\bdigest\b",
    r"\bweekly summary\b",
    r"\byour weekly\b",
    r"\btrending\b",
    r"\bpeople you may know\b",
    r"\bjobs you might be interested in\b",
]

FYI_SENDER_PATTERNS = [
    r"noreply@",
    r"no-reply@",
    r"donotreply@",
    r"do[- ]?not[- ]?reply@",
    r"notifications@",
    r"@notifications\.",
]


def _match_any(patterns: list[str], text: str) -> bool:
    text_lower = (text or "").lower()
    return any(re.search(p, text_lower, re.IGNORECASE) for p in patterns)


def _domain_of(email_address: str) -> str:
    """Return the lowercase domain of an email address, or '' if malformed."""
    if not email_address or "@" not in email_address:
        return ""
    return email_address.split("@", 1)[1].lower().strip()


def _is_linkedin_sender(raw: RawEmail) -> bool:
    """True if the email's From domain is linkedin.com (or a subdomain)."""
    domain = _domain_of(raw.from_address)
    return domain == "linkedin.com" or domain.endswith(".linkedin.com")


def classify(raw: RawEmail) -> EmailCategory:
    """Classify an email into one of the EmailCategory buckets.

    Order of checks (most specific first):
      1. LinkedIn acceptance (subject pattern + sender is linkedin.com)
      2. FYI (subject pattern OR sender is no-reply — checked only on subject/sender)
      3. Needs reply (body pattern)
      4. Unknown
    """
    subject = raw.subject or ""

    # 1. LinkedIn acceptance — sender-restricted to avoid spoofed newsletter matches
    if _is_linkedin_sender(raw) and _match_any(LINKEDIN_ACCEPTED_PATTERNS, subject):
        return EmailCategory.LINKEDIN_ACCEPTED

    # 2. FYI — subject + sender only, never body
    if _match_any(FYI_SUBJECT_PATTERNS, subject) or _match_any(
        FYI_SENDER_PATTERNS, raw.from_address
    ):
        return EmailCategory.FYI

    # 3. Needs reply — body
    body_text = f"{subject}\n{raw.body_text}"
    if _match_any(NEEDS_REPLY_PATTERNS, body_text):
        return EmailCategory.NEEDS_REPLY

    # 4. Default
    return EmailCategory.UNKNOWN


# Unicode-aware name pattern. Supports Latin extended (José, Łukasz, Müller),
# accented characters, hyphens, apostrophes. \w with re.UNICODE (default in Py3)
# covers most scripts.
_NAME_PATTERN = re.compile(
    r"([A-ZŁŚŻŹÀ-Ý][\w'\-\.]*(?:\s+[A-ZŁŚŻŹÀ-Ý][\w'\-\.]*){0,3})"
    r"\s+accepted your (?:invitation|connection request|request to connect)",
    re.UNICODE,
)


def extract_contact_name(raw: RawEmail) -> Optional[str]:
    """Try to extract a human name from the email.

    For LinkedIn acceptance emails, the name appears in the subject like:
    'Arpit Sharma accepted your invitation'. We use a Unicode-aware regex
    so non-ASCII names (José, Łukasz) work too.

    Fallbacks: from_name header, then local-part of the email address.
    """
    # LinkedIn acceptance pattern in the subject
    m = _NAME_PATTERN.search(raw.subject or "")
    if m:
        return m.group(1).strip()

    # Fall back to from_name (RFC2047-decoded already in imap_client)
    if raw.from_name:
        return raw.from_name.strip()

    # Fall back to local-part of email — only if it looks like a real name
    if raw.from_address and "@" in raw.from_address:
        local = raw.from_address.split("@")[0]
        # Skip obvious bot/transactional local parts
        BOT_LOCAL_PARTS = {
            "noreply", "no-reply", "donotreply", "notifications", "notification",
            "noreply-email", "mail", "info", "admin", "support", "team",
            "digest", "weekly", "newsletter", "automated", "system", "postmaster",
        }
        if local.lower() not in BOT_LOCAL_PARTS and re.match(r"^[a-z]", local) and not re.search(r"\d{4,}", local):
            parts = [p.capitalize() for p in re.split(r"[._\-]+", local) if p]
            if parts and all(len(p) > 1 for p in parts):
                return " ".join(parts)

    return None
