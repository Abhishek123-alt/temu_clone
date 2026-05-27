from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Date,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, UTC

from app.db.session import Base


class MiniGameState(Base):
    """Per-user state for one mini-game (FISHLAND, FARMLAND).

    The game has a small number of levels; each level needs `points_per_level`
    actions to clear. When the user clears max level, a reward is minted and
    the round is marked completed. The user can then "restart" for a new round.
    `actions_today_*` caps daily taps so the game lasts more than one session.
    """

    __tablename__ = "mini_game_states"
    __table_args__ = (
        UniqueConstraint("user_id", "game_type", name="uq_user_game_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_type = Column(String, nullable=False)
    level = Column(Integer, nullable=False, default=1)
    points = Column(Integer, nullable=False, default=0)
    is_completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime, nullable=True)
    actions_today_count = Column(Integer, nullable=False, default=0)
    actions_today_date = Column(Date, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC))

    user = relationship("User")
