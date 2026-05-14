import pytest
from app.modules.store import models, schemas
from app.modules.user import models as user_models
from uuid import uuid4

def test_submit_store_application_success(db_session, seller_pending_user):
    """Test that a SELLER_PENDING user can successfully submit a store application"""
    from app.modules.store.router import submit_store_application

    app_data = schemas.StoreCreate(
        store_name="Test Store",
        description="A test store",
        tax_id="TAX12345",
        business_type="Individual",
        warehouse_address="123 Test St, City, Country"
    )

    # Mocking the depends(get_current_user) by passing the user directly
    store = submit_store_application(
        application_in=app_data,
        db=db_session,
        current_user=seller_pending_user
    )

    assert store.store_name == "Test Store"
    assert store.status == models.StoreStatus.PENDING
    assert store.user_id == seller_pending_user.id

def test_submit_store_application_wrong_role(db_session):
    """Test that a CUSTOMER cannot submit a store application"""
    from app.modules.store.router import submit_store_application
    from fastapi import HTTPException

    customer = user_models.User(
        id=uuid4(),
        email="customer@example.com",
        password_hash="hashed",
        full_name="Customer",
        role=user_models.UserRole.CUSTOMER
    )
    db_session.add(customer)
    db_session.commit()

    app_data = schemas.StoreCreate(
        store_name="Test Store",
        tax_id="TAX12345",
        business_type="Individual",
        warehouse_address="123 Test St"
    )

    with pytest.raises(HTTPException) as excinfo:
        submit_store_application(
            application_in=app_data,
            db=db_session,
            current_user=customer
        )
    assert excinfo.value.status_code == 403

def test_submit_store_application_already_exists(db_session, seller_pending_user):
    """Test that a user cannot submit multiple applications"""
    from app.modules.store.router import submit_store_application
    from fastapi import HTTPException

    app_data = schemas.StoreCreate(
        store_name="First Store",
        tax_id="TAX12345",
        business_type="Individual",
        warehouse_address="123 Test St"
    )

    submit_store_application(
        application_in=app_data,
        db=db_session,
        current_user=seller_pending_user
    )

    with pytest.raises(HTTPException) as excinfo:
        submit_store_application(
            application_in=app_data,
            db=db_session,
            current_user=seller_pending_user
        )
    assert excinfo.value.status_code == 400

def test_review_seller_application_approve(db_session, seller_pending_user):
    """Test that an admin can approve a seller application"""
    from app.modules.admin.router import review_seller_application
    from app.modules.admin.router import ReviewDecision

    # Create a store for the user first
    store = models.Store(
        store_name="Test Store",
        description="Desc",
        tax_id="TAX123",
        business_type="Individual",
        warehouse_address="Addr",
        user_id=seller_pending_user.id,
        status=models.StoreStatus.PENDING
    )
    db_session.add(store)
    db_session.commit()

    decision = ReviewDecision(decision="approve")
    result = review_seller_application(
        user_id=seller_pending_user.id,
        review_in=decision,
        db=db_session
    )

    assert result["status"] == "success"
    db_session.refresh(seller_pending_user)
    assert seller_pending_user.role == user_models.UserRole.SELLER

    db_session.refresh(store)
    assert store.status == models.StoreStatus.ACTIVE

def test_review_seller_application_reject(db_session, seller_pending_user):
    """Test that an admin can reject a seller application"""
    from app.modules.admin.router import review_seller_application
    from app.modules.admin.router import ReviewDecision

    store = models.Store(
        store_name="Test Store",
        description="Desc",
        tax_id="TAX123",
        business_type="Individual",
        warehouse_address="Addr",
        user_id=seller_pending_user.id,
        status=models.StoreStatus.PENDING
    )
    db_session.add(store)
    db_session.commit()

    decision = ReviewDecision(decision="reject")
    result = review_seller_application(
        user_id=seller_pending_user.id,
        review_in=decision,
        db=db_session
    )

    assert result["status"] == "success"
    db_session.refresh(seller_pending_user)
    assert seller_pending_user.role == user_models.UserRole.CUSTOMER

    db_session.refresh(store)
    assert store.status == models.StoreStatus.REJECTED

def test_review_seller_application_user_not_found(db_session):
    """Test review fails when user does not exist"""
    from app.modules.admin.router import review_seller_application
    from app.modules.admin.router import ReviewDecision
    from uuid import uuid4
    from fastapi import HTTPException

    decision = ReviewDecision(decision="approve")
    with pytest.raises(HTTPException) as excinfo:
        review_seller_application(
            user_id=uuid4(),
            review_in=decision,
            db=db_session
        )
    assert excinfo.value.status_code == 404

def test_review_seller_application_no_store(db_session, seller_pending_user):
    """Test review fails when user has no store application"""
    from app.modules.admin.router import review_seller_application
    from app.modules.admin.router import ReviewDecision
    from fastapi import HTTPException

    decision = ReviewDecision(decision="approve")
    with pytest.raises(HTTPException) as excinfo:
        review_seller_application(
            user_id=seller_pending_user.id,
            review_in=decision,
            db=db_session
        )
    assert excinfo.value.status_code == 400

def test_review_seller_application_invalid_decision(db_session, seller_pending_user):
    """Test review fails with invalid decision"""
    from app.modules.admin.router import review_seller_application
    from app.modules.admin.router import ReviewDecision
    from fastapi import HTTPException

    store = models.Store(
        store_name="Test Store",
        description="Desc",
        tax_id="TAX123",
        business_type="Individual",
        warehouse_address="Addr",
        user_id=seller_pending_user.id,
        status=models.StoreStatus.PENDING
    )
    db_session.add(store)
    db_session.commit()

    decision = ReviewDecision(decision="maybe")
    with pytest.raises(HTTPException) as excinfo:
        review_seller_application(
            user_id=seller_pending_user.id,
            review_in=decision,
            db=db_session
        )
    assert excinfo.value.status_code == 400

@pytest.fixture
def seller_pending_user(db_session):
    user = user_models.User(
        id=uuid4(),
        email=f"pending_{uuid4().hex[:8]}@example.com",
        password_hash="hashed",
        full_name="Pending Seller",
        role=user_models.UserRole.SELLER_PENDING
    )
    db_session.add(user)
    db_session.commit()
    return user
