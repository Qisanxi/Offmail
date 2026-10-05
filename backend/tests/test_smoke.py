"""Smoke test: ensure backend.main imports cleanly.

This catches the regression where init_db was imported from the wrong
module, or relative imports broke when running from inside backend/.
"""
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, REPO_ROOT)

os.environ.setdefault("GMAIL_ADDRESS", "test@test.com")
os.environ.setdefault("GMAIL_APP_PASSWORD", "testpass")


def test_backend_main_imports():
    """import backend.main must succeed."""
    from backend import main
    assert hasattr(main, "app"), "main must expose an `app` attribute"
    assert main.app.title == "Offmail"


def test_init_db_lives_in_db_module():
    """init_db must be importable from backend.db (not backend.models)."""
    from backend.db import engine, get_db, init_db
    assert callable(init_db)
    assert engine is not None
    assert callable(get_db)


def test_send_queue_imports():
    """backend.send_queue (renamed from queue.py) must import cleanly
    without shadowing stdlib queue."""
    # Verify stdlib queue is NOT shadowed
    import queue as stdlib_queue

    from backend import send_queue
    assert stdlib_queue.__name__ == "queue"
    assert hasattr(send_queue, "flush_queue_once")
    assert hasattr(send_queue, "queue_loop")


def test_draft_status_includes_sending_and_dead():
    """SENDING and DEAD states must exist (added to prevent double-send + infinite retry)."""
    from backend.models import DraftStatus
    assert DraftStatus.SENDING.value == "sending"
    assert DraftStatus.DEAD.value == "dead"
