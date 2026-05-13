from sqlalchemy.orm import Session
from app.modules.quest import models
from app.modules.quest import schemas as quest_schemas
from app.modules.user import schemas as user_schemas
from app.modules.user.services import create_reward
from uuid import UUID
import uuid
from datetime import datetime, UTC

def update_quest_progress(db: Session, user_id: UUID, requirement_type: str):
    # Increment progress for all active quests of this type that match the user's role
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
    
    for quest in quests:
        progress = db.query(models.UserQuestProgress).filter(
            models.UserQuestProgress.user_id == user_id,
            models.UserQuestProgress.quest_id == quest.id
        ).first()

        if not progress:
            progress = models.UserQuestProgress(
                user_id=user_id,
                quest_id=quest.id,
                current_progress=0
            )
            db.add(progress)
            db.flush()

        if not progress.is_completed:
            # Check if this is a DAILY_LOGIN and if it was already updated today
            now = datetime.now(UTC)
            
            if requirement_type == "DAILY_LOGIN":
                if progress.last_updated_at and progress.last_updated_at.date() == now.date() and progress.current_progress > 0:
                    continue # Already logged in today
            
            progress.current_progress += 1
            progress.last_updated_at = now
            
            if progress.current_progress >= quest.requirement_value:
                progress.is_completed = True
                # Grant Reward
                reward_val = quest.reward_value
                if quest.reward_type == "credit" and not reward_val.startswith("$"):
                    reward_val = f"${reward_val}"
                
                create_reward(db, user_id, user_schemas.RewardCreate(
                    reward_type=quest.reward_type,
                    value=reward_val,
                    code=f"QUEST-{uuid.uuid4().hex[:6].upper()}"
                ))

    db.commit()
