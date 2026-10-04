"""SQLAlchemy models for emails, drafts, contacts."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
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
    SENDING = "sending"       # claimed by a worker, in-flight (prevents double-send)
    SENT = "sent"             # successfully sent
    FAILED = "failed"         # send failed; will retry up to MAX_ATTEMPTS
    DEAD = "dead"             # exhausted retries; user must manually retry
    REJECTED = "rejected"     # user dismissed


# Maximum send attempts before a draft moves to DEAD state.
MAX_SEND_ATTEMPTS = 5


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=True)
    email = Column(String, index=True, nullable=False)
    headline = Column(String, nullable=True)  # e.g. "Recruiter at Stripe"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    emails = relationship("Email", back_populates="contact")


class Email(Base):
    __tablename__ = "emails"
    __table_args__ = (
        # A given Message-ID should only land once per inbox.
        UniqueConstraint("message_id", name="uq_emails_message_id"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    message_id = Column(String, index=True, nullable=False)
    from_address = Column(String, nullable=False)
    from_name = Column(String, nullable=True)
    reply_to = Column(String, nullable=True)  # LinkedIn reply+xxx@linkedin.com if present
    subject = Column(String, nullable=True)
    body_snippet = Column(Text, nullable=True)  # first 500 chars
    body_full = Column(Text, nullable=True)
    category = Column(Enum(EmailCategory), default=EmailCategory.UNKNOWN, index=True)
    received_at = Column(DateTime(timezone=True), index=True)
    fetched_at = Column(DateTime(timezone=True), default=_utcnow)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)

    # Per-email extracted name. For LinkedIn acceptance emails, all emails come
    # from the same sender (e.g. invitations@linkedin.com) — so we can't rely
    # on Contact.name alone. We extract the name from the subject ("Arpit Sharma
    # accepted your invitation") and store it per-email.
    contact_name_extracted = Column(String, nullable=True)

    contact = relationship("Contact", back_populates="emails")
    drafts = relationship(
        "Draft",
        back_populates="email",
        cascade="all, delete-orphan",
        order_by="Draft.created_at.desc()",  # newest first when lazy-loaded
    )


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(String, primary_key=True, default=_uuid)
    email_id = Column(String, ForeignKey("emails.id"), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(Enum(DraftStatus), default=DraftStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)

    email = relationship("Email", back_populates="drafts")
