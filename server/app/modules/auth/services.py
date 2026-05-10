import logging
from sqlalchemy.orm import Session
from app.modules.user.models import User
from app.modules.auth.schemas import UserRegister
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

def get_user_by_email(db: Session, email: str):
    logger.info(f"Looking up user by email: {email.lower()}")
    return db.query(User).filter(User.email == email.lower()).first()

def create_user(db: Session, user_in: UserRegister):
    logger.info(f"Creating new user: {user_in.email.lower()}")
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email.lower(),
        password_hash=hashed_password,
        full_name=user_in.full_name,
        phone=user_in.phone
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
    return user
