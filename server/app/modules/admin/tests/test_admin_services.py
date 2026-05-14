import pytest
from app.modules.user import models as user_models
from app.modules.store import models as store_models
from uuid import uuid4

def test_review_seller_approve(db_session, pending_application):
    """Test approving a seller application"""
    from app.modules.admin.router import review_seller_application, ReviewDecision
    user, store = pending_application

    # Call as a regular function, providing all required arguments
    review_seller_application(
        user_id=user.id,
        review_in=ReviewDecision(decision="approve"),
        db=db_session
    )

    db_session.refresh(user)
    db_session.refresh(store)
    assert user.role == user_models.UserRole.SELLER
    assert store.status == store_models.StoreStatus.ACTIVE

def test_review_seller_reject(db_session, pending_application):
    """Test rejecting a seller application"""
    from app.modules.admin.router import review_seller_application, ReviewDecision
    user, store = pending_application

    review_seller_application(
        user_id=user.id,
        review_in=ReviewDecision(decision="reject"),
        db=db_session
    )

    db_session.refresh(user)
    db_session.refresh(store)
    assert user.role == user_models.UserRole.CUSTOMER
    assert store.status == store_models.StoreStatus.REJECTED

def test_review_seller_invalid_decision(db_session, pending_application):
    """Test that an invalid decision raises an error"""
    from app.modules.admin.router import review_seller_application, ReviewDecision
    from fastapi import HTTPException
    user, _ = pending_application

    with pytest.raises(HTTPException) as excinfo:
        review_seller_application(
            user_id=user.id,
            review_in=ReviewDecision(decision="maybe"),
            db=db_session
        )
    assert excinfo.value.status_code == 400

@pytest.fixture
def pending_application(db_session):
    user = user_models.User(
        id=uuid4(),
        email=f"pending_{uuid4().hex[:8]}@example.com",
        password_hash="hashed",
        full_name="Pending Seller",
        role=user_models.UserRole.SELLER_PENDING
    )
    store = store_models.Store(
        id=uuid4(),
        user_id=user.id,
        store_name="Pending Store",
        tax_id="TAX123",
        warehouse_address="Addr",
        status=store_models.StoreStatus.PENDING
    )
    db_session.add(user)
    db_session.add(store)
    db_session.commit()
    return user, store
