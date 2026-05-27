"""Full coverage of the support flow — public contact endpoint, admin guard,
list/get/patch, reactivate-user, reply."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.db.session import get_db
from app.main import app
from app.modules.support import services
from app.modules.support.models import SupportTicket, SupportTicketStatus
from app.modules.support.schemas import SupportRequest
from app.modules.user.models import User, UserRole


client = TestClient(app)


@pytest.fixture(autouse=True)
def _override_db(db_session, monkeypatch):
    """Pipe every endpoint through the in-memory test session and silence SMTP.

    Without this the FastAPI app would hit the real Postgres URL in .env and
    every call to send_email would try to talk to Gmail.
    """
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    monkeypatch.setattr(services, "send_email", lambda **_: None)
    # Reset the in-memory rate limiter so tests don't poison each other.
    services._rate_state.clear()
    yield
    app.dependency_overrides.clear()


def _make_user(db_session, *, email, role=UserRole.CUSTOMER, is_active=True):
    user = User(
        email=email.lower(),
        password_hash="x",
        full_name="Test " + role.value,
        role=role,
        is_active=is_active,
        referral_code=uuid.uuid4().hex[:8],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers(user_id):
    token = security.create_access_token(subject=user_id)
    return {"Authorization": f"Bearer {token}"}


# ---------- public endpoint ----------

def test_contact_creates_ticket_and_links_user(db_session):
    user = _make_user(db_session, email="customer@example.com", is_active=False)

    resp = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "customer@example.com",
            "subject": "Reactivate me",
            "message": "Account got deactivated",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    ticket_id = uuid.UUID(body["ticket_id"])

    row = db_session.query(SupportTicket).filter(SupportTicket.id == ticket_id).one()
    assert row.status == SupportTicketStatus.OPEN
    assert row.linked_user_id == user.id
    assert row.context == "ACCOUNT_DEACTIVATED"


def test_contact_with_same_email_and_context_updates_existing(db_session):
    """Submitting a second request with the same (email, context) must update
    the original ticket in place — no duplicate row, message appended,
    status reset to OPEN, original id + created_at preserved."""
    _make_user(db_session, email="repeat@example.com", is_active=False)

    first = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "repeat@example.com",
            "subject": "Help me",
            "message": "First attempt",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )
    assert first.status_code == 200
    first_id = uuid.UUID(first.json()["ticket_id"])
    original = db_session.query(SupportTicket).filter(SupportTicket.id == first_id).one()
    original_created_at = original.created_at

    # Admin marks it resolved and writes a note we expect to keep.
    original.status = SupportTicketStatus.RESOLVED
    original.admin_notes = "We replied via email"
    db_session.commit()

    second = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "repeat@example.com",
            "subject": "Still locked out",
            "message": "Second attempt — still need help",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )
    assert second.status_code == 200
    assert uuid.UUID(second.json()["ticket_id"]) == first_id  # same ticket

    rows = (
        db_session.query(SupportTicket)
        .filter(SupportTicket.from_email == "repeat@example.com")
        .all()
    )
    assert len(rows) == 1
    updated = rows[0]
    assert updated.status == SupportTicketStatus.OPEN  # reopened
    assert updated.subject == "Still locked out"
    assert "First attempt" in updated.message
    assert "Second attempt" in updated.message
    assert "Resubmitted on" in updated.message
    assert updated.admin_notes == "We replied via email"  # preserved
    assert updated.created_at == original_created_at  # not bumped


def test_contact_different_context_creates_separate_ticket(db_session):
    """Uniqueness is on (email, context). Different contexts are separate."""
    _make_user(db_session, email="multi@example.com", is_active=False)

    a = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "multi@example.com",
            "subject": "deactivated",
            "message": "msg a",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )
    b = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "multi@example.com",
            "subject": "other",
            "message": "msg b",
            "context": "OTHER_CONTEXT",
        },
    )
    assert a.status_code == b.status_code == 200
    assert a.json()["ticket_id"] != b.json()["ticket_id"]

    count = (
        db_session.query(SupportTicket)
        .filter(SupportTicket.from_email == "multi@example.com")
        .count()
    )
    assert count == 2


def test_contact_email_normalized_lowercase_for_uniqueness(db_session):
    """Same email in different casing should still hit the same ticket."""
    _make_user(db_session, email="case@example.com", is_active=False)

    a = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "Case@Example.com",
            "subject": "first",
            "message": "first msg",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )
    b = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "CASE@example.com",
            "subject": "second",
            "message": "second msg",
            "context": "ACCOUNT_DEACTIVATED",
        },
    )
    assert a.json()["ticket_id"] == b.json()["ticket_id"]


def test_contact_persists_even_for_unknown_email(db_session):
    resp = client.post(
        "/api/v1/support/contact",
        json={
            "from_email": "ghost@example.com",
            "subject": "I have no account",
            "message": "Just curious",
        },
    )
    assert resp.status_code == 200
    row = db_session.query(SupportTicket).first()
    assert row.linked_user_id is None


def test_contact_rate_limited_after_threshold(db_session):
    payload = {
        "from_email": "spammer@example.com",
        "subject": "Hello",
        "message": "Repeat send",
    }
    for _ in range(services._RATE_MAX_REQUESTS):
        ok = client.post("/api/v1/support/contact", json=payload)
        assert ok.status_code == 200
    blocked = client.post("/api/v1/support/contact", json=payload)
    assert blocked.status_code == 429


# ---------- admin guard ----------

def test_admin_endpoints_reject_non_admin(db_session):
    customer = _make_user(db_session, email="customer2@example.com")
    resp = client.get(
        "/api/v1/support/admin/tickets", headers=_auth_headers(customer.id)
    )
    assert resp.status_code == 403


def test_admin_endpoints_reject_unauthenticated():
    resp = client.get("/api/v1/support/admin/tickets")
    # FastAPI's OAuth2PasswordBearer returns 401 with no auth header.
    assert resp.status_code == 401


# ---------- admin list / detail / patch ----------

def test_admin_can_list_and_filter_tickets(db_session):
    admin = _make_user(db_session, email="admin@example.com", role=UserRole.ADMIN)
    db_session.add_all([
        SupportTicket(
            from_email="a@example.com", subject="s1", message="m1",
            status=SupportTicketStatus.OPEN,
        ),
        SupportTicket(
            from_email="b@example.com", subject="s2", message="m2",
            status=SupportTicketStatus.RESOLVED,
        ),
    ])
    db_session.commit()

    all_resp = client.get(
        "/api/v1/support/admin/tickets", headers=_auth_headers(admin.id)
    )
    assert all_resp.status_code == 200
    assert len(all_resp.json()) == 2

    open_resp = client.get(
        "/api/v1/support/admin/tickets?status_filter=OPEN",
        headers=_auth_headers(admin.id),
    )
    assert open_resp.status_code == 200
    items = open_resp.json()
    assert len(items) == 1
    assert items[0]["status"] == "OPEN"


def test_admin_open_count(db_session):
    admin = _make_user(db_session, email="admin3@example.com", role=UserRole.ADMIN)
    db_session.add_all([
        SupportTicket(from_email="a@x", subject="s", message="m", status=SupportTicketStatus.OPEN),
        SupportTicket(from_email="b@x", subject="s", message="m", status=SupportTicketStatus.OPEN),
        SupportTicket(from_email="c@x", subject="s", message="m", status=SupportTicketStatus.RESOLVED),
    ])
    db_session.commit()
    resp = client.get(
        "/api/v1/support/admin/tickets/open-count",
        headers=_auth_headers(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json() == {"count": 2}


def test_admin_patch_marks_resolved(db_session):
    admin = _make_user(db_session, email="admin4@example.com", role=UserRole.ADMIN)
    ticket = SupportTicket(
        from_email="x@x", subject="s", message="m", status=SupportTicketStatus.OPEN,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    resp = client.patch(
        f"/api/v1/support/admin/tickets/{ticket.id}",
        headers=_auth_headers(admin.id),
        json={"status": "RESOLVED", "admin_notes": "Handled offline"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "RESOLVED"
    assert body["admin_notes"] == "Handled offline"
    db_session.refresh(ticket)
    assert ticket.resolved_at is not None
    assert ticket.resolved_by_admin_id == admin.id


# ---------- reactivate-user shortcut ----------

def test_reactivate_user_flips_is_active_and_resolves(db_session):
    admin = _make_user(db_session, email="admin5@example.com", role=UserRole.ADMIN)
    blocked = _make_user(db_session, email="blocked@example.com", is_active=False)
    ticket = SupportTicket(
        from_email="blocked@example.com",
        subject="reactivate me",
        message="please",
        context="ACCOUNT_DEACTIVATED",
        status=SupportTicketStatus.OPEN,
        linked_user_id=blocked.id,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    resp = client.post(
        f"/api/v1/support/admin/tickets/{ticket.id}/reactivate-user",
        headers=_auth_headers(admin.id),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "RESOLVED"
    assert "reactivated" in body["admin_notes"].lower()

    db_session.refresh(blocked)
    assert blocked.is_active is True


def test_reactivate_user_refuses_unlinked_ticket(db_session):
    admin = _make_user(db_session, email="admin6@example.com", role=UserRole.ADMIN)
    ticket = SupportTicket(
        from_email="ghost@example.com",
        subject="lost",
        message="nothing",
        status=SupportTicketStatus.OPEN,
        linked_user_id=None,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    resp = client.post(
        f"/api/v1/support/admin/tickets/{ticket.id}/reactivate-user",
        headers=_auth_headers(admin.id),
    )
    assert resp.status_code == 400


# ---------- reply ----------

def test_reply_appends_note_and_moves_to_in_progress(db_session, monkeypatch):
    admin = _make_user(db_session, email="admin7@example.com", role=UserRole.ADMIN)
    ticket = SupportTicket(
        from_email="user@example.com",
        subject="halp",
        message="m",
        status=SupportTicketStatus.OPEN,
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    sent = {}
    def fake_send(**kw):
        sent.update(kw)
    monkeypatch.setattr(services, "send_email", fake_send)

    resp = client.post(
        f"/api/v1/support/admin/tickets/{ticket.id}/reply",
        headers=_auth_headers(admin.id),
        json={"message": "We've taken a look — your account is restored."},
    )
    assert resp.status_code == 200
    assert sent["to"] == "user@example.com"
    assert "restored" in sent["body"]

    db_session.refresh(ticket)
    assert ticket.status == SupportTicketStatus.IN_PROGRESS
    assert "Reply sent" in (ticket.admin_notes or "")


def test_notify_admin_creates_pending_nudge_ticket(db_session, monkeypatch):
    """A SELLER_PENDING user can ping admin → ticket lands in /admin Support
    with context SELLER_PENDING_NUDGE and an email goes out."""
    seller = _make_user(
        db_session,
        email="pending-seller@example.com",
        role=UserRole.SELLER_PENDING,
        is_active=False,
    )

    sent = {}
    monkeypatch.setattr(services, "send_email", lambda **kw: sent.update(kw))

    resp = client.post(
        "/api/v1/support/notify-admin",
        json={"from_email": "pending-seller@example.com"},
    )
    assert resp.status_code == 200
    ticket_id = uuid.UUID(resp.json()["ticket_id"])

    row = db_session.query(SupportTicket).filter(SupportTicket.id == ticket_id).one()
    assert row.context == "SELLER_PENDING_NUDGE"
    assert row.linked_user_id == seller.id
    assert row.status == SupportTicketStatus.OPEN
    assert "Pending seller" in sent["subject"]
    assert seller.email in sent["body"]


def test_notify_admin_resubmit_updates_existing_ticket(db_session, monkeypatch):
    """A pending seller can click Notify Admin multiple times — the second
    click should reopen + append onto the same ticket, not create a duplicate."""
    seller = _make_user(
        db_session,
        email="pending-nudge@example.com",
        role=UserRole.SELLER_PENDING,
        is_active=False,
    )
    monkeypatch.setattr(services, "send_email", lambda **_: None)

    first = client.post(
        "/api/v1/support/notify-admin",
        json={"from_email": "pending-nudge@example.com"},
    )
    assert first.status_code == 200
    first_id = uuid.UUID(first.json()["ticket_id"])

    # Admin handles it, marks resolved, then the seller clicks Notify again.
    t = db_session.query(SupportTicket).filter(SupportTicket.id == first_id).one()
    t.status = SupportTicketStatus.RESOLVED
    db_session.commit()

    second = client.post(
        "/api/v1/support/notify-admin",
        json={"from_email": "pending-nudge@example.com"},
    )
    assert second.status_code == 200
    assert uuid.UUID(second.json()["ticket_id"]) == first_id

    nudges = (
        db_session.query(SupportTicket)
        .filter(SupportTicket.linked_user_id == seller.id)
        .filter(SupportTicket.context == "SELLER_PENDING_NUDGE")
        .all()
    )
    assert len(nudges) == 1
    assert nudges[0].status == SupportTicketStatus.OPEN
    assert "Resubmitted on" in nudges[0].message


def test_notify_admin_rejects_non_pending_account(db_session):
    """An already-active customer or seller can't use this endpoint to spam admin."""
    _make_user(db_session, email="active@example.com", is_active=True)
    resp = client.post(
        "/api/v1/support/notify-admin",
        json={"from_email": "active@example.com"},
    )
    assert resp.status_code == 400


def test_notify_admin_rejects_unknown_email(db_session):
    resp = client.post(
        "/api/v1/support/notify-admin",
        json={"from_email": "ghost@example.com"},
    )
    assert resp.status_code == 400


def test_submit_service_links_admin_users_too(db_session):
    """Sanity: linking is purely by email match, including for admin/seller roles."""
    admin = _make_user(db_session, email="admin-link@example.com", role=UserRole.ADMIN)
    ticket = services.submit_support_request(
        db_session,
        SupportRequest(
            from_email="admin-link@example.com",
            subject="hello",
            message="testing link",
        ),
        client_ip="127.0.0.1",
    )
    assert ticket.linked_user_id == admin.id
