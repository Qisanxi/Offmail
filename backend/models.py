"""SQLAlchemy models for emails, drafts, contacts."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, Boolean, Integer
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class EmailCategory(str, enum.Enum):
    LINKEDIN_ACCEPTED = "linkedin_accepted"
    NEEDS_REPLY = "needs_reply"
    FYI = "fyi"
    UNKNOWN = "unknown"


class DraftStatus(str, enum.Enum):
    PENDING = "pending"       # draft generated, awaiting user review
    APPROVED = "approved"     # user approved, queued for send
    SENT = "sent"             # successfully sent
    FAILED = "failed"         # send failed; will retry
    REJECTED = "rejected"     # user dismissed


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=True)
    email = Column(String, index=True, nullable=False)
    headline = Column(String, nullable=True)  # e.g. "Recruiter at Stripe"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    emails = relationship("Email", back_populates="contact")


class Email(Base):
    __tablename__ = "emails"

    id = Column(String, primary_key=True, default=_uuid)
    message_id = Column(String, index=True, nullable=False)  # IMAP Message-ID
    from_address = Column(String, nullable=False)
    from_name = Column(String, nullable=True)
    reply_to = Column(String, nullable=True)  # LinkedIn reply+xxx@linkedin.com if present
    subject = Column(String, nullable=True)
    body_snippet = Column(Text, nullable=True)  # first 500 chars
    body_full = Column(Text, nullable=True)
    category = Column(Enum(EmailCategory), default=EmailCategory.UNKNOWN, index=True)
    received_at = Column(DateTime, index=True)
    fetched_at = Column(DateTime, default=_utcnow)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)

    contact = relationship("Contact", back_populates="emails")
    drafts = relationship("Draft", back_populates="email", cascade="all, delete-orphan")


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(String, primary_key=True, default=_uuid)
    email_id = Column(String, ForeignKey("emails.id"), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(Enum(DraftStatus), default=DraftStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    last_attempt_at = Column(DateTime, nullable=True)

    email = relationship("Email", back_populates="drafts")


def init_db() -> None:
    """Create all tables. Called on app startup."""
    Base.metadata.create_all(bind=engine)
