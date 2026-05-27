"""End-to-end test for quest tracking driven through the HTTP API.

Flow under test:
    seed quests -> create customer + products
    -> POST /user/recently-viewed/{id} x5
    -> GET  /quests/my-progress
    -> assert progress completes and a Reward row is granted
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.db.session import get_db
from app.main import app
from app.modules.product.models import Category, Product
from app.modules.quest.models import Quest, UserQuestProgress
from app.modules.user.models import Reward, User, UserRole


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


def _auth_headers(user_id):
    token = security.create_access_token(subject=user_id)
    return {"Authorization": f"Bearer {token}"}


def _seed_quests(db_session):
    """Mirrors the rows produced by scripts/seed_gamification.py."""
    rows = [
        Quest(
            title="Product Explorer",
            description="Discover new items! View 5 different products.",
            requirement_type="PRODUCT_VIEW",
            requirement_value=5,
            reward_value="10",
            reward_type="credit",
            target_user_role="CUSTOMER",
            is_active=True,
        ),
        Quest(
            title="Daily Login",
            description="Stay connected! Log in 3 days in a row.",
            requirement_type="DAILY_LOGIN",
            requirement_value=3,
            reward_value="5",
            reward_type="credit",
            target_user_role="All",
            is_active=True,
        ),
        Quest(
            title="Seller-only quest",
            description="Should not show up for customers.",
            requirement_type="PRODUCT_UPLOAD",
            requirement_value=5,
            reward_value="PRO-BADGE",
            reward_type="badge",
            target_user_role="SELLER",
            is_active=True,
        ),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


def _make_customer(db_session, email="quester@example.com"):
    user = User(
        email=email,
        password_hash="x",
        full_name="Quest Customer",
        role=UserRole.CUSTOMER,
        is_active=True,
        referral_code=uuid.uuid4().hex[:8],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_seller(db_session, email="seller@example.com"):
    user = User(
        email=email,
        password_hash="x",
        full_name="Quest Seller",
        role=UserRole.SELLER,
        is_active=True,
        referral_code=uuid.uuid4().hex[:8],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_products(db_session, seller_id, n=5):
    category = Category(name="Electronics", slug=f"electronics-{uuid.uuid4().hex[:6]}")
    db_session.add(category)
    db_session.commit()
    db_session.refresh(category)

    products = []
    for i in range(n):
        p = Product(
            title=f"Widget {i}",
            slug=f"widget-{uuid.uuid4().hex[:8]}",
            description="A widget",
            price=9.99,
            stock=10,
            category_id=category.id,
            seller_id=seller_id,
            is_active=True,
        )
        db_session.add(p)
        products.append(p)
    db_session.commit()
    for p in products:
        db_session.refresh(p)
    return products


def test_my_progress_lists_quests_for_role_only(db_session):
    """GET /quests/my-progress must show CUSTOMER + All quests, not SELLER ones."""
    _seed_quests(db_session)
    customer = _make_customer(db_session)

    resp = client.get(
        "/api/v1/quests/my-progress", headers=_auth_headers(customer.id)
    )
    assert resp.status_code == 200
    titles = {q["title"] for q in resp.json()}
    assert "Product Explorer" in titles
    assert "Daily Login" in titles
    assert "Seller-only quest" not in titles
    # Fresh user — progress starts at zero, nothing completed.
    for q in resp.json():
        assert q["current_progress"] == 0
        assert q["is_completed"] is False


def test_product_view_quest_completes_end_to_end(db_session):
    """View 5 different products through the API and assert the quest
    progresses, completes, and grants a Reward row."""
    quests = _seed_quests(db_session)
    explorer = next(q for q in quests if q.title == "Product Explorer")

    customer = _make_customer(db_session)
    seller = _make_seller(db_session)
    products = _make_products(db_session, seller.id, n=5)
    headers = _auth_headers(customer.id)

    # Trigger PRODUCT_VIEW four times — should be in progress, not completed.
    for product in products[:4]:
        resp = client.post(
            f"/api/v1/user/recently-viewed/{product.id}", headers=headers
        )
        assert resp.status_code == 200

    resp = client.get("/api/v1/quests/my-progress", headers=headers)
    assert resp.status_code == 200
    explorer_state = next(
        q for q in resp.json() if q["title"] == "Product Explorer"
    )
    assert explorer_state["current_progress"] == 4
    assert explorer_state["is_completed"] is False

    # No reward yet.
    assert (
        db_session.query(Reward).filter(Reward.user_id == customer.id).count()
        == 0
    )

    # 5th view — should tip the quest into completed state and grant a reward.
    resp = client.post(
        f"/api/v1/user/recently-viewed/{products[4].id}", headers=headers
    )
    assert resp.status_code == 200

    resp = client.get("/api/v1/quests/my-progress", headers=headers)
    explorer_state = next(
        q for q in resp.json() if q["title"] == "Product Explorer"
    )
    assert explorer_state["current_progress"] == 5
    assert explorer_state["is_completed"] is True

    # Persisted row matches.
    progress_row = (
        db_session.query(UserQuestProgress)
        .filter(
            UserQuestProgress.user_id == customer.id,
            UserQuestProgress.quest_id == explorer.id,
        )
        .one()
    )
    assert progress_row.is_completed is True
    assert progress_row.current_progress == 5

    # Reward granted with the expected shape.
    reward = (
        db_session.query(Reward).filter(Reward.user_id == customer.id).one()
    )
    assert reward.reward_type == "credit"
    assert reward.value == "$10"
    assert reward.code.startswith("QUEST-")


def test_repeat_views_do_not_overflow_completed_quest(db_session):
    """Once completed, further PRODUCT_VIEWs must not bump progress or
    grant a second reward."""
    _seed_quests(db_session)
    customer = _make_customer(db_session)
    seller = _make_seller(db_session)
    products = _make_products(db_session, seller.id, n=5)
    headers = _auth_headers(customer.id)

    # Drive to completion (5 views).
    for product in products:
        client.post(
            f"/api/v1/user/recently-viewed/{product.id}", headers=headers
        )

    # Three more views on the same products — should be no-ops for the quest.
    for product in products[:3]:
        client.post(
            f"/api/v1/user/recently-viewed/{product.id}", headers=headers
        )

    resp = client.get("/api/v1/quests/my-progress", headers=headers)
    explorer_state = next(
        q for q in resp.json() if q["title"] == "Product Explorer"
    )
    assert explorer_state["current_progress"] == 5  # capped at requirement
    assert explorer_state["is_completed"] is True
    assert (
        db_session.query(Reward).filter(Reward.user_id == customer.id).count()
        == 1
    )
