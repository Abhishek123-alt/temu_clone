from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.user import schemas, services, models
from app.modules.product import services as product_services
from app.modules.product import schemas as product_schemas
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
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")
    
    user = services.get_user(db, UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Strictly block inactive users from authenticated routes (except Admins)
    if not user.is_active and user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="Your account is currently inactive. If you are a pending seller, please wait for admin approval."
        )
        
    return user

router = APIRouter()

@router.post("/me/become-seller")
def become_seller(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = services.become_seller(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": "Your application to become a seller has been submitted!", "role": user.role}

@router.get("/me", response_model=schemas.UserProfile)
def read_user_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/me/referral")
def get_my_referral(current_user: models.User = Depends(get_current_user)):
    print(f"DEBUG: User {current_user.email} referral_code: {current_user.referral_code}")
    return {"referral_code": current_user.referral_code}

@router.post("/me/redeem-referral")
def redeem_referral(
    code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.referred_by:
        raise HTTPException(status_code=400, detail="Already redeemed a referral code")
    if current_user.referral_code == code:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")
    
    success = services.process_referral(db, current_user.id, code)
    if not success:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    return {"status": "success", "message": "Referral code redeemed! You got $5 credit!"}

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

@router.post("/payment-methods", response_model=schemas.PaymentMethodResponse)
def create_payment_method(
    payment_in: schemas.PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.add_payment_method(db, current_user.id, payment_in)

@router.get("/payment-methods", response_model=list[schemas.PaymentMethodResponse])
def read_payment_methods(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return services.get_user_payment_methods(db, current_user.id)

@router.put("/payment-methods/{payment_id}", response_model=schemas.PaymentMethodResponse)
def update_payment_method(
    payment_id: UUID,
    payment_in: schemas.PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated = services.update_payment_method(db, current_user.id, payment_id, payment_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return updated

@router.delete("/payment-methods/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_method(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = services.delete_payment_method(db, current_user.id, payment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Payment method not found")
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

@router.get("/wishlist", response_model=List[product_schemas.WishlistItemResponse])
def read_wishlist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return product_services.get_wishlist(db, current_user.id)

@router.post("/wishlist/{product_id}", response_model=product_schemas.WishlistItemResponse)
def add_to_wishlist(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return product_services.add_to_wishlist(db, current_user.id, product_id)

@router.delete("/wishlist/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wishlist(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    product_services.remove_from_wishlist(db, current_user.id, product_id)
    return None

@router.get("/recently-viewed", response_model=List[product_schemas.RecentlyViewedResponse])
def read_recently_viewed(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return product_services.get_recently_viewed(db, current_user.id, limit)

from app.modules.quest import services as quest_services

@router.post("/recently-viewed/{product_id}")
def add_to_recently_viewed(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    product_services.add_to_recently_viewed(db, current_user.id, product_id)
    quest_services.update_quest_progress(db, current_user.id, "PRODUCT_VIEW")
    return {"status": "success"}
