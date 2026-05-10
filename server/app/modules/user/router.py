from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.user import schemas, services, models
from app.core import security
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from uuid import UUID
import uuid

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)) -> models.User:
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=403, detail="Could not validate credentials")
    except JWTError:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    
    user = services.get_user(db, UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

router = APIRouter()

@router.get("/me", response_model=schemas.UserProfile)
def read_user_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=schemas.UserProfile)
def update_user_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.update_user(db, current_user.id, user_update)

@router.post("/addresses", response_model=schemas.AddressResponse)
def create_address(
    address_in: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.add_address(db, current_user.id, address_in)

@router.get("/addresses", response_model=list[schemas.AddressResponse])
def read_addresses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.get_user_addresses(db, current_user.id)

@router.put("/addresses/{address_id}", response_model=schemas.AddressResponse)
def update_address(
    address_id: UUID,
    address_in: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.update_address(db, current_user.id, address_id, address_in)

@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = services.delete_address(db, current_user.id, address_id)
    if not success:
        raise HTTPException(status_code=404, detail="Address not found")
    return None

@router.post("/rewards", response_model=schemas.RewardResponse)
def claim_reward(
    reward_in: schemas.RewardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.create_reward(db, current_user.id, reward_in)

@router.get("/rewards", response_model=list[schemas.RewardResponse])
def read_rewards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.get_user_rewards(db, current_user.id)

@router.post("/use-spin")
def use_spin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.spins_left <= 0:
        raise HTTPException(status_code=400, detail="No spins left")
    
    # Pre-defined prizes (matching frontend)
    prizes = [
        {'label': '10% OFF', 'value': 'coupon10'},
        {'label': '$5 CREDIT', 'value': 'credit5'},
        {'label': 'FREE GIFT', 'value': 'gift'},
        {'label': 'TRY AGAIN', 'value': 'none'},
        {'label': '20% OFF', 'value': 'coupon20'},
        {'label': '$10 CREDIT', 'value': 'credit10'},
        {'label': 'BOGO DEAL', 'value': 'bogo'},
        {'label': 'FREE SHIP', 'value': 'freeship'},
    ]
    
    import random
    prize_index = random.randint(0, len(prizes) - 1)
    won_prize = prizes[prize_index]
    
    current_user.spins_left -= 1
    
    # Save reward if not 'none'
    reward_id = None
    if won_prize['value'] != 'none':
        db_reward = models.Reward(
            user_id=current_user.id,
            reward_type='coupon' if 'coupon' in won_prize['value'] else 
                        'credit' if 'credit' in won_prize['value'] else won_prize['value'],
            value=won_prize['label'],
            code=f"SPIN-{uuid.uuid4().hex[:6].upper()}"
        )
        db.add(db_reward)
        db.flush()
        reward_id = db_reward.id

    db.commit()
    db.refresh(current_user)
    
    return {
        "spins_left": current_user.spins_left,
        "prize_index": prize_index,
        "prize_label": won_prize['label'],
        "reward_id": reward_id
    }
