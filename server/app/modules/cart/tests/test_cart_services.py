import pytest
from app.modules.cart import services
from uuid import uuid4

def test_get_or_create_cart(db_session):
    user_id = uuid4()
    cart = services.get_or_create_cart(db_session, user_id)
    assert cart.user_id == user_id
    
    # Second call should return the same cart
    cart2 = services.get_or_create_cart(db_session, user_id)
    assert cart.id == cart2.id

def test_add_item_to_cart(db_session):
    user_id = uuid4()
    cart = services.get_or_create_cart(db_session, user_id)
    product_id = uuid4()
    
    item = services.add_item_to_cart(db_session, cart.id, product_id, quantity=2)
    assert item.cart_id == cart.id
    assert item.product_id == product_id
    assert item.quantity == 2
    
    # Adding same item again should increment quantity
    item = services.add_item_to_cart(db_session, cart.id, product_id, quantity=3)
    assert item.quantity == 5

def test_update_cart_item(db_session):
    user_id = uuid4()
    cart = services.get_or_create_cart(db_session, user_id)
    product_id = uuid4()
    services.add_item_to_cart(db_session, cart.id, product_id, quantity=1)
    
    services.update_cart_item(db_session, cart.id, product_id, quantity=10)
    db_session.refresh(cart)
    assert cart.items[0].quantity == 10
    
    # Updating to 0 should remove item
    services.update_cart_item(db_session, cart.id, product_id, quantity=0)
    db_session.refresh(cart)
    assert len(cart.items) == 0
