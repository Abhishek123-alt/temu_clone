from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, UTC
from app.db.session import Base

class Quest(Base):
    __tablename__ = "quests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(String)
    requirement_type = Column(String, nullable=False) # e.g., 'PRODUCT_VIEW', 'ADD_TO_CART'
    requirement_value = Column(Integer, nullable=False) # e.g., 5
    reward_value = Column(String, nullable=False) # e.g., "50" or "10%"
    reward_type = Column(String, default="credit") # e.g., "coupon", "credit", "freeship"
    target_user_role = Column(String, default="Customer") # e.g., "Customer", "Seller", "All"
    is_active = Column(Boolean, default=True)

    progressions = relationship("UserQuestProgress", back_populates="quest", cascade="all, delete-orphan")

class UserQuestProgress(Base):
    __tablename__ = "user_quest_progress"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    quest_id = Column(UUID(as_uuid=True), ForeignKey("quests.id"), primary_key=True)
    current_progress = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    last_updated_at = Column(DateTime, default=lambda: datetime.now(UTC))

    user = relationship("User")
    quest = relationship("Quest", back_populates="progressions")
