import logging
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from app.db.session import get_db
from app.core import security
from fastapi.security import OAuth2PasswordBearer
from app.modules.store import models, schemas
from app.modules.user import models as user_models
from jose import jwt, JWTError
from uuid import UUID

logger = logging.getLogger(__name__)
reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)) -> user_models.User:
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    user = db.query(user_models.User).filter(user_models.User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

router = APIRouter()

@router.post("/application", response_model=schemas.StoreResponse)
def submit_store_application(
    application_in: schemas.StoreCreate,
    db: Session = Depends(get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    # Only users with SELLER_PENDING role can submit application
    if current_user.role != user_models.UserRole.SELLER_PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must apply to become a seller first"
        )

    # Check if store already exists for this user
    existing_store = db.query(models.Store).filter(models.Store.user_id == current_user.id).first()
    if existing_store:
        raise HTTPException(status_code=400, detail="Store application already submitted")

    db_store = models.Store(
        **application_in.dict(),
        user_id=current_user.id,
        status=models.StoreStatus.PENDING
    )
    db.add(db_store)
    db.commit()
    db.refresh(db_store)
    return db_store

@router.patch("/application/draft", response_model=schemas.StoreResponse)
def save_store_draft(
    draft_in: schemas.StoreUpdate,
    db: Session = Depends(get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    if current_user.role != user_models.UserRole.SELLER_PENDING:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db_store = db.query(models.Store).filter(models.Store.user_id == current_user.id).first()
    if not db_store:
        # If no store exists, we create one in PENDING state as a draft
        # This requires minimum fields from StoreCreate, which we can't guarantee in a partial update.
        # For simplicity, we only allow updating existing drafts.
        raise HTTPException(status_code=404, detail="No draft found. Please start a full application first.")

    update_data = draft_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_store, key, value)

    db.commit()
    db.refresh(db_store)
    return db_store
