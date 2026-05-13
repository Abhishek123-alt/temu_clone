from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.quest import models, schemas, services
from app.modules.user.services import create_reward
from app.modules.user.router import get_current_user
from uuid import UUID
import uuid

router = APIRouter()

@router.get("/my-progress", response_model=List[schemas.UserQuestProgressResponse])
def get_my_quest_progress(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Fetch all active quests suitable for this user's role
    user_role_str = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    
    quests = db.query(models.Quest).filter(
        models.Quest.is_active == True,
        (models.Quest.target_user_role == "All") | (models.Quest.target_user_role == user_role_str)
    ).all()

    results = []
    for quest in quests:
        prog = db.query(models.UserQuestProgress).filter(
            models.UserQuestProgress.user_id == current_user.id,
            models.UserQuestProgress.quest_id == quest.id
        ).first()

        results.append({
            "user_id": current_user.id,
            "quest_id": quest.id,
            "current_progress": prog.current_progress if prog else 0,
            "is_completed": prog.is_completed if prog else False,
            "title": quest.title,
            "description": quest.description,
            "requirement_value": quest.requirement_value,
            "reward_value": quest.reward_value
        })
    return results

@router.get("/", response_model=List[schemas.QuestResponse])
def get_all_quests(db: Session = Depends(get_db)):
    return db.query(models.Quest).all()

@router.post("/progress")
def update_quest_progress(
    user_id: UUID,
    requirement_type: str,
    db: Session = Depends(get_db)
):
    services.update_quest_progress(db, user_id, requirement_type)
    return {"status": "success"}
