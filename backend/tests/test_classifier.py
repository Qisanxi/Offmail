"""Tests for the classifier — used by CI workflow."""
import sys
import os
from datetime import datetime, timezone

# Add repo root to sys.path so `backend` is importable as a package
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

from backend.classifier import classify, extract_contact_name, LINKEDIN_ACCEPTED_PATTERNS
from backend.imap_client import RawEmail
from backend.models import EmailCategory


def _make_raw(subject="", body="", from_addr="someone@example.com", reply_to=None):
    return RawEmail(
        message_id="test-1",
        from_address=from_addr,
        from_name=None,
        reply_to=reply_to,
        subject=subject,
        body_text=body,
        received_at=datetime.now(timezone.utc),
    )


def test_linkedin_accepted_classification():
    raw = _make_raw(
        subject="Arpit Sharma accepted your invitation",
        body="Arpit Sharma is now a connection.",
    )
    assert classify(raw) == EmailCategory.LINKEDIN_ACCEPTED


def test_needs_reply_classification():
    raw = _make_raw(
        subject="Following up",
        body="Hi, please reply when you get a chance.",
    )
    assert classify(raw) == EmailCategory.NEEDS_REPLY


def test_fyi_classification():
    raw = _make_raw(
        subject="Your weekly digest",
        body="Here are people you may know this week.",
        from_addr="noreply@linkedin.com",
    )
    assert classify(raw) == EmailCategory.FYI


def test_unknown_classification():
    raw = _make_raw(
        subject="Random subject",
        body="Random body",
    )
    assert classify(raw) == EmailCategory.UNKNOWN


def test_extract_contact_name_from_linkedin_subject():
    raw = _make_raw(subject="Priya Patel accepted your invitation")
    assert extract_contact_name(raw) == "Priya Patel"


def test_extract_contact_name_fallback_to_email():
    raw = _make_raw(subject="(no name)", from_addr="arpit.sharma@gmail.com")
    name = extract_contact_name(raw)
    assert name is not None
    assert "Arpit" in name


def test_linkedin_patterns_compile():
    """Ensure all regex patterns compile without errors."""
    import re
    for p in LINKEDIN_ACCEPTED_PATTERNS:
        re.compile(p, re.IGNORECASE)
