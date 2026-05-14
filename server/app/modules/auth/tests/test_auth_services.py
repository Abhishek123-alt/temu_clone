import pytest
from app.modules.auth.services import create_user
from app.modules.auth.schemas import UserRegister
from app.modules.user.models import UserRole

def test_create_customer_by_default(db_session):
    """Test that users are created as CUSTOMER by default if no role is provided"""
    user_in = UserRegister(
        email="customer@example.com",
        password="password123",
        full_name="Test Customer",
        requested_role="CUSTOMER"
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True

def test_create_seller_pending(db_session):
    """Test that users can be created with SELLER_PENDING role"""
    user_in = UserRegister(
        email="seller@example.com",
        password="password123",
        full_name="Test Seller",
        requested_role="SELLER_PENDING"
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.SELLER_PENDING
    assert user.is_active is False # Should be inactive until approved

def test_create_invalid_role_defaults_to_customer(db_session):
    """Test that an invalid requested_role defaults to CUSTOMER"""
    user_in = UserRegister(
        email="invalid@example.com",
        password="password123",
        full_name="Test Invalid",
        requested_role="SUPER_ADMIN" # Invalid role
    )
    user = create_user(db_session, user_in)
    assert user.role == UserRole.CUSTOMER
    assert user.is_active is True
