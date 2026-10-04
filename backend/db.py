"""SQLite database engine + session factory."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

# SQLite needs check_same_thread=False for FastAPI
connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db() -> Iterator[Session]:
    """Yield a DB session; auto-close on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
