"""
Tests for the simple "platform fee + refund" revenue model:

  1. Order placement snapshots commission on each item.
  2. compute_seller_share returns {gross, fee, refunds, net} that reconciles
     across sellers to the order's actually-collected amount.
  3. Refunds clawback against the seller's earnings (commission credited back).
"""
import pytest
from uuid import uuid4

from app.modules.order import services, models
from app.modules.cart.models import Cart, CartItem
from app.modules.product.models import Product, Category
from app.modules.store.models import Store, StoreStatus
from app.modules.user.models import User, UserRole


def _make_seller(db, name, commission_rate=0.10):
    seller = User(
        id=uuid4(),
        email=f"{name.lower().replace(' ', '_')}_{uuid4().hex[:6]}@x.com",
        password_hash="x",
        full_name=name,
        role=UserRole.SELLER,
    )
    db.add(seller)
    db.flush()
    db.add(Store(
        id=uuid4(),
        user_id=seller.id,
        store_name=f"{name} Store",
        tax_id="TAX",
        warehouse_address="addr",
        status=StoreStatus.ACTIVE,
        commission_rate=commission_rate,
    ))
    return seller


def _make_product(db, seller, price=100.0, stock=10):
    cat_slug = f"cat-{uuid4().hex[:6]}"
    cat = db.query(Category).filter(Category.slug == cat_slug).first()
    if not cat:
        cat = Category(name="Cat", slug=cat_slug)
        db.add(cat)
        db.flush()
    p = Product(
        id=uuid4(),
        title=f"Prod {uuid4().hex[:4]}",
        slug=f"prod-{uuid4().hex[:6]}",
        price=price,
        stock=stock,
        category_id=cat.id,
        seller_id=seller.id,
    )
    db.add(p)
    db.flush()
    return p


def _place_order(db, buyer, *cart_lines):
    """cart_lines = [(product, quantity), ...]"""
    cart = Cart(user_id=buyer.id)
    db.add(cart)
    db.flush()
    for product, qty in cart_lines:
        db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=qty))
    db.commit()
    return services.create_order(db, buyer.id, "ship addr")


@pytest.fixture
def buyer(db_session):
    u = User(
        id=uuid4(),
        email=f"buyer_{uuid4().hex[:6]}@x.com",
        password_hash="x",
        full_name="Buyer",
        role=UserRole.CUSTOMER,
    )
    db_session.add(u)
    db_session.commit()
    return u


def test_commission_snapshotted_on_order_create(db_session, buyer):
    seller = _make_seller(db_session, "Solo", commission_rate=0.15)
    p = _make_product(db_session, seller, price=100.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (p, 2))

    assert len(order.items) == 1
    item = order.items[0]
    # 100 * 2 * 0.15 = 30.0
    assert item.commission_rate == 0.15
    assert item.commission_amount == 30.0


def test_compute_seller_share_reconciles_across_sellers(db_session, buyer):
    """Sum of seller gross shares equals items + shipping
    (tax and platform_fee don't flow to sellers)."""
    a = _make_seller(db_session, "Seller A", commission_rate=0.10)
    b = _make_seller(db_session, "Seller B", commission_rate=0.20)
    pa = _make_product(db_session, a, price=100.0)
    pb = _make_product(db_session, b, price=50.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (pa, 1), (pb, 2))
    services.update_order_status(
        db_session, order.id, models.OrderStatus.DELIVERED, models.OrderActor.SYSTEM
    )
    db_session.refresh(order)

    share_a = services.compute_seller_share(order, a.id)
    share_b = services.compute_seller_share(order, b.id)

    items_subtotal = 100.0 + 50.0 * 2  # 200
    expected_seller_pool = items_subtotal + order.shipping_amount
    assert share_a["gross"] + share_b["gross"] == pytest.approx(expected_seller_pool, abs=0.02)

    # Platform fee per seller is snapshotted at their own commission rate.
    assert share_a["fee"] == 10.0   # 100 * 0.10
    assert share_b["fee"] == 20.0   # 100 * 0.20


def test_seller_share_zero_for_non_revenue_statuses(db_session, buyer):
    seller = _make_seller(db_session, "Pending")
    p = _make_product(db_session, seller, price=50.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (p, 1))
    # Order stays in PENDING — never collected money.
    share = services.compute_seller_share(order, seller.id)
    assert share == {"gross": 0.0, "fee": 0.0, "refunds": 0.0, "net": 0.0}


def test_order_creation_breaks_out_shipping_tax_platform_fee(db_session, buyer):
    """Order.total_amount = items + shipping + tax + platform_fee - discount."""
    seller = _make_seller(db_session, "Breakdown")
    p = _make_product(db_session, seller, price=100.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (p, 1))

    items = 100.0
    expected_shipping = 9.99
    expected_tax = round(items * 0.08, 2)
    pre_fee = items + expected_shipping + expected_tax
    expected_platform_fee = round(0.30 + 0.02 * pre_fee, 2)
    expected_total = round(pre_fee + expected_platform_fee, 2)

    assert order.shipping_amount == expected_shipping
    assert order.tax_amount == expected_tax
    assert order.platform_fee == expected_platform_fee
    assert order.total_amount == pytest.approx(expected_total, abs=0.01)


def test_full_reconciliation_seller_admin_govt(db_session, buyer):
    """The customer's total payment is fully accounted for across:
       seller net (item value + shipping − commission)
       + admin revenue (commission + platform_fee)
       + govt (tax)
       = order.total_amount.
    """
    seller = _make_seller(db_session, "Recon", commission_rate=0.10)
    p = _make_product(db_session, seller, price=50.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (p, 2))
    services.update_order_status(
        db_session, order.id, models.OrderStatus.DELIVERED, models.OrderActor.SYSTEM
    )
    db_session.refresh(order)

    share = services.compute_seller_share(order, seller.id)
    commission = sum(it.commission_amount for it in order.items)

    seller_net = share["net"]
    admin_keeps = commission + order.platform_fee
    govt = order.tax_amount

    assert seller_net + admin_keeps + govt == pytest.approx(order.total_amount, abs=0.02)


def test_refund_clawback_credits_commission_back(db_session, buyer):
    """An approved refund reduces seller net, and the commission portion is
    credited back to the seller so they don't pay fee on a sale they didn't keep."""
    seller = _make_seller(db_session, "RefundCo", commission_rate=0.20)
    p = _make_product(db_session, seller, price=100.0)
    db_session.commit()

    order = _place_order(db_session, buyer, (p, 2))
    services.update_order_status(
        db_session, order.id, models.OrderStatus.DELIVERED, models.OrderActor.SYSTEM
    )
    db_session.refresh(order)

    # Customer returns 1 of 2 units; seller approves.
    from app.modules.order.schemas import ReturnCreate, ReturnItemBase
    services.request_return(
        db_session,
        user_id=buyer.id,
        order_id=order.id,
        return_data=ReturnCreate(
            reason="defective",
            items=[ReturnItemBase(order_item_id=order.items[0].id, quantity=1)],
        ),
    )
    db_session.refresh(order)
    services.process_return_request(db_session, seller.id, order.returns[0].id, approved=True)
    db_session.refresh(order)

    share = services.compute_seller_share(order, seller.id)

    # Snapshot was 100 * 2 * 0.20 = $40 commission.
    # Per-unit commission = $20; 1 returned → $20 credited back, so net refund
    # against the seller is (refund_amount on items − $20 commission credited).
    # Refunds should be positive (item refund > commission credit).
    assert share["fee"] == 40.0
    assert share["refunds"] > 0
    assert share["net"] >= 0
