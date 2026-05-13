from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class QuestBase(BaseModel):
    title: str
    description: Optional[str] = None
    requirement_type: str
    requirement_value: int
    reward_value: str
    reward_type: Optional[str] = "credit"
    target_user_role: Optional[str] = "Customer"
    is_active: Optional[bool] = True

class QuestCreate(QuestBase):
    pass

class QuestResponse(QuestBase):
    id: UUID

    class Config:
        from_attributes = True

class UserQuestProgressBase(BaseModel):
    user_id: UUID
    quest_id: UUID
    current_progress: int
    is_completed: bool

class UserQuestProgressResponse(UserQuestProgressBase):
    # Adding quest details for the frontend
    title: str
    description: str
    requirement_value: int
    reward_value: str

    class Config:
        from_attributes = True
