import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.modules.auth.services import (
    authenticate_user,
    create_user,
    get_or_create_google_user,
    verify_google_id_token,
)
from app.modules.auth.schemas import UserRegister
from app.modules.user.models import UserRole, AuthProvider

def test_create_customer_by_default(db_session):
    """Test that users are created as CUSTOMER by default if no role is provided"""
    user_in = UserRegister(
        email="customer@example.com",
        password="password123",
        full_name="Test Customer",
        requested_role="CUSTOMER"
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True

def test_create_seller_pending(db_session):
    """Test that users can be created with SELLER_PENDING role"""
    user_in = UserRegister(
        email="seller@example.com",
        password="password123",
        full_name="Test Seller",
        requested_role="SELLER_PENDING"
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.SELLER_PENDING
    assert user.is_active is False # Should be inactive until approved

def test_create_invalid_role_defaults_to_customer(db_session):
    """Test that an invalid requested_role defaults to CUSTOMER"""
    user_in = UserRegister(
        email="invalid@example.com",
        password="password123",
        full_name="Test Invalid",
        requested_role="SUPER_ADMIN" # Invalid role
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True


def test_authenticate_deactivated_user_returns_structured_403(db_session):
    """A deactivated CUSTOMER trying to log in with the correct password
    must hit a 403 with the ACCOUNT_DEACTIVATED code — that code is what the
    LoginPage uses to decide whether to surface the Contact Support panel."""
    user = create_user(
        db_session,
        UserRegister(
            email="blocked@example.com",
            password="password123",
            full_name="Blocked User",
            requested_role="CUSTOMER",
        ),
    )
    user.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        authenticate_user(db_session, "blocked@example.com", "password123")

    assert exc.value.status_code == 403
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail["code"] == "ACCOUNT_DEACTIVATED"
    assert "support" in exc.value.detail["message"].lower()


def test_authenticate_deactivated_user_with_wrong_password_still_shows_deactivation(db_session):
    """A deactivated user who types the wrong password must still see the
    deactivation message (not 'Incorrect email or password'). The user-facing
    bug this fixes: inactive accounts looked indistinguishable from typos."""
    user = create_user(
        db_session,
        UserRegister(
            email="blocked2@example.com",
            password="password123",
            full_name="Blocked User",
            requested_role="CUSTOMER",
        ),
    )
    user.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        authenticate_user(db_session, "blocked2@example.com", "totally-wrong")

    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "ACCOUNT_DEACTIVATED"


def test_authenticate_seller_pending_returns_pending_code(db_session):
    """A SELLER_PENDING user is is_active=False by design until reviewed.
    They should get a distinct code so the UI shows a calm 'under review'
    message instead of the red 'Account Restricted' panel."""
    create_user(
        db_session,
        UserRegister(
            email="pending-seller@example.com",
            password="password123",
            full_name="Pending Seller",
            requested_role="SELLER_PENDING",
        ),
    )

    with pytest.raises(HTTPException) as exc:
        authenticate_user(db_session, "pending-seller@example.com", "password123")

    assert exc.value.status_code == 403
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail["code"] == "SELLER_APPLICATION_PENDING"


def test_authenticate_wrong_password_returns_false(db_session):
    """Wrong password must return False (caller turns into 401) — not raise.
    If this regresses, the LoginPage will never see 'Incorrect email or password'."""
    create_user(
        db_session,
        UserRegister(
            email="active@example.com",
            password="password123",
            full_name="Active User",
            requested_role="CUSTOMER",
        ),
    )

    result = authenticate_user(db_session, "active@example.com", "wrong-password")
    assert result is False


# ---- Google sign-in -----------------------------------------------------


def _google_payload(email="g-user@example.com", name="Google User", verified=True):
    """Build a fake Google ID-token payload mirroring the real claim set."""
    return {
        "iss": "https://accounts.google.com",
        "sub": "google-sub-123",
        "email": email,
        "email_verified": verified,
        "name": name,
    }


def test_get_or_create_google_user_creates_active_customer(db_session):
    """First-time Google sign-in must create a CUSTOMER who is immediately
    active — otherwise we'd block them on the login page they just used to
    sign in. They also need a referral_code so the rest of the app's
    referral machinery works. The row must be tagged provider=GOOGLE +
    provider_subject=<google sub> so admins can later distinguish social
    accounts from password ones."""
    user = get_or_create_google_user(db_session, _google_payload())
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True
    assert user.email == "g-user@example.com"
    assert user.full_name == "Google User"
    assert user.referral_code  # must be assigned so referral flows work later
    assert user.provider == AuthProvider.GOOGLE
    assert user.provider_subject == "google-sub-123"


def test_password_signup_is_tagged_local(db_session):
    """Regression guard: a normal email/password signup must persist as
    provider=LOCAL. If this regresses, every account looks like a Google
    account in admin reports."""
    user = create_user(
        db_session,
        UserRegister(
            email="pw-user@example.com",
            password="password123",
            full_name="Pw User",
            requested_role="CUSTOMER",
        ),
    )
    assert user.provider == AuthProvider.LOCAL
    assert user.provider_subject is None


def test_get_or_create_google_user_reuses_existing_user(db_session):
    """If the email already exists (from a password signup), we link to that
    account instead of creating a duplicate row — otherwise the unique email
    constraint would 500 and the user would be stranded. The original LOCAL
    provider stays (the user still has a working password), but we backfill
    provider_subject so we know which Google identity they linked."""
    existing = create_user(
        db_session,
        UserRegister(
            email="dup@example.com",
            password="password123",
            full_name="Dup User",
            requested_role="CUSTOMER",
        ),
    )

    user = get_or_create_google_user(db_session, _google_payload(email="dup@example.com"))
    assert user.id == existing.id
    assert user.provider == AuthProvider.LOCAL
    assert user.provider_subject == "google-sub-123"


def test_get_or_create_google_user_blocks_deactivated(db_session):
    """A deactivated account must NOT be silently re-activated by a Google
    sign-in — that would let a banned user back in by clicking one button."""
    existing = create_user(
        db_session,
        UserRegister(
            email="banned@example.com",
            password="password123",
            full_name="Banned",
            requested_role="CUSTOMER",
        ),
    )
    existing.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        get_or_create_google_user(db_session, _google_payload(email="banned@example.com"))
    assert exc.value.status_code == 403
    assert exc.value.detail["code"] == "ACCOUNT_DEACTIVATED"


def test_verify_google_id_token_missing_client_id(monkeypatch):
    """Without GOOGLE_CLIENT_ID we refuse to verify — accepting a token whose
    audience we can't pin would let an attacker replay a Google token minted
    for a different app."""
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    with pytest.raises(HTTPException) as exc:
        verify_google_id_token("any-token")
    assert exc.value.status_code == 503


def test_verify_google_id_token_invalid_token(monkeypatch):
    """A token that the google-auth library rejects must surface as 401, not 500."""
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    with patch(
        "google.oauth2.id_token.verify_oauth2_token",
        side_effect=ValueError("bad token"),
    ):
        with pytest.raises(HTTPException) as exc:
            verify_google_id_token("not-a-real-token")
    assert exc.value.status_code == 401


def test_verify_google_id_token_unverified_email(monkeypatch):
    """Google can return tokens with email_verified=false (rare, but real for
    some workspace setups). We refuse those — we'd otherwise let a stranger
    claim someone else's email by signing up with a matching gmail."""
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    fake = _google_payload(verified=False)
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=fake):
        with pytest.raises(HTTPException) as exc:
            verify_google_id_token("token")
    assert exc.value.status_code == 403


def test_verify_google_id_token_happy_path_returns_payload(monkeypatch):
    """End-to-end happy path: env set, token valid → we get the decoded payload back."""
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    fake = _google_payload()
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=fake):
        out = verify_google_id_token("token")
    assert out["email"] == "g-user@example.com"
