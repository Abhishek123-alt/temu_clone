from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from app.modules.product.schemas import ProductResponse

class CartItemBase(BaseModel):
    product_id: UUID
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

class CartItemResponse(BaseModel):
    id: UUID
    product: ProductResponse
    quantity: int

    class Config:
        from_attributes = True

class CartResponse(BaseModel):
    id: UUID
    items: List[CartItemResponse]
    
    class Config:
        from_attributes = True
