from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class CategoryBase(BaseModel):
    name: str
    slug: str
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None

class CategoryResponse(CategoryBase):
    id: UUID
    class Config:
        from_attributes = True

class ProductImageBase(BaseModel):
    url: str
    is_main: bool = False

class ProductImageResponse(ProductImageBase):
    id: UUID
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    stock: int
    rating: float = 0.0
    review_count: int = 0
    category_id: UUID
    seller_id: UUID

class ProductResponse(ProductBase):
    id: UUID
    images: List[ProductImageResponse]
    class Config:
        from_attributes = True
