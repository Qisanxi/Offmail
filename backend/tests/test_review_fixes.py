"""Regression tests for the code-review findings.

Each test pins one fix so it can't silently come back:
  - IMAP search criteria is a single string (not a Python list)
  - Reply-To is only trusted for genuine linkedin.com acceptance mail
  - FAILED drafts retry with exponential backoff; interrupted sends aren't re-sent
  - Timestamps are serialized with an explicit UTC offset
  - Inbox data requires the token; /api/token no longer exists
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

os.environ.setdefault("GMAIL_ADDRESS", "test@test.com")
os.environ.setdefault("GMAIL_APP_PASSWORD", "testpass")

from backend.imap_client import RawEmail, build_search_criteria  # noqa: E402
from backend.models import Draft, DraftStatus, Email, EmailCategory  # noqa: E402
from backend.send_queue import is_retry_due, resolve_recipient  # noqa: E402

# ---------------------------------------------------------------- IMAP search


def test_search_criteria_is_one_string():
    crit = build_search_criteria(datetime(2026, 10, 1, tzinfo=timezone.utc))
    assert isinstance(crit, str)
    assert "[" not in crit and "'" not in crit  # no Python list repr
    assert 'X-GM-RAW "category:social"' in crit
    assert "SINCE" in crit


# ------------------------------------------------------- recipient resolution


def _email(category, reply_to, frm="invitations@linkedin.com"):
    return SimpleNamespace(category=category, reply_to=reply_to, from_address=frm)


def test_linkedin_reply_to_is_trusted():
    to, rt, err = resolve_recipient(
        _email(EmailCategory.LINKEDIN_ACCEPTED, "reply+abc@linkedin.com")
    )
    assert (to, rt, err) == ("reply+abc@linkedin.com", "reply+abc@linkedin.com", None)


def test_linkedin_reply_to_with_display_name_is_parsed():
    to, _, err = resolve_recipient(
        _email(EmailCategory.LINKEDIN_ACCEPTED, "Priya <reply+x@mail.linkedin.com>")
    )
    assert to == "reply+x@mail.linkedin.com" and err is None


@pytest.mark.parametrize(
    "reply_to",
    ["evil@attacker.com", "reply+x@linkedin.com.evil.com", "x@notlinkedin.com", None, ""],
)
def test_untrusted_reply_to_is_refused(reply_to):
    to, rt, err = resolve_recipient(_email(EmailCategory.LINKEDIN_ACCEPTED, reply_to))
    assert to is None and rt is None
    assert err and "linkedin.com" in err


def test_non_linkedin_mail_ignores_reply_to():
    to, rt, err = resolve_recipient(
        _email(EmailCategory.NEEDS_REPLY, "evil@attacker.com", frm="Bob <bob@corp.com>")
    )
    assert (to, rt, err) == ("bob@corp.com", None, None)


# ------------------------------------------------------------------- backoff


def _draft(attempts, last):
    return SimpleNamespace(attempts=attempts, last_attempt_at=last)


def test_backoff_grows_exponentially():
    now = datetime.now(timezone.utc)
    # base is QUEUE_RETRY_SECONDS (60 by default): 60s, 120s, 240s ...
    from backend.send_queue import _backoff_seconds

    assert _backoff_seconds(2) == 2 * _backoff_seconds(1)
    assert _backoff_seconds(3) == 4 * _backoff_seconds(1)

    waited = _backoff_seconds(3)
    assert not is_retry_due(_draft(3, now - timedelta(seconds=waited - 5)), now)
    assert is_retry_due(_draft(3, now - timedelta(seconds=waited + 5)), now)


def test_retry_due_handles_naive_sqlite_datetimes():
    now = datetime.now(timezone.utc)
    naive_old = (now - timedelta(hours=1)).replace(tzinfo=None)
    assert is_retry_due(_draft(1, naive_old), now)
    assert is_retry_due(_draft(1, None), now)


# ------------------------------------------------ API: auth, UTC, recovery


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    import backend.auth as auth
    import backend.db as db
    import backend.main as main
    from backend.models import Base

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    old_engine = db.SessionLocal.kw["bind"]
    db.SessionLocal.configure(bind=engine)
    old_token = auth._token_cache
    auth._token_cache = "test-token"
    try:
        with TestClient(main.app, base_url="http://localhost") as c:
            yield c
    finally:
        auth._token_cache = old_token
        db.SessionLocal.configure(bind=old_engine)


H = {"X-Offmail-Token": "test-token"}


def _raw(i=1, reply="reply+abc@linkedin.com"):
    return RawEmail(
        message_id=f"m{i}",
        uid=str(i),
        from_address="invitations@linkedin.com",
        from_name="LinkedIn",
        reply_to=reply,
        subject="Priya Patel accepted your invitation",
        body_text="hi",
        received_at=datetime(2026, 10, 4, 10, 0, tzinfo=timezone.utc),
    )


def test_read_routes_require_token(client):
    for path in ("/api/emails", "/api/drafts", "/api/stats"):
        assert client.get(path).status_code == 401
        assert client.get(path, headers=H).status_code == 200


def test_health_stays_open(client):
    with mock.patch("backend.main.check_ollama_health", mock.AsyncMock(return_value={"status": "ok"})):
        assert client.get("/api/health").status_code == 200


def test_token_endpoint_is_gone(client):
    assert client.get("/api/token").status_code == 404
    assert client.get("/api/token", headers=H).status_code == 404


def test_foreign_host_rejected(client):
    assert client.get("/api/health", headers={"Host": "evil.com"}).status_code == 400


def test_timestamps_have_explicit_utc_offset(client):
    with mock.patch("backend.main.fetch_recent_social_emails", lambda: [_raw()]):
        assert client.post("/api/inbox/refresh", headers=H).status_code == 200
    e = client.get("/api/emails", headers=H).json()[0]
    assert e["received_at"] == "2026-10-04T10:00:00Z"


def test_spoofed_reply_to_is_never_sent(client):
    sent = []

    async def fake_send(**kw):
        sent.append(kw)

    async def fake_llm(**kw):
        return "Thanks for connecting, happy to chat next week."

    with mock.patch("backend.main.fetch_recent_social_emails", lambda: [_raw(reply="evil@attacker.com")]), \
         mock.patch("backend.main.generate_draft", fake_llm), \
         mock.patch("backend.send_queue.send_email_async", fake_send):
        client.post("/api/inbox/refresh", headers=H)
        e = client.get("/api/emails", headers=H).json()[0]
        d = client.post(f"/api/emails/{e['id']}/draft", headers=H).json()
        client.post(f"/api/drafts/{d['id']}/approve", headers=H, json={})
        summary = client.post("/api/queue/flush", headers=H).json()

    assert sent == []  # nothing left the building
    assert summary["failed"] == 1
    failed = client.get("/api/drafts?status=failed", headers=H).json()
    assert failed and "linkedin.com" in failed[0]["error_message"]


def test_interrupted_sends_are_not_retried_automatically(client):
    from backend.db import get_db
    from backend.send_queue import get_sendable_drafts, recover_interrupted_sends

    with get_db() as db:
        email = Email(
            message_id="x", from_address="a@b.com", category=EmailCategory.UNKNOWN
        )
        db.add(email)
        db.flush()
        db.add(Draft(email_id=email.id, body="hi", status=DraftStatus.SENDING))
        db.commit()

    assert recover_interrupted_sends() == 1
    with get_db() as db:
        d = db.query(Draft).one()
        assert d.status == DraftStatus.DEAD
        assert "Sent folder" in d.error_message
        assert get_sendable_drafts(db) == []

    # explicit opt-in revives it
    from backend.send_queue import retry_failed_drafts

    assert retry_failed_drafts() == 0
    assert retry_failed_drafts(include_dead=True) == 1
