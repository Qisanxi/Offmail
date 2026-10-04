"""Configuration loader — reads .env and exposes typed settings."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# Load .env from project root (one level up from backend/)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")


def _split_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # Gmail
    gmail_address: str = os.getenv("GMAIL_ADDRESS", "")
    gmail_app_password: str = os.getenv("GMAIL_APP_PASSWORD", "")
    imap_host: str = os.getenv("IMAP_HOST", "imap.gmail.com")
    imap_port: int = int(os.getenv("IMAP_PORT", "993"))
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))

    # Ollama / LLM
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma3:1b")

    # Polling
    poll_interval_seconds: int = int(os.getenv("POLL_INTERVAL_SECONDS", "120"))
    fetch_window_days: int = int(os.getenv("FETCH_WINDOW_DAYS", "7"))

    # DB
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./offmail.db")

    # CORS
    cors_origins: List[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # Drafting
    draft_tone: str = os.getenv("DRAFT_TONE", "friendly_professional")
    draft_max_words: int = int(os.getenv("DRAFT_MAX_WORDS", "80"))
    signature: str = os.getenv("SIGNATURE", "— sent via Offmail (local-first)")

    # Queue
    queue_retry_seconds: int = int(os.getenv("QUEUE_RETRY_SECONDS", "60"))

    @property
    def is_configured(self) -> bool:
        """True if Gmail creds are set."""
        return bool(self.gmail_address and self.gmail_app_password)


settings = Settings()
