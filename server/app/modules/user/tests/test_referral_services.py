import pytest
from app.modules.user import services, models
from app.modules.user.models import User, UserRole
from uuid import uuid4

def test_process_referral_success(db_session):
    # Create Referrer
    referrer = User(
        id=uuid4(),
        email="referrer@example.com",
        password_hash="hashed",
        full_name="Referrer",
        role=UserRole.CUSTOMER,
        referral_code="REF12345"
    )
    db_session.add(referrer)
    
    # Create New User
    new_user = User(
        id=uuid4(),
        email="new_user@example.com",
        password_hash="hashed",
        full_name="New User",
        role=UserRole.CUSTOMER,
        referral_code="NEW54321"
    )
    db_session.add(new_user)
    db_session.commit()
    
    # Process Referral
    success = services.process_referral(db_session, new_user.id, "REF12345")
    assert success is True
    
    # Verify both got rewards
    referrer_rewards = services.get_user_rewards(db_session, referrer.id)
    new_user_rewards = services.get_user_rewards(db_session, new_user.id)
    
    assert len(referrer_rewards) == 1
    assert "REF-GIVER-" in referrer_rewards[0].code
    assert referrer_rewards[0].value == "$5 Referral Bonus"
    
    assert len(new_user_rewards) == 1
    assert "REF-JOIN-" in new_user_rewards[0].code
    assert new_user_rewards[0].value == "10% Welcome Discount"
    
    # Verify new user links to referrer
    db_session.refresh(new_user)
    assert new_user.referred_by == referrer.id

def test_process_referral_invalid_code(db_session):
    new_user = User(
        id=uuid4(),
        email="lonely@example.com",
        password_hash="hashed",
        full_name="Lonely",
        role=UserRole.CUSTOMER,
        referral_code="LONELY12"
    )
    db_session.add(new_user)
    db_session.commit()
    
    success = services.process_referral(db_session, new_user.id, "NONEXISTENT")
    assert success is False
