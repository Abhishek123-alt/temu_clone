import logging
import os
import secrets
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.user.models import User, UserRole, AuthProvider
from app.modules.auth.schemas import UserRegister
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

def get_user_by_email(db: Session, email: str):
    logger.info(f"Looking up user by email: {email.lower()}")
    return db.query(User).filter(User.email == email.lower()).first()

from app.modules.user.services import generate_referral_code, process_referral
# ... (keep existing imports)

def create_user(db: Session, user_in: UserRegister):
    logger.info(f"Creating new user: {user_in.email.lower()}")
    hashed_password = get_password_hash(user_in.password)

    # Generate unique referral code
    referral_code = generate_referral_code()
    while db.query(User).filter(User.referral_code == referral_code).first():
        referral_code = generate_referral_code()

    # Determine role: allow requested_role but only if it's SELLER_PENDING or CUSTOMER
    role = UserRole.CUSTOMER
    if user_in.requested_role == "SELLER_PENDING":
        role = UserRole.SELLER_PENDING
    elif user_in.requested_role == "CUSTOMER":
        role = UserRole.CUSTOMER

    db_user = User(
        email=user_in.email.lower(),
        password_hash=hashed_password,
        full_name=user_in.full_name,
        phone=user_in.phone,
        referral_code=referral_code,
        role=role,
        is_active=False if role == UserRole.SELLER_PENDING else True,
        provider=AuthProvider.LOCAL,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def authenticate_user(db: Session, email: str, password: str):
    logger.info(f"Authenticating user: {email.lower()}")
    user = get_user_by_email(db, email.lower())
    if not user:
        logger.warning(f"User not found: {email.lower()}")
        return False

    # Surface the account-state error BEFORE the password check so an inactive
    # user always sees "your account is inactive — contact support" instead of
    # the generic "Incorrect email or password". Trade-off: this lets someone
    # who guesses an email learn that the account is deactivated, but the same
    # disclosure already exists via the register endpoint ("User with this
    # email already exists"), so we're not opening new ground.
    if not user.is_active and user.role != UserRole.ADMIN:
        logger.warning(f"Login blocked for inactive user: {email.lower()}")
        if user.role == UserRole.SELLER_PENDING:
            detail = {
                "code": "SELLER_APPLICATION_PENDING",
                "message": (
                    "Your seller application is still under review. "
                    "We'll email you as soon as it's approved — usually within 1–2 business days."
                ),
            }
        else:
            detail = {
                "code": "ACCOUNT_DEACTIVATED",
                "message": (
                    "Your account has been deactivated and access is currently restricted. "
                    "If you believe this is a mistake, please contact our support team to restore access."
                ),
            }
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    is_valid = verify_password(password, user.password_hash)
    if not is_valid:
        logger.warning(f"Invalid password for user: {email.lower()}")
        return False

    logger.info(f"User authenticated successfully: {email.lower()}")
    return user


def verify_google_id_token(credential: str) -> dict:
    """Verify a Google ID token (`credential` from Google Identity Services) and
    return the decoded payload. Raises HTTPException on any failure so callers
    never see a partially trusted payload.

    The GOOGLE_CLIENT_ID env var must be set — otherwise the audience check
    cannot run and we refuse the request rather than silently accepting tokens
    minted for another app.
    """
    google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not google_client_id:
        logger.error("GOOGLE_CLIENT_ID is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server.",
        )

    # Import lazily so the auth module can still be imported in environments
    # where google-auth is not installed (e.g. lightweight test runners).
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    try:
        payload = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), google_client_id
        )
    except ValueError as exc:
        logger.warning(f"Google token verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token.",
        )

    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token issuer.",
        )
    if not payload.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account does not expose an email address.",
        )
    if payload.get("email_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Google email is not verified.",
        )
    return payload


def get_or_create_google_user(db: Session, google_payload: dict) -> User:
    """Look up the user by their Google email; create a CUSTOMER if missing.

    For brand-new accounts we set a random unguessable password hash — the user
    has no password to log in with directly, only the Google flow. They can
    request a password reset later to set one.
    """
    email = google_payload["email"].lower()
    full_name = google_payload.get("name") or email.split("@")[0]
    google_sub = google_payload.get("sub")

    user = get_user_by_email(db, email)
    if user:
        # Link the Google sub if we haven't seen it yet — happens when a
        # password-signup user later clicks "Continue with Google" on the same
        # email. Leave their provider as LOCAL though: the account still has
        # a real password the user can use, we just *also* accept Google now.
        if google_sub and not user.provider_subject:
            user.provider_subject = google_sub
            db.commit()
            db.refresh(user)
        # Mirror authenticate_user: surface account-state issues before issuing a token.
        if not user.is_active and user.role != UserRole.ADMIN:
            if user.role == UserRole.SELLER_PENDING:
                detail = {
                    "code": "SELLER_APPLICATION_PENDING",
                    "message": (
                        "Your seller application is still under review. "
                        "We'll email you as soon as it's approved — usually within 1–2 business days."
                    ),
                }
            else:
                detail = {
                    "code": "ACCOUNT_DEACTIVATED",
                    "message": (
                        "Your account has been deactivated and access is currently restricted. "
                        "If you believe this is a mistake, please contact our support team to restore access."
                    ),
                }
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        return user

    from app.modules.user.services import generate_referral_code

    referral_code = generate_referral_code()
    while db.query(User).filter(User.referral_code == referral_code).first():
        referral_code = generate_referral_code()

    random_password = secrets.token_urlsafe(32)
    new_user = User(
        email=email,
        password_hash=get_password_hash(random_password),
        full_name=full_name,
        referral_code=referral_code,
        role=UserRole.CUSTOMER,
        is_active=True,
        provider=AuthProvider.GOOGLE,
        provider_subject=google_sub,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Created new user via Google sign-in: {email}")
    return new_user
