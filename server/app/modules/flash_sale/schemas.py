from pydantic import BaseModel, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime, UTC
from app.modules.product.schemas import ProductResponse

class FlashSaleBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_active: bool = True

class FlashSaleProductBase(BaseModel):
    product_id: UUID
    discounted_price: float

class FlashSaleProductCreate(FlashSaleProductBase):
    pass

class FlashSaleCreate(FlashSaleBase):
    products: Optional[List[FlashSaleProductCreate]] = []

    @field_validator('start_time')
    @classmethod
    def start_time_must_be_future(cls, v: datetime) -> datetime:
        if v.replace(tzinfo=UTC) < datetime.now(UTC):
            raise ValueError('Start time must be in the future')
        return v

    @field_validator('end_time')
    @classmethod
    def end_time_must_be_after_start(cls, v: datetime, info) -> datetime:
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('End time must be after start time')
        return v

class FlashSaleProductResponse(FlashSaleProductBase):
    id: UUID
    product: ProductResponse

    class Config:
        from_attributes = True

class FlashSaleResponse(FlashSaleBase):
    id: UUID
    products: List[FlashSaleProductResponse] = []

    class Config:
        from_attributes = True
