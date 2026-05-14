import logging
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.modules.user.models import User, UserRole
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
        is_active=False if role == UserRole.SELLER_PENDING else True
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
    
    is_valid = verify_password(password, user.password_hash)
    if not is_valid:
        logger.warning(f"Invalid password for user: {email.lower()}")
        return False
    
    logger.info(f"User authenticated successfully: {email.lower()}")
    
    # Block login for inactive users (unless Admin)
    if not user.is_active and user.role != UserRole.ADMIN:
        logger.warning(f"Login blocked for inactive user: {email.lower()}")
        error_msg = "Your account is currently inactive. "
        if user.role == UserRole.SELLER_PENDING:
            error_msg += "Your seller application is still under review."
        else:
            error_msg += "Please contact support for more information."
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg
        )
        
    return user
