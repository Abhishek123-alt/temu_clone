"""Asserts the quest -> reward -> /user/me pipeline so the new reward
shows up in the profile + checkout coupon list."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.db.session import get_db
from app.main import app
from app.modules.product.models import Category, Product
from app.modules.quest.models import Quest
from app.modules.user.models import User, UserRole


client = TestClient(app)


@pytest.fixture(autouse=True)
def _override_db(db_session):
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.clear()


def _auth(user_id):
    return {"Authorization": f"Bearer {security.create_access_token(subject=user_id)}"}


def test_quest_reward_appears_in_user_me_payload(db_session):
    db_session.add(
        Quest(
            title="Product Explorer",
            description="View 5 products",
            requirement_type="PRODUCT_VIEW",
            requirement_value=2,
            reward_value="10",
            reward_type="credit",
            target_user_role="CUSTOMER",
            is_active=True,
        )
    )
    customer = User(
        email="reward-pipe@example.com",
        password_hash="x",
        full_name="Reward Pipe",
        role=UserRole.CUSTOMER,
        is_active=True,
        referral_code=uuid.uuid4().hex[:8],
    )
    seller = User(
        email="rp-seller@example.com",
        password_hash="x",
        full_name="RP Seller",
        role=UserRole.SELLER,
        is_active=True,
        referral_code=uuid.uuid4().hex[:8],
    )
    db_session.add_all([customer, seller])
    db_session.commit()
    db_session.refresh(customer)
    db_session.refresh(seller)

    category = Category(name="Cat", slug=f"cat-{uuid.uuid4().hex[:6]}")
    db_session.add(category)
    db_session.commit()
    db_session.refresh(category)

    products = []
    for i in range(2):
        p = Product(
            title=f"P{i}",
            slug=f"p-{uuid.uuid4().hex[:8]}",
            price=5.0,
            stock=10,
            category_id=category.id,
            seller_id=seller.id,
            is_active=True,
        )
        db_session.add(p)
        products.append(p)
    db_session.commit()
    for p in products:
        db_session.refresh(p)

    headers = _auth(customer.id)

    # Before any progress: no rewards on /user/me.
    me = client.get("/api/v1/user/me", headers=headers).json()
    assert me["rewards"] == []

    # Trigger PRODUCT_VIEW twice -> quest completes -> reward minted.
    for p in products:
        r = client.post(f"/api/v1/user/recently-viewed/{p.id}", headers=headers)
        assert r.status_code == 200

    # Reward should now be on the user payload, ready for profile + checkout.
    me = client.get("/api/v1/user/me", headers=headers).json()
    assert len(me["rewards"]) == 1
    reward = me["rewards"][0]
    assert reward["reward_type"] == "credit"
    assert reward["value"] == "$10"
    assert reward["code"].startswith("QUEST-")
    assert reward["is_used"] is False
