import enum
import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class SupportTicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_email = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    # Free-form context tag from the client (e.g. ACCOUNT_DEACTIVATED) — used
    # to drive triage UI and to decide whether the "Reactivate User" action is
    # offered on the ticket.
    context = Column(String, nullable=True)
    status = Column(
        Enum(SupportTicketStatus),
        default=SupportTicketStatus.OPEN,
        nullable=False,
        index=True,
    )
    # Nullable: the from_email may not match any registered user.
    linked_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_admin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    linked_user = relationship("User", foreign_keys=[linked_user_id])
    resolved_by_admin = relationship("User", foreign_keys=[resolved_by_admin_id])
