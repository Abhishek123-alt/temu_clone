from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from app.modules.store.models import StoreStatus

class StoreCreate(BaseModel):
    store_name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    tax_id: str = Field(..., min_length=5)
    business_type: str = Field(..., description="e.g., Sole Proprietorship, LLC, Corporation")
    category: Optional[str] = Field(None, max_length=100)
    warehouse_address: str = Field(..., min_length=10)

class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    tax_id: Optional[str] = None
    business_type: Optional[str] = None
    category: Optional[str] = None
    warehouse_address: Optional[str] = None

class StoreResponse(BaseModel):
    id: UUID
    store_name: str
    description: Optional[str]
    logo_url: Optional[str]
    banner_url: Optional[str]
    status: StoreStatus

    class Config:
        from_attributes = True

class StoreAdminResponse(StoreResponse):
    tax_id: str
    business_type: str
    warehouse_address: str
    user_id: UUID
