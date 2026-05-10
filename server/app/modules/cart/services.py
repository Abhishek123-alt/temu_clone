from sqlalchemy.orm import Session
from app.modules.cart.models import Cart, CartItem
from uuid import UUID

def get_or_create_cart(db: Session, user_id: UUID):
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

def add_item_to_cart(db: Session, cart_id: UUID, product_id: UUID, quantity: int = 1):
    item = db.query(CartItem).filter(CartItem.cart_id == cart_id, CartItem.product_id == product_id).first()
    if item:
        item.quantity += quantity
    else:
        item = CartItem(cart_id=cart_id, product_id=product_id, quantity=quantity)
        db.add(item)
    db.commit()
    db.refresh(item)
    return item

def update_cart_item(db: Session, cart_id: UUID, product_id: UUID, quantity: int):
    item = db.query(CartItem).filter(CartItem.cart_id == cart_id, CartItem.product_id == product_id).first()
    if item:
        if quantity <= 0:
            db.delete(item)
        else:
            item.quantity = quantity
        db.commit()
    return item

def remove_item_from_cart(db: Session, cart_id: UUID, product_id: UUID):
    item = db.query(CartItem).filter(CartItem.cart_id == cart_id, CartItem.product_id == product_id).first()
    if item:
        db.delete(item)
        db.commit()
    return True
