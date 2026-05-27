from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MiniGameStateResponse(BaseModel):
    game_type: str
    level: int
    points: int
    points_per_level: int
    max_level: int
    is_completed: bool
    completed_at: Optional[datetime] = None
    actions_today: int
    actions_daily_cap: int
    started_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MiniGameActionResponse(BaseModel):
    state: MiniGameStateResponse
    leveled_up: bool
    completed_just_now: bool
    reward_type: Optional[str] = None
    reward_value: Optional[str] = None
    reward_code: Optional[str] = None
    message: str
