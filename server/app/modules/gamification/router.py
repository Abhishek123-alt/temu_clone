from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.gamification import schemas, services
from app.modules.user.models import User
from app.modules.user.router import get_current_user

router = APIRouter()


@router.get("/games", response_model=List[schemas.MiniGameStateResponse])
def list_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return services.list_game_states(db, current_user.id)


@router.get("/games/{game_type}", response_model=schemas.MiniGameStateResponse)
def get_game(
    game_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return services.get_game_state(db, current_user.id, game_type)


@router.post("/games/{game_type}/action", response_model=schemas.MiniGameActionResponse)
def play_game(
    game_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return services.perform_action(db, current_user.id, game_type)


@router.post("/games/{game_type}/reset", response_model=schemas.MiniGameStateResponse)
def reset_game(
    game_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return services.reset_game(db, current_user.id, game_type)
