import random
import string
import uuid

from sqlalchemy.orm import Session, joinedload
from app.modules.user import models, schemas
from uuid import UUID

def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def become_seller(db: Session, user_id: UUID):
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    if db_user.role == models.UserRole.SELLER:
        return db_user

    db_user.role = models.UserRole.SELLER_PENDING
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: UUID):
    return db.query(models.User).filter(models.User.id == user_id).options(
        joinedload(models.User.addresses),
        joinedload(models.User.rewards),
        joinedload(models.User.payment_methods)
    ).first()

def update_user(db: Session, user_id: UUID, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if db_user:
        update_data = user_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def add_address(db: Session, user_id: UUID, address_in: schemas.AddressCreate):
    from fastapi import HTTPException
    count = db.query(models.Address).filter(models.Address.user_id == user_id).count()
    if count >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 addresses allowed")

    if address_in.is_default:
        # Reset other default addresses
        db.query(models.Address).filter(models.Address.user_id == user_id).update({"is_default": False})
    
    db_address = models.Address(**address_in.dict(), user_id=user_id)
    db.add(db_address)
    db.commit()
    db.refresh(db_address)
    return db_address

def update_address(db: Session, user_id: UUID, address_id: UUID, address_in: schemas.AddressCreate):
    db_address = db.query(models.Address).filter(models.Address.id == address_id, models.Address.user_id == user_id).first()
    if not db_address:
        return None
    
    if address_in.is_default:
        db.query(models.Address).filter(models.Address.user_id == user_id).update({"is_default": False})
    
    update_data = address_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_address, key, value)
        
    db.commit()
    db.refresh(db_address)
    return db_address

def get_user_addresses(db: Session, user_id: UUID):
    return db.query(models.Address).filter(models.Address.user_id == user_id).all()

def delete_address(db: Session, user_id: UUID, address_id: UUID):
    from fastapi import HTTPException
    db_address = db.query(models.Address).filter(models.Address.id == address_id, models.Address.user_id == user_id).first()
    if not db_address:
        return False

    # If this is the default and the user has other addresses, require them
    # to promote another one to default first.
    if db_address.is_default:
        other_count = db.query(models.Address).filter(
            models.Address.user_id == user_id,
            models.Address.id != address_id,
        ).count()
        if other_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete default address. Set another address as default first.",
            )

    db.delete(db_address)
    db.commit()
    return True

def add_payment_method(db: Session, user_id: UUID, payment_in: schemas.PaymentMethodCreate):
    from fastapi import HTTPException
    count = db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).count()
    if count >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 payment methods allowed")

    if payment_in.is_default:
        db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).update({"is_default": False})
    
    db_payment = models.PaymentMethod(**payment_in.dict(), user_id=user_id)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

def get_user_payment_methods(db: Session, user_id: UUID):
    return db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).all()

def delete_payment_method(db: Session, user_id: UUID, payment_id: UUID):
    db_payment = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == payment_id, models.PaymentMethod.user_id == user_id).first()
    if db_payment:
        db.delete(db_payment)
        db.commit()
        return True
    return False

def update_payment_method(db: Session, user_id: UUID, payment_id: UUID, payment_in: schemas.PaymentMethodCreate):
    db_payment = db.query(models.PaymentMethod).filter(models.PaymentMethod.id == payment_id, models.PaymentMethod.user_id == user_id).first()
    if not db_payment:
        return None
    
    if payment_in.is_default:
        db.query(models.PaymentMethod).filter(models.PaymentMethod.user_id == user_id).update({"is_default": False})
    
    update_data = payment_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_payment, key, value)
        
    db.commit()
    db.refresh(db_payment)
    return db_payment

def create_reward(db: Session, user_id: UUID, reward_in: schemas.RewardCreate):
    db_reward = models.Reward(**reward_in.dict(), user_id=user_id)
    db.add(db_reward)
    db.commit()
    db.refresh(db_reward)
    return db_reward

def process_referral(db: Session, new_user_id: UUID, referral_code: str):
    referrer = db.query(models.User).filter(models.User.referral_code == referral_code).first()
    if not referrer:
        return False

    # Update new user's referred_by
    new_user = get_user(db, new_user_id)
    if not new_user:
        return False
        
    # Prevent double rewards if already referred
    if new_user.referred_by:
        return True

    new_user.referred_by = referrer.id
    db.commit()

    # Reward Referrer
    create_reward(db, referrer.id, schemas.RewardCreate(
        reward_type="credit",
        value="$5 Referral Bonus",
        code=f"REF-GIVER-{uuid.uuid4().hex[:6].upper()}"
    ))

    # Reward New User
    create_reward(db, new_user_id, schemas.RewardCreate(
        reward_type="coupon",
        value="10% Welcome Discount",
        code=f"REF-JOIN-{uuid.uuid4().hex[:6].upper()}"
    ))
    
    return True

def get_user_rewards(db: Session, user_id: UUID):
    return db.query(models.Reward).filter(models.Reward.user_id == user_id).all()
