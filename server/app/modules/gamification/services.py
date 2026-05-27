"""Gamification services: mini-games (Fishland/Farmland).

All "today" logic uses calendar dates in UTC so the daily reset is deterministic
across clients. Rewards are minted through the existing user.services.create_reward
so they appear in the same "My Rewards" panel as quests / spin-the-wheel.
"""

from __future__ import annotations

import uuid
from datetime import datetime, UTC
from typing import List

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.gamification import models, schemas
from app.modules.user import schemas as user_schemas
from app.modules.user.services import create_reward


SUPPORTED_GAMES = {"FISHLAND", "FARMLAND"}
POINTS_PER_LEVEL = 10
MAX_LEVEL = 5
DAILY_ACTION_CAP = 5

GAME_COMPLETION_REWARDS = {
    "FISHLAND": {"reward_type": "credit", "reward_value": "$5.00"},
    "FARMLAND": {"reward_type": "coupon", "reward_value": "15% OFF"},
}


def _validate_game_type(game_type: str) -> str:
    gt = game_type.upper()
    if gt not in SUPPORTED_GAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported game type. Allowed: {sorted(SUPPORTED_GAMES)}",
        )
    return gt


def _to_state_response(state: models.MiniGameState) -> schemas.MiniGameStateResponse:
    today = datetime.now(UTC).date()
    actions_today = (
        state.actions_today_count
        if state.actions_today_date == today
        else 0
    )
    return schemas.MiniGameStateResponse(
        game_type=state.game_type,
        level=state.level,
        points=state.points,
        points_per_level=POINTS_PER_LEVEL,
        max_level=MAX_LEVEL,
        is_completed=state.is_completed,
        completed_at=state.completed_at,
        actions_today=actions_today,
        actions_daily_cap=DAILY_ACTION_CAP,
        started_at=state.started_at,
        updated_at=state.updated_at,
    )


def _get_or_create_state(db: Session, user_id, game_type: str) -> models.MiniGameState:
    state = (
        db.query(models.MiniGameState)
        .filter(
            models.MiniGameState.user_id == user_id,
            models.MiniGameState.game_type == game_type,
        )
        .first()
    )
    if state:
        return state

    sp = db.begin_nested()
    try:
        state = models.MiniGameState(user_id=user_id, game_type=game_type)
        db.add(state)
        sp.commit()
    except IntegrityError:
        sp.rollback()
    state = (
        db.query(models.MiniGameState)
        .filter(
            models.MiniGameState.user_id == user_id,
            models.MiniGameState.game_type == game_type,
        )
        .one()
    )
    return state


def list_game_states(db: Session, user_id) -> List[schemas.MiniGameStateResponse]:
    return [
        _to_state_response(_get_or_create_state(db, user_id, gt))
        for gt in sorted(SUPPORTED_GAMES)
    ]


def get_game_state(db: Session, user_id, game_type: str) -> schemas.MiniGameStateResponse:
    gt = _validate_game_type(game_type)
    return _to_state_response(_get_or_create_state(db, user_id, gt))


def perform_action(db: Session, user_id, game_type: str) -> schemas.MiniGameActionResponse:
    gt = _validate_game_type(game_type)
    state = _get_or_create_state(db, user_id, gt)
    today = datetime.now(UTC).date()

    if state.is_completed:
        raise HTTPException(
            status_code=400,
            detail="This round is already completed. Reset to start a new one.",
        )

    if state.actions_today_date != today:
        state.actions_today_count = 0
        state.actions_today_date = today

    if state.actions_today_count >= DAILY_ACTION_CAP:
        raise HTTPException(
            status_code=429,
            detail=f"Daily action limit ({DAILY_ACTION_CAP}) reached. Come back tomorrow!",
        )

    state.actions_today_count += 1
    state.points += 1
    state.updated_at = datetime.now(UTC)

    leveled_up = False
    completed_just_now = False
    reward_type = None
    reward_value = None
    reward_code = None
    message = "Action recorded"

    if state.points >= POINTS_PER_LEVEL:
        if state.level < MAX_LEVEL:
            state.level += 1
            state.points = 0
            leveled_up = True
            message = f"Leveled up to {state.level}!"
        else:
            state.level = MAX_LEVEL
            state.points = POINTS_PER_LEVEL
            state.is_completed = True
            state.completed_at = datetime.now(UTC)
            completed_just_now = True
            reward_cfg = GAME_COMPLETION_REWARDS[gt]
            reward = create_reward(
                db,
                user_id,
                user_schemas.RewardCreate(
                    reward_type=reward_cfg["reward_type"],
                    value=reward_cfg["reward_value"],
                    code=f"GAME-{gt[:4]}-{uuid.uuid4().hex[:5].upper()}",
                ),
            )
            reward_type = reward.reward_type
            reward_value = reward.value
            reward_code = reward.code
            message = f"You completed {gt.title()}! Reward unlocked."

    db.commit()
    db.refresh(state)

    return schemas.MiniGameActionResponse(
        state=_to_state_response(state),
        leveled_up=leveled_up,
        completed_just_now=completed_just_now,
        reward_type=reward_type,
        reward_value=reward_value,
        reward_code=reward_code,
        message=message,
    )


def reset_game(db: Session, user_id, game_type: str) -> schemas.MiniGameStateResponse:
    gt = _validate_game_type(game_type)
    state = _get_or_create_state(db, user_id, gt)
    if not state.is_completed:
        raise HTTPException(
            status_code=400,
            detail="Round still in progress — finish it before starting over.",
        )
    state.level = 1
    state.points = 0
    state.is_completed = False
    state.completed_at = None
    state.actions_today_count = 0
    state.actions_today_date = None
    state.started_at = datetime.now(UTC)
    state.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(state)
    return _to_state_response(state)
