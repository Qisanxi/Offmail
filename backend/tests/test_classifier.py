"""Tests for the classifier — used by CI workflow.

Includes negative cases (sender-restricted LinkedIn, FYI false positives)
and Unicode name extraction.
"""
import os
import sys
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

# Set fake creds so Settings loads
os.environ.setdefault("GMAIL_ADDRESS", "test@test.com")
os.environ.setdefault("GMAIL_APP_PASSWORD", "testpass")

from backend.classifier import (
    FYI_SENDER_PATTERNS,
    FYI_SUBJECT_PATTERNS,
    LINKEDIN_ACCEPTED_PATTERNS,
    classify,
    extract_contact_name,
)
from backend.imap_client import RawEmail
from backend.models import EmailCategory


def _make_raw(subject="", body="", from_addr="someone@example.com", reply_to=None):
    return RawEmail(
        message_id="test-1",
        uid="1",
        from_address=from_addr,
        from_name=None,
        reply_to=reply_to,
        subject=subject,
        body_text=body,
        received_at=datetime.now(timezone.utc),
    )


# === Positive cases ===

def test_linkedin_accepted_classification():
    raw = _make_raw(
        subject="Arpit Sharma accepted your invitation",
        body="Arpit Sharma is now a connection.",
        from_addr="invitations@linkedin.com",
    )
    assert classify(raw) == EmailCategory.LINKEDIN_ACCEPTED


def test_needs_reply_classification():
    raw = _make_raw(
        subject="Following up",
        body="Hi, please reply when you get a chance.",
    )
    assert classify(raw) == EmailCategory.NEEDS_REPLY


def test_fyi_classification_by_sender():
    raw = _make_raw(
        subject="Your weekly digest",
        body="Here are people you may know this week.",
        from_addr="noreply@linkedin.com",
    )
    assert classify(raw) == EmailCategory.FYI


def test_unknown_classification():
    raw = _make_raw(subject="Random subject", body="Random body")
    assert classify(raw) == EmailCategory.UNKNOWN


# === Negative cases (the ones the reviewer flagged) ===

def test_linkedin_pattern_in_body_but_sender_is_not_linkedin():
    """A newsletter quoting 'accepted your invitation' must NOT be classified as LinkedIn."""
    raw = _make_raw(
        subject="Weekly tech news",
        body="InboxIQ accepted your invitation to their newsletter...",
        from_addr="newsletter@techcrunch.com",
    )
    assert classify(raw) != EmailCategory.LINKEDIN_ACCEPTED


def test_fyi_keyword_in_body_does_not_trigger_fyi():
    """The word 'digest' in body must NOT cause FYI classification."""
    raw = _make_raw(
        subject="Following up on our chat",
        body="I'll send you a digest of our discussion.",
        from_addr="recruiter@google.com",
    )
    # Should be NEEDS_REPLY (no reply intent) or UNKNOWN, NOT FYI
    assert classify(raw) != EmailCategory.FYI


def test_real_reply_with_digest_in_subject_still_works():
    """If subject has 'digest' but body asks for a reply, FYI wins (subject pattern)."""
    raw = _make_raw(
        subject="Project digest — please reply",
        body="please reply when you can",
        from_addr="manager@company.com",
    )
    # FYI takes precedence over NEEDS_REPLY per classifier order
    assert classify(raw) == EmailCategory.FYI


# === Name extraction ===

def test_extract_contact_name_from_linkedin_subject():
    raw = _make_raw(subject="Priya Patel accepted your invitation")
    assert extract_contact_name(raw) == "Priya Patel"


def test_extract_contact_name_fallback_to_email():
    raw = _make_raw(subject="(no name)", from_addr="arpit.sharma@gmail.com")
    name = extract_contact_name(raw)
    assert name is not None
    assert "Arpit" in name


def test_extract_unicode_name():
    """Unicode names like José / Łukasz should work."""
    raw = _make_raw(subject="José García accepted your invitation")
    name = extract_contact_name(raw)
    assert name is not None
    assert "José" in name or "Jose" in name


def test_skip_obvious_bot_email_in_name_extraction():
    """noreply@linkedin.com should NOT produce a fake 'Noreply' name."""
    raw = _make_raw(subject="Digest", from_addr="noreply@linkedin.com")
    name = extract_contact_name(raw)
    # Either None or not the literal 'Noreply'
    assert name is None or "noreply" not in name.lower()


# === Pattern sanity ===

def test_linkedin_patterns_compile():
    import re
    for p in LINKEDIN_ACCEPTED_PATTERNS:
        re.compile(p, re.IGNORECASE)


def test_fyi_patterns_compile():
    import re
    for p in FYI_SUBJECT_PATTERNS + FYI_SENDER_PATTERNS:
        re.compile(p, re.IGNORECASE)
