from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.auth import schemas, services
from app.core import security
from app.modules.user import services as user_services

router = APIRouter()

@router.post("/register", response_model=schemas.UserRegisterResponse)
def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    user = services.get_user_by_email(db, user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists."
        )
    # Create the new user first
    new_user = services.create_user(db, user_in)
    # If a referral code was supplied, attempt to process it
    if user_in.referral_code:
        success = user_services.process_referral(db, new_user.id, user_in.referral_code.strip())
        if not success:
            # Invalid code – you can choose to abort registration or ignore.
            # Here we abort with a clear message.
            raise HTTPException(
                status_code=400,
                detail="Invalid referral code."
            )
    # Refresh to load relationships (rewards, etc.)
    db.refresh(new_user)
    
    # Generate token so they can finish onboarding immediately
    access_token = security.create_access_token(subject=new_user.id)
    
    return {
        "user": new_user,
        "access_token": access_token,
        "token_type": "bearer"
    }


from app.modules.quest import services as quest_services

@router.post("/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = services.authenticate_user(db, user_in.email, user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    quest_services.update_quest_progress(db, user.id, "DAILY_LOGIN")

    access_token = security.create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google", response_model=schemas.Token)
def google_login(payload: schemas.GoogleLoginRequest, db: Session = Depends(get_db)):
    google_payload = services.verify_google_id_token(payload.credential)
    user = services.get_or_create_google_user(db, google_payload)

    # If this is a fresh signup with a referral code, attempt to process it.
    # process_referral is idempotent — if already linked, it returns True
    # without granting another reward.
    if payload.referral_code:
        user_services.process_referral(db, user.id, payload.referral_code.strip())

    quest_services.update_quest_progress(db, user.id, "DAILY_LOGIN")
    access_token = security.create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}
