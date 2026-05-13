from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.modules.product.schemas import ProductResponse

class FlashSaleBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_active: bool = True

class FlashSaleCreate(FlashSaleBase):
    pass

class FlashSaleProductBase(BaseModel):
    product_id: UUID
    discounted_price: float

class FlashSaleProductCreate(FlashSaleProductBase):
    pass

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
