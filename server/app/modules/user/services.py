from sqlalchemy.orm import Session
from app.modules.user import models, schemas
from uuid import UUID

def get_user(db: Session, user_id: UUID):
    return db.query(models.User).filter(models.User.id == user_id).first()

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
    db_address = db.query(models.Address).filter(models.Address.id == address_id, models.Address.user_id == user_id).first()
    if db_address:
        db.delete(db_address)
        db.commit()
        return True
    return False

def create_reward(db: Session, user_id: UUID, reward_in: schemas.RewardCreate):
    db_reward = models.Reward(**reward_in.dict(), user_id=user_id)
    db.add(db_reward)
    db.commit()
    db.refresh(db_reward)
    return db_reward

def get_user_rewards(db: Session, user_id: UUID):
    return db.query(models.Reward).filter(models.Reward.user_id == user_id).all()
