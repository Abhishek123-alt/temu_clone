from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from app.modules.order.models import OrderStatus

class OrderItemBase(BaseModel):
    product_id: UUID
    quantity: int
    price: float

class OrderItemResponse(OrderItemBase):
    id: UUID
    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    shipping_address: str
    total_amount: float

class OrderCreate(OrderBase):
    reward_id: Optional[UUID] = None

class OrderResponse(OrderBase):
    id: UUID
    user_id: UUID
    status: OrderStatus
    created_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True
