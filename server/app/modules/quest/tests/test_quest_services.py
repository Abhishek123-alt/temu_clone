import pytest
from app.modules.quest import services, models
from app.modules.user.models import User, UserRole
from uuid import uuid4

def test_update_quest_progress(db_session):
    # Create User
    user = User(
        id=uuid4(),
        email="quester@example.com",
        password_hash="hashed",
        full_name="Quester",
        role=UserRole.CUSTOMER
    )
    db_session.add(user)
    
    # Create Quest
    quest = models.Quest(
        title="View Products",
        requirement_type="PRODUCT_VIEW",
        requirement_value=2,
        reward_value="10",
        reward_type="credit",
        target_user_role="CUSTOMER"
    )
    db_session.add(quest)
    db_session.commit()
    
    # First view
    services.update_quest_progress(db_session, user.id, "PRODUCT_VIEW")
    progress = db_session.query(models.UserQuestProgress).filter_by(user_id=user.id, quest_id=quest.id).first()
    assert progress is not None
    assert progress.current_progress == 1
    assert progress.is_completed is False
    
    # Second view
    services.update_quest_progress(db_session, user.id, "PRODUCT_VIEW")
    db_session.refresh(progress)
    assert progress.current_progress == 2
    assert progress.is_completed is True
    
    # Check if reward was created
    from app.modules.user.models import Reward
    reward = db_session.query(Reward).filter_by(user_id=user.id).first()
    assert reward is not None
    assert "QUEST-" in reward.code
