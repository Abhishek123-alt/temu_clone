import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime, UTC
from threading import Lock
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.email import send_email
from app.modules.store.models import Store
from app.modules.support.models import SupportTicket, SupportTicketStatus
from app.modules.support.schemas import SupportRequest
from app.modules.user.models import User, UserRole

logger = logging.getLogger(__name__)


# --- Naive in-memory rate limit ---
# Keys: (email_lower, client_ip). Value: deque of recent timestamps.
# Single-process only; if we ever run multiple uvicorn workers this needs to
# move to Redis. Good enough to stop casual spam from the unauth endpoint.
_RATE_WINDOW_SECONDS = 60 * 60  # 1 hour
_RATE_MAX_REQUESTS = 5
_rate_state: dict[tuple[str, str], deque] = defaultdict(deque)
_rate_lock = Lock()


def _support_destination() -> str:
    return os.getenv("SUPPORT_EMAIL", "").strip() or "temu-support@yopmail.com"


def _check_rate_limit(from_email: str, client_ip: str) -> None:
    key = (from_email.lower(), client_ip)
    now = time.monotonic()
    with _rate_lock:
        bucket = _rate_state[key]
        cutoff = now - _RATE_WINDOW_SECONDS
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _RATE_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many support requests from this address. Please try again later.",
            )
        bucket.append(now)


def _find_existing_ticket(
    db: Session, from_email: str, context: str | None
) -> SupportTicket | None:
    """Look up the canonical ticket for (email, context). Context-less tickets
    are always treated as new (mirrors the partial unique index on the DB)."""
    if not context:
        return None
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.from_email == from_email.lower())
        .filter(SupportTicket.context == context)
        .first()
    )


def _reopen_existing_ticket(
    ticket: SupportTicket,
    *,
    subject: str,
    new_message: str,
    linked_user_id: UUID | None,
) -> None:
    """Apply an incoming resubmission to an existing ticket: bump it back to
    OPEN, append the new message (so history isn't lost), preserve admin notes
    and the original created_at."""
    now_iso = datetime.now(UTC).isoformat()
    ticket.subject = subject
    ticket.message = (
        f"{ticket.message}\n\n--- Resubmitted on {now_iso} ---\n{new_message}"
    )
    ticket.status = SupportTicketStatus.OPEN
    ticket.resolved_at = None
    ticket.resolved_by_admin_id = None
    # Only update the linked user if we have one and it wasn't already set —
    # don't blow away a previous link.
    if linked_user_id and not ticket.linked_user_id:
        ticket.linked_user_id = linked_user_id


def submit_support_request(
    db: Session,
    payload: SupportRequest,
    client_ip: str,
) -> SupportTicket:
    """Persist (or update) a ticket, email the support inbox, return the row.

    Uniqueness: (from_email, context). A second submission with the same combo
    updates the existing ticket instead of creating a duplicate — appends the
    new message, resets status to OPEN, clears resolved-by metadata, keeps
    admin_notes and created_at.

    Order matters: we touch the DB FIRST so even if SMTP fails we still have
    a record. The SMTP error is then propagated so the caller sees a 502.
    """
    _check_rate_limit(payload.from_email, client_ip)

    normalized_email = payload.from_email.lower()
    linked_user = db.query(User).filter(User.email == normalized_email).first()
    linked_user_id = linked_user.id if linked_user else None

    existing = _find_existing_ticket(db, normalized_email, payload.context)
    if existing:
        _reopen_existing_ticket(
            existing,
            subject=payload.subject,
            new_message=payload.message,
            linked_user_id=linked_user_id,
        )
        db.commit()
        db.refresh(existing)
        ticket = existing
        action = "updated"
    else:
        ticket = SupportTicket(
            from_email=normalized_email,
            subject=payload.subject,
            message=payload.message,
            context=payload.context,
            status=SupportTicketStatus.OPEN,
            linked_user_id=linked_user_id,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        action = "created"

    logger.info(
        f"Support ticket {ticket.id} {action} from {normalized_email} "
        f"(linked_user={ticket.linked_user_id}, context={payload.context})"
    )

    body = (
        f"{'Resubmitted' if action == 'updated' else 'New'} support request — ticket {ticket.id}\n"
        f"-------------------------------------------\n"
        f"From:    {normalized_email}\n"
        f"Context: {payload.context or 'n/a'}\n\n"
        f"{payload.message}\n"
    )
    send_email(
        to=_support_destination(),
        subject=f"[Temu Support] {payload.subject}",
        body=body,
        reply_to=normalized_email,
    )
    return ticket


# --- Admin side ---

def list_tickets(
    db: Session,
    status_filter: Optional[SupportTicketStatus] = None,
) -> list[SupportTicket]:
    q = db.query(SupportTicket)
    if status_filter is not None:
        q = q.filter(SupportTicket.status == status_filter)
    return q.order_by(SupportTicket.created_at.desc()).all()


def count_open_tickets(db: Session) -> int:
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.status == SupportTicketStatus.OPEN)
        .count()
    )


def get_ticket(db: Session, ticket_id: UUID) -> SupportTicket:
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


