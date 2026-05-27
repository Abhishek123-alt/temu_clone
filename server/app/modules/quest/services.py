from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.modules.quest import models
from app.modules.quest import schemas as quest_schemas
from app.modules.user import schemas as user_schemas
from app.modules.user.services import create_reward
from uuid import UUID
import uuid
from datetime import datetime, UTC

def update_quest_progress(db: Session, user_id: UUID, requirement_type: str):
    """Increment progress for all matching active quests.

    Race-safety: React StrictMode + parallel client triggers can fire two
    near-simultaneous calls for the same event. The naive read-modify-write
    pattern (read is_completed, increment, set, create reward) would let both
    requests cross the threshold and mint two rewards. We avoid that with:
      1. An atomic CAS increment that only matches rows where is_completed
         is still False — concurrent callers may both increment (overshoot is
         capped below).
      2. An atomic CAS flip on (is_completed=False, progress >= threshold).
         At most one concurrent caller wins; only the winner grants the reward.
    """
    from app.modules.user.models import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    user_role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)

    quests = db.query(models.Quest).filter(
        models.Quest.requirement_type == requirement_type,
        models.Quest.is_active == True,
        (models.Quest.target_user_role == "All") | (models.Quest.target_user_role == user_role_str)
    ).all()

    now = datetime.now(UTC)

    for quest in quests:
        # Ensure a progress row exists. (user_id, quest_id) is the composite PK
        # so concurrent first-inserts collapse to a single row; the loser
        # rolls back its savepoint and re-reads.
        progress = db.query(models.UserQuestProgress).filter(
            models.UserQuestProgress.user_id == user_id,
            models.UserQuestProgress.quest_id == quest.id
        ).first()
        if not progress:
            sp = db.begin_nested()
            try:
                db.add(models.UserQuestProgress(
                    user_id=user_id,
                    quest_id=quest.id,
                    current_progress=0,
                ))
                sp.commit()
            except IntegrityError:
                sp.rollback()
            progress = db.query(models.UserQuestProgress).filter(
                models.UserQuestProgress.user_id == user_id,
                models.UserQuestProgress.quest_id == quest.id
            ).one()

        if progress.is_completed:
            continue

        # DAILY_LOGIN: cap to one increment per calendar day.
        if requirement_type == "DAILY_LOGIN":
            if progress.last_updated_at and progress.last_updated_at.date() == now.date() and progress.current_progress > 0:
                continue

        # Atomic increment, gated by is_completed=False at the SQL layer.
        inc = db.query(models.UserQuestProgress).filter(
            models.UserQuestProgress.user_id == user_id,
            models.UserQuestProgress.quest_id == quest.id,
            models.UserQuestProgress.is_completed == False,
        ).update(
            {
                "current_progress": models.UserQuestProgress.current_progress + 1,
                "last_updated_at": now,
            },
            synchronize_session=False,
        )
        if inc == 0:
            continue  # another concurrent caller already completed it

        # CAS the completion flip: at most one concurrent caller observes
        # is_completed=False AND progress past threshold, so at most one
        # reward is granted. Also caps current_progress to the requirement
        # so the UI doesn't render "6/5" after an overshoot.
        flipped = db.query(models.UserQuestProgress).filter(
            models.UserQuestProgress.user_id == user_id,
            models.UserQuestProgress.quest_id == quest.id,
            models.UserQuestProgress.is_completed == False,
            models.UserQuestProgress.current_progress >= quest.requirement_value,
        ).update(
            {
                "is_completed": True,
                "current_progress": quest.requirement_value,
            },
            synchronize_session=False,
        )

        if flipped == 1:
            reward_val = quest.reward_value
            if quest.reward_type == "credit" and not reward_val.startswith("$"):
                reward_val = f"${reward_val}"
            create_reward(db, user_id, user_schemas.RewardCreate(
                reward_type=quest.reward_type,
                value=reward_val,
                code=f"QUEST-{uuid.uuid4().hex[:6].upper()}",
            ))

    db.commit()
