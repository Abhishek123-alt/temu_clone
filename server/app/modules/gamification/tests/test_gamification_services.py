import pytest
from datetime import datetime, UTC
from uuid import uuid4

from fastapi import HTTPException

from app.modules.gamification import services
from app.modules.user.models import User, UserRole, Reward


def _make_user(db, email="player@example.com"):
    user = User(
        id=uuid4(),
        email=email,
        password_hash="hashed",
        full_name="Player",
        role=UserRole.CUSTOMER,
        spins_left=0,
    )
    db.add(user)
    db.commit()
    return user


def test_play_action_increments_points(db_session):
    user = _make_user(db_session, email="fish@example.com")
    res = services.perform_action(db_session, user.id, "FISHLAND")
    assert res.state.points == 1
    assert res.state.level == 1
    assert res.state.actions_today == 1
    assert res.completed_just_now is False


def test_level_up_after_threshold(db_session):
    user = _make_user(db_session, email="lvl@example.com")
    state = services._get_or_create_state(db_session, user.id, "FARMLAND")
    state.points = services.POINTS_PER_LEVEL - 1
    state.actions_today_count = 0
    state.actions_today_date = datetime.now(UTC).date()
    db_session.commit()

    res = services.perform_action(db_session, user.id, "FARMLAND")
    assert res.leveled_up is True
    assert res.state.level == 2
    assert res.state.points == 0


def test_completion_grants_reward(db_session):
    user = _make_user(db_session, email="win@example.com")
    state = services._get_or_create_state(db_session, user.id, "FISHLAND")
    state.level = services.MAX_LEVEL
    state.points = services.POINTS_PER_LEVEL - 1
    state.actions_today_count = 0
    state.actions_today_date = datetime.now(UTC).date()
    db_session.commit()

    res = services.perform_action(db_session, user.id, "FISHLAND")
    assert res.completed_just_now is True
    assert res.state.is_completed is True
    assert res.reward_code is not None and res.reward_code.startswith("GAME-FISH-")

    reward = db_session.query(Reward).filter_by(user_id=user.id).first()
    assert reward is not None
    assert reward.value == services.GAME_COMPLETION_REWARDS["FISHLAND"]["reward_value"]


def test_daily_cap_blocks_excess_actions(db_session):
    user = _make_user(db_session, email="cap@example.com")
    state = services._get_or_create_state(db_session, user.id, "FISHLAND")
    state.actions_today_count = services.DAILY_ACTION_CAP
    state.actions_today_date = datetime.now(UTC).date()
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        services.perform_action(db_session, user.id, "FISHLAND")
    assert exc.value.status_code == 429


def test_reset_only_allowed_when_completed(db_session):
    user = _make_user(db_session, email="reset@example.com")
    services.perform_action(db_session, user.id, "FARMLAND")
    with pytest.raises(HTTPException) as exc:
        services.reset_game(db_session, user.id, "FARMLAND")
    assert exc.value.status_code == 400

    state = services._get_or_create_state(db_session, user.id, "FARMLAND")
    state.is_completed = True
    state.completed_at = datetime.now(UTC)
    db_session.commit()
    fresh = services.reset_game(db_session, user.id, "FARMLAND")
    assert fresh.level == 1
    assert fresh.points == 0
    assert fresh.is_completed is False


def test_invalid_game_type_rejected(db_session):
    user = _make_user(db_session, email="bad@example.com")
    with pytest.raises(HTTPException) as exc:
        services.perform_action(db_session, user.id, "DRAGONLAND")
    assert exc.value.status_code == 400


def test_list_game_states_returns_all_supported(db_session):
    user = _make_user(db_session, email="list@example.com")
    states = services.list_game_states(db_session, user.id)
    types = {s.game_type for s in states}
    assert types == services.SUPPORTED_GAMES
