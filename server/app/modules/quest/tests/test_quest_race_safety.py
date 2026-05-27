"""Regression: two concurrent PRODUCT_VIEW calls (e.g. React StrictMode in dev,
or a flaky network retry) must NOT mint two rewards for the same quest.

The bug we're guarding against:
    req1: read progress (4/5, is_completed=False) -> +1 -> mark complete -> reward A
    req2: read progress (4/5, is_completed=False) -> +1 -> mark complete -> reward B
    DB ends up with two QUEST-* rewards from a single completion.
"""
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.modules.product.models import Category, Product
from app.modules.quest import services as quest_services
from app.modules.quest.models import Quest, UserQuestProgress
from app.modules.user.models import Reward, User, UserRole


@pytest.fixture
def shared_db():
    """A file-backed SQLite DB so multiple threads can open their own
    connections — :memory: connections aren't shared across threads."""
    import tempfile, os
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    yield Session
    engine.dispose()
    os.unlink(path)


def test_concurrent_progress_calls_grant_exactly_one_reward(shared_db):
    Session = shared_db
    setup = Session()

    quest = Quest(
        title="Race Explorer",
        description="View 1 product",
        requirement_type="PRODUCT_VIEW",
        requirement_value=1,  # one view trips completion — easiest race to reproduce
        reward_value="10",
        reward_type="credit",
        target_user_role="CUSTOMER",
        is_active=True,
    )
    user = User(
        email="racer@example.com",
        password_hash="x",
        full_name="Racer",
        role=UserRole.CUSTOMER,
        is_active=True,
        referral_code=uuid.uuid4().hex[:8],
    )
    setup.add_all([quest, user])
    setup.commit()
    setup.refresh(user)
    user_id = user.id
    quest_id = quest.id
    setup.close()

    # Fire N parallel callers, each with its own session — mimics the real
    # request lifecycle where every request gets a fresh DB session.
    def hit():
        s = Session()
        try:
            quest_services.update_quest_progress(s, user_id, "PRODUCT_VIEW")
        finally:
            s.close()

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda _: hit(), range(8)))

    # Verification — single fresh session.
    check = Session()
    try:
        progress = (
            check.query(UserQuestProgress)
            .filter(
                UserQuestProgress.user_id == user_id,
                UserQuestProgress.quest_id == quest_id,
            )
            .one()
        )
        assert progress.is_completed is True
        assert progress.current_progress == 1  # capped at requirement_value

        rewards = (
            check.query(Reward)
            .filter(Reward.user_id == user_id, Reward.code.like("QUEST-%"))
            .all()
        )
        assert len(rewards) == 1, (
            f"Expected exactly 1 quest reward, got {len(rewards)}: "
            f"{[r.code for r in rewards]}"
        )
    finally:
        check.close()
