from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime

class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None

class CategoryResponse(CategoryBase):
    id: UUID
    class Config:
        from_attributes = True

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None


class CategoryAttributeDefinitionBase(BaseModel):
    key: str
    label: str
    field_type: str = "text"          # "select" | "text" | "number" | "boolean"
    options: Optional[List[str]] = None
    filterable: bool = True
    sort_order: int = 0

class CategoryAttributeDefinitionCreate(CategoryAttributeDefinitionBase):
    pass

class CategoryAttributeDefinitionResponse(CategoryAttributeDefinitionBase):
    id: UUID
    category_id: UUID
    class Config:
        from_attributes = True


class FacetValue(BaseModel):
    value: str
    count: int

class AttributeFacet(BaseModel):
    key: str
    label: str
    field_type: str = "select"
    values: List[FacetValue]

class ProductFacetsResponse(BaseModel):
    attributes: List[AttributeFacet]
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    total: int = 0

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
    sales_count: int = 0
    category_id: UUID
    seller_id: UUID
    attributes: Optional[Dict[str, Any]] = {}

class OptionValueResponse(BaseModel):
    id: UUID
    value: str
    class Config:
        from_attributes = True

class OptionResponse(BaseModel):
    id: UUID
    name: str
    values: List[OptionValueResponse]
    class Config:
        from_attributes = True

class VariantResponse(BaseModel):
    id: UUID
    sku: str
    price: float
    original_price: Optional[float] = None
    stock: int
    option_values: List[OptionValueResponse]
    class Config:
        from_attributes = True

class ProductResponse(ProductBase):
    id: UUID
    images: List[ProductImageResponse]
    options: List[OptionResponse] = []
    variants: List[VariantResponse] = []
    class Config:
        from_attributes = True

class WishlistItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    product_id: UUID
    created_at: datetime
    product: Optional[ProductResponse] = None
    class Config:
        from_attributes = True

class RecentlyViewedResponse(BaseModel):
    id: UUID
    user_id: UUID
    product_id: UUID
    viewed_at: datetime
    product: Optional[ProductResponse] = None
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    original_price: Optional[float] = None
    stock: int
    category_id: UUID
    images: Optional[List[str]] = []
    options: Optional[List["OptionCreate"]] = []
    variants: Optional[List["VariantCreate"]] = []
    attributes: Optional[Dict[str, Any]] = {}

class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    stock: Optional[int] = None
    category_id: Optional[UUID] = None
    images: Optional[List[str]] = None
    options: Optional[List["OptionCreate"]] = None
    variants: Optional[List["VariantCreate"]] = None
    attributes: Optional[Dict[str, Any]] = None

class OptionCreate(BaseModel):
    name: str
    values: List[str]

class VariantCreate(BaseModel):
    sku: str
    price: float
    original_price: Optional[float] = None
    stock: int
    option_values: List[str]
