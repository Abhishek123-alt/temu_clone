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

def add_item_to_cart(db: Session, cart_id: UUID, product_id: UUID, variant_id: UUID = None, quantity: int = 1):
    from app.modules.cart.models import Cart

    item = db.query(CartItem).filter(
        CartItem.cart_id == cart_id, 
        CartItem.product_id == product_id,
        CartItem.variant_id == variant_id
    ).first()
    
    if item:
        item.quantity += quantity
    else:
        item = CartItem(cart_id=cart_id, product_id=product_id, variant_id=variant_id, quantity=quantity)
        db.add(item)
    db.commit()
    db.refresh(item)

    # Trigger Quest Progress
    from app.modules.quest import services as quest_services
    cart = db.query(Cart).filter(Cart.id == cart_id).first()
    if cart:
        # We pass the quantity to allow for "Buy 5 items" quests to work correctly if we update the logic later
        # For now, we still just call it once per addition, or we can loop.
        # Let's just call it once as per current logic.
        quest_services.update_quest_progress(db, cart.user_id, "ADD_TO_CART")

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
