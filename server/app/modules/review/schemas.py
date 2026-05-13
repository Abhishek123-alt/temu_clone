from typing import List, Optional
from pydantic import BaseModel, Field, conint
from uuid import UUID
from datetime import datetime

class ReviewCreate(BaseModel):
    product_id: UUID
    rating: conint(ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)

class ReviewRead(BaseModel):
    id: UUID
    user_id: UUID
    product_id: UUID
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewWithUser(ReviewRead):
    user_name: str
    user_avatar: Optional[str]
