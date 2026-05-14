import pytest
from app.modules.user import services, models
from uuid import uuid4

def test_become_seller_success(db_session):
    """Test that a CUSTOMER can transition to SELLER_PENDING"""
    user = models.User(
        id=uuid4(),
        email="test@example.com",
        password_hash="hashed",
        full_name="Test User",
        role=models.UserRole.CUSTOMER
    )
    db_session.add(user)
    db_session.commit()

    updated_user = services.become_seller(db_session, user.id)
    assert updated_user.role == models.UserRole.SELLER_PENDING

def test_become_seller_already_seller(db_session):
    """Test that a SELLER remains a SELLER when becoming a seller"""
    user = models.User(
        id=uuid4(),
        email=f"seller_{uuid4().hex[:8]}@example.com",
        password_hash="hashed",
        full_name="Existing Seller",
        role=models.UserRole.SELLER
    )
    db_session.add(user)
    db_session.commit()

    updated_user = services.become_seller(db_session, user.id)
    assert updated_user.role == models.UserRole.SELLER

def test_become_seller_not_found(db_session):
    """Test that become_seller returns None for non-existent user"""
    result = services.become_seller(db_session, uuid4())
    assert result is None
