import pytest
from app.modules.order import services as order_services
from app.modules.order import models as order_models
from app.modules.user import models as user_models
from app.modules.product import models as product_models
from uuid import uuid4

def test_order_payment_simulation(db_session):
    # Setup: User, Address, Category, Seller, Product, Payment Method
    user = user_models.User(
        id=uuid4(),
        email=f"buyer_{uuid4().hex[:6]}@example.com",
        password_hash="hashed",
        full_name="Buyer",
        role=user_models.UserRole.CUSTOMER
    )
    db_session.add(user)
    
    seller = user_models.User(
        id=uuid4(),
        email=f"seller_{uuid4().hex[:6]}@example.com",
        password_hash="hashed",
        full_name="Seller",
        role=user_models.UserRole.SELLER
    )
    db_session.add(seller)
    
    category = product_models.Category(
        id=uuid4(),
        name="Electronics",
        slug=f"elec-{uuid4().hex[:6]}"
    )
    db_session.add(category)
    
    pm = user_models.PaymentMethod(
        id=uuid4(),
        user_id=user.id,
        brand="VISA",
        last4="1234",
        exp_month=12,
        exp_year=2025,
        is_default=True
    )
    db_session.add(pm)
    
    product = product_models.Product(
        id=uuid4(),
        title="Phone",
        slug=f"phone-{uuid4().hex[:6]}",
        price=100.0,
        stock=10,
        is_active=True,
        category_id=category.id,
        seller_id=seller.id
    )
    db_session.add(product)
    
    # Create Cart and Item
    from app.modules.cart import services as cart_services
    cart = cart_services.get_or_create_cart(db_session, user.id)
    # Use keyword argument for quantity to avoid passing it as variant_id
    cart_services.add_item_to_cart(db_session, cart.id, product.id, quantity=1)
    
    db_session.commit()
    
    # Simulation 1: Create Order (Initial status is PENDING)
    order = order_services.create_order(
        db_session, 
        user_id=user.id, 
        shipping_address="123 Street",
        payment_method_id=pm.id
    )
    
    assert order.total_amount > 0
    assert order.status == order_models.OrderStatus.PENDING
    
    # Simulation 2: Payment Failure
    order.status = order_models.OrderStatus.PAYMENT_FAILED
    db_session.commit()
    db_session.refresh(order)
    assert order.status == order_models.OrderStatus.PAYMENT_FAILED
    
    # Simulation 3: Payment Success (Retry)
    order.status = order_models.OrderStatus.PAID
    db_session.commit()
    db_session.refresh(order)
    assert order.status == order_models.OrderStatus.PAID
