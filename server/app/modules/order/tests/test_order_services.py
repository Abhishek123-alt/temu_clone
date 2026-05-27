import pytest
from app.modules.order import services, models
from app.modules.cart.models import Cart, CartItem
from app.modules.product.models import Product, Category
from app.modules.user.models import User
from uuid import uuid4

@pytest.fixture
def test_data(db_session):
    # Setup User
    user = User(
        id=uuid4(),
        email="buyer@example.com",
        password_hash="hashed",
        full_name="Buyer",
        role="CUSTOMER"
    )
    db_session.add(user)
    
    # Setup Category
    cat = Category(name="Electronics", slug="electronics")
    db_session.add(cat)
    db_session.flush()
    
    # Setup Product
    prod = Product(
        id=uuid4(),
        title="Test Product",
        slug="test-product",
        price=100.0,
        stock=10,
        category_id=cat.id,
        seller_id=user.id # Seller is same as user for simplicity
    )
    db_session.add(prod)
    db_session.flush()
    
    # Setup Cart
    cart = Cart(user_id=user.id)
    db_session.add(cart)
    db_session.flush()
    
    cart_item = CartItem(cart_id=cart.id, product_id=prod.id, quantity=2)
    db_session.add(cart_item)
    
    db_session.commit()
    return user, prod, cart

def test_create_order_success(db_session, test_data):
    user, prod, cart = test_data
    
    order = services.create_order(
        db=db_session,
        user_id=user.id,
        shipping_address="123 Street, City"
    )
    
    assert order.user_id == user.id
    assert order.total_amount > 200.0 # Price * Qty + Tax + Shipping
    assert len(order.items) == 1
    assert order.status == models.OrderStatus.PENDING
    
    # Check stock deduction
    db_session.refresh(prod)
    assert prod.stock == 8 # 10 - 2
    
    # Check cart cleared
    db_session.refresh(cart)
    assert len(cart.items) == 0

def test_update_order_status(db_session, test_data):
    user, prod, cart = test_data
    order = services.create_order(db_session, user.id, "Address")
    
    updated_order = services.update_order_status(
        db=db_session,
        order_id=order.id,
        new_status=models.OrderStatus.PAID,
        actor=models.OrderActor.SYSTEM
    )
    
    assert updated_order.status == models.OrderStatus.PAID
    assert len(updated_order.events) == 2 # PENDING -> PAID

def test_partial_order_keeps_unselected_items_in_cart(db_session):
    user = User(id=uuid4(), email="partial@example.com", password_hash="x", full_name="Partial", role="CUSTOMER")
    db_session.add(user)
    cat = Category(name="Cat", slug=f"cat-{uuid4().hex[:6]}")
    db_session.add(cat)
    db_session.flush()
    p1 = Product(id=uuid4(), title="P1", slug=f"p1-{uuid4().hex[:6]}", price=50.0, stock=10, category_id=cat.id, seller_id=user.id)
    p2 = Product(id=uuid4(), title="P2", slug=f"p2-{uuid4().hex[:6]}", price=30.0, stock=10, category_id=cat.id, seller_id=user.id)
    db_session.add_all([p1, p2])
    db_session.flush()
    cart = Cart(user_id=user.id)
    db_session.add(cart)
    db_session.flush()
    ci1 = CartItem(cart_id=cart.id, product_id=p1.id, quantity=1)
    ci2 = CartItem(cart_id=cart.id, product_id=p2.id, quantity=2)
    db_session.add_all([ci1, ci2])
    db_session.commit()

    order = services.create_order(
        db=db_session,
        user_id=user.id,
        shipping_address="addr",
        cart_item_ids=[ci1.id],
    )

    assert len(order.items) == 1
    assert order.items[0].product_id == p1.id
    # Only ordered item's stock is deducted
    db_session.refresh(p1); db_session.refresh(p2)
    assert p1.stock == 9
    assert p2.stock == 10
    # The unselected item stays in the cart
    db_session.refresh(cart)
    assert len(cart.items) == 1
    assert cart.items[0].product_id == p2.id


def test_create_shipment(db_session, test_data):
    user, prod, cart = test_data
    order = services.create_order(db_session, user.id, "Address")
    
    shipment = services.create_shipment(
        db=db_session,
        order_id=order.id,
        carrier="FedEx",
        tracking_number="TRACK123"
    )
    
    assert shipment.order_id == order.id
    assert shipment.carrier == "FedEx"
    
    db_session.refresh(order)
    assert order.status == models.OrderStatus.SHIPPED
