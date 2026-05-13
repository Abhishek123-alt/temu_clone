from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import List, Optional, Any
from app.modules.order.models import OrderStatus, OrderActor

class OrderItemBase(BaseModel):
    product_id: Optional[UUID] = None
    quantity: int
    price: float

class OrderItemResponse(OrderItemBase):
    id: UUID
    product_title: Optional[str] = None
    product_image: Optional[str] = None
    class Config:
        from_attributes = True

class OrderEventResponse(BaseModel):
    id: int
    from_status: Optional[OrderStatus] = None
    to_status: OrderStatus
    actor: OrderActor
    reason: Optional[str] = None
    metadata_json: dict = {}
    created_at: datetime
    class Config:
        from_attributes = True

class ShipmentResponse(BaseModel):
    id: UUID
    carrier: str
    tracking_number: str
    tracking_url: Optional[str] = None
    status: str
    estimated_delivery: Optional[datetime] = None
    last_location: Optional[str] = None
    history: List[dict] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class ShipmentCreate(BaseModel):
    carrier: str
    tracking_number: str
    tracking_url: Optional[str] = None

class ReturnItemBase(BaseModel):
    order_item_id: UUID
    quantity: int
    condition: Optional[str] = None

class ReturnResponse(BaseModel):
    id: UUID
    order_id: UUID
    status: str
    reason: str
    refund_amount: float
    items: List[ReturnItemBase] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    shipping_address: str
    total_amount: float
    billing_address: Optional[str] = None

class OrderCreate(OrderBase):
    reward_id: Optional[UUID] = None
    payment_method_id: Optional[UUID] = None

class OrderResponse(OrderBase):
    id: UUID
    user_id: UUID
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]
    events: List[OrderEventResponse] = []
    shipments: List[ShipmentResponse] = []
    returns: List[ReturnResponse] = []

    class Config:
        from_attributes = True

class ReturnDetailResponse(ReturnResponse):
    order: Optional[OrderResponse] = None
    customer_name: Optional[str] = None
    seller_name: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    reason: Optional[str] = None
    metadata: dict = {}

class ReturnCreate(BaseModel):
    reason: str
    items: Optional[List[ReturnItemBase]] = []

OrderResponse.model_rebuild()
ReturnDetailResponse.model_rebuild()
