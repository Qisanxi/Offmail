"""Per-install auth token + dependency for protecting mutating routes.

Why this exists: even bound to 127.0.0.1, the API is reachable by any
website the user visits (CSRF on simple POST requests, DNS-rebinding
bypassing same-origin). We mitigate with:
  1. TrustedHostMiddleware (rejects requests with foreign Host headers)
  2. A per-install random token in <repo>/.offmail_token (gitignored)
  3. A custom header check (X-Offmail-Token) on mutating routes — simple
     requests (no custom headers) can't be sent cross-site without
     triggering a CORS preflight, so this defeats CSRF.

Token is generated on first run if missing. The Vite dev server reads
it from .offmail_token via a small /config.js endpoint stub in the
frontend (or env var OFFMAIL_TOKEN injected).
"""
from __future__ import annotations

import os
import secrets
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

from .config import settings

# Token file location — repo root
_TOKEN_PATH = settings.project_root / ".offmail_token"

# Header name
TOKEN_HEADER = "X-Offmail-Token"

_token_cache: Optional[str] = None


def get_install_token() -> str:
    """Return (or generate) the per-install auth token."""
    global _token_cache
    if _token_cache:
        return _token_cache

    # Allow override via env (e.g. for tests or CI)
    env_token = os.environ.get("OFFMAIL_TOKEN")
    if env_token:
        _token_cache = env_token
        return _token_cache

    if _TOKEN_PATH.exists():
        _token_cache = _TOKEN_PATH.read_text().strip()
        if _token_cache:
            return _token_cache

    # Generate a new token
    _token_cache = secrets.token_urlsafe(32)
    _TOKEN_PATH.write_text(_token_cache)
    # Ensure 0600 perms
    try:
        _TOKEN_PATH.chmod(0o600)
    except OSError:
        pass  # Windows
    return _token_cache


_api_key_header = APIKeyHeader(name=TOKEN_HEADER, auto_error=False)


async def require_token(provided: Optional[str] = Depends(_api_key_header)) -> None:
    """FastAPI dependency: reject if X-Offmail-Token doesn't match."""
    expected = get_install_token()
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid X-Offmail-Token header. "
                   "Read .offmail_token in the repo root.",
        )


async def require_token_for_mutating(
    provided: Optional[str] = Depends(_api_key_header),
) -> None:
    """Same as require_token — alias for clarity at route sites."""
    await require_token(provided)
