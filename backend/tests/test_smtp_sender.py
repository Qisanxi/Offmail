"""Tests for the SMTP message builder — header injection + signature."""
import os
import sys
from email import policy

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

# Force the test creds BEFORE importing backend.config
os.environ["GMAIL_ADDRESS"] = "sender@test.com"
os.environ["GMAIL_APP_PASSWORD"] = "testpass"
os.environ["SIGNATURE"] = "— sent via Offmail (local-first)"
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

# Force a clean import of settings (test runner may have imported it before)
import importlib

if "backend.config" in sys.modules:
    importlib.reload(sys.modules["backend.config"])
if "backend.smtp_sender" in sys.modules:
    importlib.reload(sys.modules["backend.smtp_sender"])


def _build(to="recipient@example.com", subject="Hello", body="Hi there",
           reply_to=None, in_reply_to=None, references=None):
    from backend.smtp_sender import _build_message
    return _build_message(
        to_address=to,
        subject=subject,
        body=body,
        reply_to=reply_to,
        in_reply_to=in_reply_to,
        references=references,
    )


def test_basic_message_fields():
    msg = _build(subject="Hello", body="Hi there")
    assert msg["From"] == "sender@test.com"
    assert msg["To"] == "recipient@example.com"
    assert msg["Subject"] == "Re: Hello"


def test_subject_with_re_prefix_not_doubled():
    """Subject already starting with 'Re:' must not be prefixed twice."""
    msg = _build(subject="Re: Original", body="body")
    assert msg["Subject"] == "Re: Original"


def test_subject_gets_re_prefix():
    msg = _build(subject="Test", body="body")
    assert msg["Subject"] == "Re: Test"


def test_reply_to_is_parsed_address_only():
    """Reply-To 'Name <reply+abc@linkedin.com>' must be parsed to just the email."""
    msg = _build(reply_to="LinkedIn <reply+abc123@linkedin.com>")
    assert msg["Reply-To"] == "reply+abc123@linkedin.com"


def test_header_injection_rejected():
    """CR/LF in subject must NOT create a new header.

    Our sanitizer strips CR/LF. The modern EmailMessage policy would
    also refuse to serialize a multi-line header. Either way, the
    injected Bcc must not appear as its own header line.
    """
    msg = _build(subject="Hello\nBcc: attacker@evil.com", body="body")
    # Serialize and split into individual header lines
    serialized = str(msg)
    header_block = serialized.split("\n\n", 1)[0]
    header_lines = [line for line in header_block.split("\n") if line.strip()]
    # No header line should start with "Bcc:" (it would only be on its own line)
    for line in header_lines:
        assert not line.lower().startswith("bcc:"), \
            f"Header injection succeeded — found standalone Bcc header: {line!r}"
    # The injected text should be in the Subject value, NOT a new header
    # (our sanitizer converts \n to space, so it becomes "Re: Hello Bcc: attacker@evil.com")
    assert msg["Subject"] is not None
    assert "Bcc: attacker@evil.com" in msg["Subject"]


def test_signature_appended_at_send_time():
    """Signature must be present in the message body, not require it in draft."""
    msg = _build(body="Hi there")
    body_text = msg.get_body(preferencelist=("plain",)).get_content()
    assert "— sent via Offmail (local-first)" in body_text


def test_signature_not_doubled_if_already_present():
    msg = _build(body="Hi there\n\n— sent via Offmail (local-first)")
    body_text = msg.get_body(preferencelist=("plain",)).get_content()
    assert body_text.count("— sent via Offmail (local-first)") == 1


def test_in_reply_to_wrapped_in_angle_brackets():
    msg = _build(in_reply_to="abc123@test.com")
    irt = msg["In-Reply-To"]
    assert irt.startswith("<") and irt.endswith(">")