def patch_ticket(
    db: Session,
    ticket_id: UUID,
    admin: User,
    new_status: Optional[SupportTicketStatus],
    new_notes: Optional[str],
) -> SupportTicket:
    ticket = get_ticket(db, ticket_id)
    if new_status is not None and new_status != ticket.status:
        ticket.status = new_status
        if new_status in (SupportTicketStatus.RESOLVED, SupportTicketStatus.DISMISSED):
            ticket.resolved_at = datetime.now(UTC)
            ticket.resolved_by_admin_id = admin.id
        else:
            ticket.resolved_at = None
            ticket.resolved_by_admin_id = None
    if new_notes is not None:
        ticket.admin_notes = new_notes
    db.commit()
    db.refresh(ticket)
    logger.info(f"Ticket {ticket.id} patched by admin {admin.id}: status={ticket.status}")
    return ticket


def reactivate_user_from_ticket(
    db: Session,
    ticket_id: UUID,
    admin: User,
) -> SupportTicket:
    ticket = get_ticket(db, ticket_id)
    if ticket.linked_user_id is None:
        raise HTTPException(
            status_code=400,
            detail="This ticket isn't linked to a registered account.",
        )
    user = db.query(User).filter(User.id == ticket.linked_user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Linked user no longer exists.",
        )
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify admin accounts")
    user.is_active = True
    ticket.status = SupportTicketStatus.RESOLVED
    ticket.resolved_at = datetime.now(UTC)
    ticket.resolved_by_admin_id = admin.id
    note_line = (
        f"\n[{datetime.now(UTC).isoformat()}] Account reactivated by admin "
        f"{admin.email}."
    )
    ticket.admin_notes = (ticket.admin_notes or "") + note_line
    db.commit()
    db.refresh(ticket)
    logger.info(
        f"User {user.id} reactivated by admin {admin.id} via ticket {ticket.id}"
    )
    return ticket


def notify_admin_pending_seller(
    db: Session,
    from_email: str,
    client_ip: str,
) -> SupportTicket:
    """Pending seller asks for review nudge. Sends an email to the support
    inbox with their account + store details and drops a ticket in the admin
    Support tab so it isn't easy to miss."""
    _check_rate_limit(from_email, client_ip)

    user = db.query(User).filter(User.email == from_email.lower()).first()
    if not user:
        # Don't enumerate accounts — return the same generic error a real
        # SELLER_PENDING user couldn't actually trigger.
        raise HTTPException(
            status_code=400,
            detail="No matching seller application found for this email.",
        )
    if user.role != UserRole.SELLER_PENDING or user.is_active:
        raise HTTPException(
            status_code=400,
            detail="This account isn't waiting for seller approval.",
        )

    store = db.query(Store).filter(Store.user_id == user.id).first()
    store_lines = "(no store details submitted yet)\n"
    if store:
        store_lines = (
            f"Store name:    {store.store_name}\n"
            f"Business type: {store.business_type or '—'}\n"
            f"Category:      {store.category or '—'}\n"
            f"Tax ID:        {store.tax_id}\n"
            f"Status:        {store.status.value}\n"
            f"Applied at:    {store.created_at.isoformat() if store.created_at else '—'}\n"
        )

    subject = "[Temu Support] Pending seller — review nudge"
    body = (
        f"A seller is waiting on approval and asked us to nudge admin.\n"
        f"---------------------------------------------------------\n"
        f"Applicant:     {user.full_name or '—'}\n"
        f"Email:         {user.email}\n"
        f"Registered:    {user.created_at.isoformat() if hasattr(user, 'created_at') and user.created_at else '—'}\n\n"
        f"{store_lines}\n"
        f"Please review at /admin → Seller Onboard Req.\n"
    )

    subject_line = "Pending seller asked for an approval nudge"
    existing = _find_existing_ticket(db, user.email, "SELLER_PENDING_NUDGE")
    if existing:
        _reopen_existing_ticket(
            existing,
            subject=subject_line,
            new_message=body,
            linked_user_id=user.id,
        )
        db.commit()
        db.refresh(existing)
        ticket = existing
        action = "updated"
    else:
        ticket = SupportTicket(
            from_email=user.email,
            subject=subject_line,
            message=body,
            context="SELLER_PENDING_NUDGE",
            status=SupportTicketStatus.OPEN,
            linked_user_id=user.id,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        action = "created"
    logger.info(
        f"Seller-pending nudge ticket {ticket.id} {action} for user {user.id}"
    )

    send_email(
        to=_support_destination(),
        subject=subject,
        body=body,
        reply_to=user.email,
    )
    return ticket


def reply_to_ticket(
    db: Session,
    ticket_id: UUID,
    admin: User,
    reply_message: str,
) -> SupportTicket:
    """Send the admin's reply over SMTP and append a note on the ticket."""
    ticket = get_ticket(db, ticket_id)
    send_email(
        to=ticket.from_email,
        subject=f"Re: {ticket.subject}",
        body=(
            f"{reply_message}\n\n"
            f"--\n"
            f"Temu Support Team\n"
            f"Ticket #{ticket.id}\n"
        ),
        reply_to=_support_destination(),
    )
    note_line = (
        f"\n[{datetime.now(UTC).isoformat()}] Reply sent by admin {admin.email}:\n"
        f"{reply_message}"
    )
    ticket.admin_notes = (ticket.admin_notes or "") + note_line
    if ticket.status == SupportTicketStatus.OPEN:
        ticket.status = SupportTicketStatus.IN_PROGRESS
    db.commit()
    db.refresh(ticket)
    logger.info(f"Reply sent on ticket {ticket.id} by admin {admin.id}")
    return ticket
