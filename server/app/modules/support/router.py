from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.support import services
from app.modules.support.models import SupportTicketStatus
from app.modules.support.schemas import (
    ActionResponse,
    NotifyAdminRequest,
    SupportRequest,
    SupportResponse,
    SupportTicketPatch,
    SupportTicketRead,
    SupportTicketReply,
)
from app.modules.user import models as user_models
from app.modules.user.router import get_current_user

router = APIRouter()


def require_admin(current_user: user_models.User = Depends(get_current_user)) -> user_models.User:
    """Guard for admin-only endpoints.

    Existing admin endpoints in app/modules/admin/router.py do NOT enforce
    this — that's a pre-existing security gap. We enforce here so the support
    tickets (which can leak user-submitted email addresses and PII) aren't
    readable by anyone with a valid JWT.
    """
    if current_user.role != user_models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required.",
        )
    return current_user


# --- Public (unauthenticated) ---

@router.post("/contact", response_model=SupportResponse)
def contact_support(
    payload: SupportRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> SupportResponse:
    """Unauthenticated contact-support endpoint used from the login page when
    a user's account has been deactivated. Persists a ticket AND forwards the
    message to the SUPPORT_EMAIL address configured in .env."""
    client_ip = request.client.host if request.client else "unknown"
    ticket = services.submit_support_request(db, payload, client_ip)
    return SupportResponse(ok=True, ticket_id=ticket.id)


@router.post("/notify-admin", response_model=SupportResponse)
def notify_admin_pending_seller(
    payload: NotifyAdminRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> SupportResponse:
    """Public endpoint used from the SELLER_APPLICATION_PENDING panel on the
    login page. Nudges the admin via email + creates a ticket so the request
    is visible in the admin Support tab. Only allowed for users who actually
    are SELLER_PENDING + inactive."""
    client_ip = request.client.host if request.client else "unknown"
    ticket = services.notify_admin_pending_seller(db, payload.from_email, client_ip)
    return SupportResponse(ok=True, ticket_id=ticket.id)


# --- Admin-only ---

@router.get("/admin/tickets", response_model=list[SupportTicketRead])
def list_tickets(
    status_filter: Optional[SupportTicketStatus] = None,
    db: Session = Depends(get_db),
    _: user_models.User = Depends(require_admin),
):
    return services.list_tickets(db, status_filter=status_filter)


@router.get("/admin/tickets/open-count")
def open_ticket_count(
    db: Session = Depends(get_db),
    _: user_models.User = Depends(require_admin),
):
    return {"count": services.count_open_tickets(db)}


@router.get("/admin/tickets/{ticket_id}", response_model=SupportTicketRead)
def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    _: user_models.User = Depends(require_admin),
):
    return services.get_ticket(db, ticket_id)


@router.patch("/admin/tickets/{ticket_id}", response_model=SupportTicketRead)
def patch_ticket(
    ticket_id: UUID,
    payload: SupportTicketPatch,
    db: Session = Depends(get_db),
    admin: user_models.User = Depends(require_admin),
):
    return services.patch_ticket(
        db, ticket_id, admin, payload.status, payload.admin_notes
    )


@router.post(
    "/admin/tickets/{ticket_id}/reactivate-user",
    response_model=SupportTicketRead,
)
def reactivate_user_from_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    admin: user_models.User = Depends(require_admin),
):
    return services.reactivate_user_from_ticket(db, ticket_id, admin)


@router.post("/admin/tickets/{ticket_id}/reply", response_model=ActionResponse)
def reply_to_ticket(
    ticket_id: UUID,
    payload: SupportTicketReply,
    db: Session = Depends(get_db),
    admin: user_models.User = Depends(require_admin),
):
    services.reply_to_ticket(db, ticket_id, admin, payload.message)
    return ActionResponse(ok=True, message="Reply sent.")
