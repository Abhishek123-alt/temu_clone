from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.support.models import SupportTicketStatus


# --- inbound (from the login page Contact Support modal) ---

class SupportRequest(BaseModel):
    from_email: EmailStr
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)
    context: str | None = Field(default=None, max_length=64)


class SupportResponse(BaseModel):
    ok: bool
    ticket_id: UUID | None = None


# --- admin-facing ---

class LinkedUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: Optional[str] = None
    email: str
    role: str
    is_active: bool
    created_at: datetime


class SupportTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    from_email: str
    subject: str
    message: str
    context: Optional[str] = None
    status: SupportTicketStatus
    admin_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    linked_user: Optional[LinkedUserSummary] = None


class SupportTicketPatch(BaseModel):
    status: Optional[SupportTicketStatus] = None
    admin_notes: Optional[str] = Field(default=None, max_length=4000)


class SupportTicketReply(BaseModel):
    message: str = Field(min_length=3, max_length=4000)


class ActionResponse(BaseModel):
    ok: bool
    message: str | None = None


class NotifyAdminRequest(BaseModel):
    from_email: EmailStr
