from sqlalchemy.orm import Session, joinedload
from app.modules.order import models, schemas
from app.modules.cart.models import Cart, CartItem
from app.modules.product.models import Product
from uuid import UUID
from fastapi import HTTPException

def create_order(db: Session, user_id: UUID, shipping_address: str, reward_id: UUID = None):
    # 1. Get user's cart with items and products loaded
    cart = db.query(Cart).filter(Cart.user_id == user_id)\
        .options(joinedload(Cart.items).joinedload(CartItem.product))\
        .first()
        
    print(f"DEBUG: Checkout for user {user_id}")
    if not cart:
        print("DEBUG: No cart found for user")
        raise HTTPException(status_code=400, detail="No cart found for this user")
    
    print(f"DEBUG: Cart found with {len(cart.items)} items")
    if not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty in the database")

    # 2. Calculate total
    subtotal = sum(item.product.price * item.quantity for item in cart.items)
    shipping = 0 if subtotal > 20 else 5.99
    tax = subtotal * 0.08
    
    discount = 0
    if reward_id:
        from app.modules.user.models import Reward
        reward = db.query(Reward).filter(Reward.id == reward_id, Reward.user_id == user_id, Reward.is_used == False).first()
        if reward:
            if reward.reward_type == 'coupon':
                percent = int(reward.value.replace('% OFF', '').strip())
                discount = (subtotal * percent) / 100
            elif reward.reward_type == 'credit':
                discount = float(reward.value.replace('$', '').replace(' CREDIT', '').strip())
            elif reward.reward_type == 'freeship':
                discount = shipping
            
            # Mark reward as used
            reward.is_used = True
            db.add(reward)
            
    total = max(0, subtotal + shipping + tax - discount)

    # 3. Create Order
    order = models.Order(
        user_id=user_id,
        total_amount=total,
        shipping_address=shipping_address,
        status=models.OrderStatus.PENDING
    )
    db.add(order)
    db.flush() # Get order ID

    # 4. Create Order Items
    for cart_item in cart.items:
        order_item = models.OrderItem(
            order_id=order.id,
            product_id=cart_item.product_id,
            quantity=cart_item.quantity,
            price=cart_item.product.price
        )
        db.add(order_item)
        
        # 5. Deduct Stock
        product = db.query(Product).filter(Product.id == cart_item.product_id).first()
        if product:
            product.stock -= cart_item.quantity

    # 6. Clear Cart
    cart.items = []
    db.add(cart)

    # 7. Save Address to User Profile if it's new
    from app.modules.user.models import Address
    existing_address = db.query(Address).filter(Address.user_id == user_id, Address.street == shipping_address).first()
    if not existing_address:
        new_address = Address(
            user_id=user_id,
            street=shipping_address,
            city="Update City", # Default placeholders since we have a single string from UI
            state="Update State",
            zip="000000",
            country="India", # Added mandatory field
            is_default=True
        )
        db.add(new_address)

    db.commit()
    db.refresh(order)
    return order

def get_user_orders(db: Session, user_id: UUID):
    return db.query(models.Order).filter(models.Order.user_id == user_id).order_by(models.Order.created_at.desc()).all()

def get_order(db: Session, order_id: UUID):
    return db.query(models.Order).filter(models.Order.id == order_id).first()
