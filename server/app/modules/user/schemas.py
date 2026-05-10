from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class AddressBase(BaseModel):
    street: str
    city: str
    state: str
    zip: str
    country: str
    is_default: bool = False

class AddressCreate(AddressBase):
    pass

class AddressResponse(AddressBase):
    id: UUID
    user_id: UUID

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None

class UserProfile(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: Optional[str]
    role: str
    spins_left: int
    created_at: datetime
    addresses: List[AddressResponse] = []
    rewards: List["RewardResponse"] = []

    class Config:
        from_attributes = True

class RewardBase(BaseModel):
    reward_type: str
    value: str
    code: str

class RewardCreate(RewardBase):
    pass

class RewardResponse(RewardBase):
    id: UUID
    user_id: UUID
    is_used: bool
    created_at: datetime

    class Config:
        from_attributes = True
