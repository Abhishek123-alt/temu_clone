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
