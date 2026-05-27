"""End-to-end-ish tests for the /auth router.

Calls the router functions directly with a transactional db_session — the same
shape as test_flash_sale_router.py. For Google sign-in we monkeypatch the
underlying google-auth verifier so the test never reaches Google's servers but
still exercises every line of our code: the schema parsing, the service call,
the get-or-create branch, JWT issuance, and the quest tick.
"""
import pytest
from unittest.mock import patch
from app.modules.auth import router, schemas
from app.modules.auth.services import create_user
from app.modules.auth.schemas import UserRegister
from app.modules.user.models import User, UserRole
from app.core import security


def _google_payload(email="brand-new@example.com", name="Brand New", verified=True):
    return {
        "iss": "https://accounts.google.com",
        "sub": "google-sub-xyz",
        "email": email,
        "email_verified": verified,
        "name": name,
    }


def test_google_login_creates_new_user_and_returns_token(db_session, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    with patch(
        "google.oauth2.id_token.verify_oauth2_token",
        return_value=_google_payload(),
    ):
        resp = router.google_login(
            schemas.GoogleLoginRequest(credential="fake-google-jwt"),
            db_session,
        )

    assert resp["token_type"] == "bearer"
    assert resp["access_token"]

    # Token must decode to the newly created user's id.
    from jose import jwt

    decoded = jwt.decode(resp["access_token"], security.SECRET_KEY, algorithms=[security.ALGORITHM])
    user = db_session.query(User).filter(User.email == "brand-new@example.com").first()
    assert user is not None
    assert str(user.id) == decoded["sub"]
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True


def test_google_login_for_existing_user_does_not_duplicate(db_session, monkeypatch):
    create_user(
        db_session,
        UserRegister(
            email="returning@example.com",
            password="password123",
            full_name="Returning",
            requested_role="CUSTOMER",
        ),
    )
    before = db_session.query(User).filter(User.email == "returning@example.com").count()
    assert before == 1

    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    with patch(
        "google.oauth2.id_token.verify_oauth2_token",
        return_value=_google_payload(email="returning@example.com"),
    ):
        resp = router.google_login(
            schemas.GoogleLoginRequest(credential="fake"),
            db_session,
        )

    after = db_session.query(User).filter(User.email == "returning@example.com").count()
    assert after == 1
    assert resp["access_token"]


def test_google_login_without_client_id_returns_503(db_session, monkeypatch):
    """The /google endpoint must not "accept" tokens when no client id is set —
    that would be a free entry point for any forged token."""
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    with pytest.raises(Exception) as exc_info:
        router.google_login(
            schemas.GoogleLoginRequest(credential="anything"),
            db_session,
        )
    # FastAPI HTTPException — we don't import it here to keep the test
    # decoupled, but assert on the .status_code attribute.
    assert getattr(exc_info.value, "status_code", None) == 503
