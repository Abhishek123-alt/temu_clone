import re
from sqlalchemy.orm import Session, joinedload
from app.modules.order import models, schemas
from app.modules.cart.models import Cart, CartItem
from app.modules.product.models import Product
from uuid import UUID
from fastapi import HTTPException
from typing import Optional, List, Dict, Any
from datetime import datetime, UTC

def log_order_event(db: Session, order_id: UUID, from_status: Optional[models.OrderStatus], to_status: models.OrderStatus, actor: models.OrderActor, reason: str = None, metadata: dict = {}):
    event = models.OrderEvent(
        order_id=order_id,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        reason=reason,
        metadata_json=metadata
    )
    db.add(event)
    
    # Add to outbox for notifications
    add_to_outbox(db, "order_status_changed", {
        "order_id": str(order_id),
        "from_status": getattr(from_status, 'value', from_status) if from_status else None,
        "to_status": getattr(to_status, 'value', to_status),
        "actor": getattr(actor, 'value', actor),
        "reason": reason,
        "metadata": metadata
    })

def add_to_outbox(db: Session, topic: str, payload: dict):
    outbox_item = models.Outbox(
        topic=topic,
        payload=payload
    )
    db.add(outbox_item)

def create_order(db: Session, user_id: UUID, shipping_address: str, reward_id: UUID = None, payment_method_id: UUID = None):
    # 1. Get user's cart with items and products loaded
    cart = db.query(Cart).filter(Cart.user_id == user_id)\
        .options(joinedload(Cart.items).joinedload(CartItem.product).joinedload(Product.images))\
        .first()

    if not cart:
        raise HTTPException(status_code=400, detail="No cart found for this user")

    if not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    from app.modules.flash_sale.models import FlashSale, FlashSaleProduct
    now = datetime.now(UTC)

    # 2. Calculate total with Flash Sale support
    subtotal = 0
    order_items_data = []

    for item in cart.items:
        # Check for active flash sale price
        flash_price = db.query(FlashSaleProduct.discounted_price).join(
            FlashSale, FlashSale.id == FlashSaleProduct.flash_sale_id
        ).filter(
            FlashSaleProduct.product_id == item.product_id,
            FlashSale.is_active == True,
            FlashSale.start_time <= now,
            FlashSale.end_time >= now
        ).first()

        current_price = flash_price[0] if flash_price else item.product.price
        subtotal += current_price * item.quantity

        # Construct title with variant if applicable
        full_title = item.product.title
        if hasattr(item, 'variant_id') and item.variant_id:
            from app.modules.product.models import ProductVariant
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
            if variant:
                options_str = ", ".join([ov.option_value.value for ov in variant.option_values])
                if options_str:
                    full_title = f"{full_title} ({options_str})"

        order_items_data.append({
            "product_id": item.product_id,
            "seller_id": item.product.seller_id,
            "quantity": item.quantity,
            "price": current_price,
            "title": full_title,
            "image": next((img.url for img in item.product.images if img.is_main),
                         item.product.images[0].url if item.product.images else None)
        })

    shipping = 9.99  # Flat shipping rate
    tax = subtotal * 0.08

    discount = 0
    if reward_id:
        from app.modules.user.models import Reward
        reward = db.query(Reward).filter(Reward.id == reward_id, Reward.user_id == user_id, Reward.is_used == False).first()
        if reward:
            # Robustly extract numeric value using regex
            numeric_match = re.search(r'(\d+(?:\.\d+)?)', reward.value)
            val = float(numeric_match.group(1)) if numeric_match else 0

            if reward.reward_type == 'coupon':
                discount = (subtotal * val) / 100
            elif reward.reward_type == 'credit':
                discount = val
            elif reward.reward_type == 'freeship':
                discount = shipping
            elif reward.reward_type == 'bogo':
                total_qty = sum(item.quantity for item in cart.items)
                if total_qty >= 2:
                    # Discount the cheapest item in the cart
                    discount = min(item.product.price for item in cart.items)
                else:
                    # Validation failed, discount remains 0
                    pass
            elif reward.reward_type == 'gift':
                # Fixed $10 discount for Free Gift
                discount = min(subtotal, 10.0)

            reward.is_used = True
            db.add(reward)

    total = max(0, subtotal + shipping + tax - discount)

    # 3. Create Order
    order = models.Order(
        user_id=user_id,
        total_amount=total,
        shipping_address=shipping_address,
        status=models.OrderStatus.PENDING,
        payment_method_id=payment_method_id
    )
    db.add(order)
    db.flush() # Get order ID

    # 4. Log initial event
    log_order_event(db, order.id, None, models.OrderStatus.PENDING, models.OrderActor.USER, "Order placed")

    # 5. Create Order Items and snapshot info
    for data in order_items_data:
        order_item = models.OrderItem(
            order_id=order.id,
            product_id=data["product_id"],
            seller_id=data["seller_id"],
            quantity=data["quantity"],
            price=data["price"],
            product_title=data["title"],
            product_image=data["image"]
        )
        db.add(order_item)

        # 6. Deduct Stock
        product = db.query(Product).filter(Product.id == data["product_id"]).with_for_update().first()
        if product:
            if product.stock < data["quantity"]:
                raise HTTPException(status_code=400, detail=f"Product {data['title']} is out of stock")
            product.stock -= data["quantity"]

    # 7. Clear Cart
    cart.items = []
    db.add(cart)

    # 8. Save Address to User Profile if it's new and under the limit (max 3)
    from app.modules.user.models import Address
    existing_address = db.query(Address).filter(Address.user_id == user_id, Address.street == shipping_address).first()
    if not existing_address:
        count = db.query(Address).filter(Address.user_id == user_id).count()
        if count < 3:
            new_address = Address(
                user_id=user_id,
                street=shipping_address,
                city="Update City",
                state="Update State",
                zip="000000",
                country="India",
                is_default=True
            )
            db.add(new_address)

    db.commit()
    db.refresh(order)
    return order

def update_order_status(db: Session, order_id: UUID, new_status: models.OrderStatus, actor: models.OrderActor, reason: str = None, metadata: dict = {}):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.status
    if old_status == new_status:
        return order
        
    order.status = new_status
    log_order_event(db, order.id, old_status, new_status, actor, reason, metadata)
    
    from app.modules.quest import services as quest_services
    from app.modules.product.models import Product
    if new_status == models.OrderStatus.DELIVERED:
        # Find all sellers involved in this order
        sellers = db.query(Product.seller_id).join(models.OrderItem, models.OrderItem.product_id == Product.id).filter(models.OrderItem.order_id == order.id).distinct().all()
        for seller_id_row in sellers:
            if seller_id_row[0]:
                quest_services.update_quest_progress(db, seller_id_row[0], "ORDER_COMPLETED")

    db.commit()
    db.refresh(order)
    return order

def get_user_orders(db: Session, user_id: UUID):
    return db.query(models.Order).filter(models.Order.user_id == user_id)\
        .options(joinedload(models.Order.items), joinedload(models.Order.events), joinedload(models.Order.shipments))\
        .order_by(models.Order.created_at.desc()).all()

def get_order(db: Session, order_id: UUID):
    return db.query(models.Order).filter(models.Order.id == order_id)\
        .options(joinedload(models.Order.items), joinedload(models.Order.events), joinedload(models.Order.shipments))\
        .first()

def create_shipment(db: Session, order_id: UUID, carrier: str, tracking_number: str, tracking_url: str = None):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    shipment = models.Shipment(
        order_id=order_id,
        carrier=carrier,
        tracking_number=tracking_number,
        tracking_url=tracking_url,
        status="shipped",
        history=[{"status": "shipped", "location": "Warehouse", "at": datetime.now(UTC).isoformat()}]
    )
    db.add(shipment)
    
    # Update order status to SHIPPED
    update_order_status(db, order_id, models.OrderStatus.SHIPPED, models.OrderActor.SYSTEM, f"Shipment created: {carrier} {tracking_number}")
    
    db.commit()
    db.refresh(shipment)
    return shipment

def request_return(db: Session, user_id: UUID, order_id: UUID, return_data: schemas.ReturnCreate):
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == user_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != models.OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")
    
    # Calculate refund amount (simplified: full refund for requested items)
    refund_amount = 0
    return_request = models.Return(
        order_id=order_id,
        status="requested",
        reason=return_data.reason,
        refund_amount=0 # Will update below
    )
    db.add(return_request)
    db.flush()
    
    # If no specific items are provided, return all items in the order
    items_to_return = return_data.items
    if not items_to_return:
        items_to_return = [
            schemas.ReturnItemBase(order_item_id=item.id, quantity=item.quantity)
            for item in order.items
        ]
    
    for item in items_to_return:
        order_item = db.query(models.OrderItem).filter(models.OrderItem.id == item.order_item_id, models.OrderItem.order_id == order_id).first()
        if not order_item:
            raise HTTPException(status_code=400, detail="Invalid order item")
        
        if item.quantity > order_item.quantity:
            raise HTTPException(status_code=400, detail=f"Cannot return more than purchased for {order_item.product_title}")
            
        return_item = models.ReturnItem(
            return_id=return_request.id,
            order_item_id=item.order_item_id,
            quantity=item.quantity,
            condition=item.condition
        )
        db.add(return_item)
        refund_amount += order_item.price * item.quantity
        
    return_request.refund_amount = refund_amount
    
    # Update order status
    update_order_status(db, order_id, models.OrderStatus.RETURN_REQUESTED, models.OrderActor.USER, f"Return requested: {return_data.reason}")
    
    db.commit()
    db.refresh(return_request)
    return return_request

def process_return_request(db: Session, seller_id: UUID, return_id: UUID, approved: bool, reason: str = None):
    # Find the specific return request
    return_request = db.query(models.Return).filter(
        models.Return.id == return_id,
        models.Return.status == "requested"
    ).first()
    
    if not return_request:
        raise HTTPException(status_code=404, detail="Return request not found or already processed")
        
    order = db.query(models.Order).filter(models.Order.id == return_request.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")
    
    from_status = order.status
    new_status = models.OrderStatus.RETURN_APPROVED if approved else models.OrderStatus.RETURN_REJECTED
    
    # Update statuses
    order.status = new_status
    return_request.status = "approved" if approved else "rejected"
    
    log_order_event(
        db, 
        order.id, 
        from_status, 
        new_status, 
        models.OrderActor.SELLER, 
        reason or ("Return approved by seller" if approved else "Return rejected by seller")
    )
    
    db.commit()
    db.refresh(order)
    return order

def get_seller_orders(db: Session, seller_id: UUID):
    return db.query(models.Order)\
        .join(models.OrderItem)\
        .filter(models.OrderItem.seller_id == seller_id)\
        .options(joinedload(models.Order.items), joinedload(models.Order.user))\
        .order_by(models.Order.updated_at.desc())\
        .distinct().all()

def get_seller_returns(db: Session, seller_id: UUID = None):
    query = db.query(models.Return)\
        .join(models.ReturnItem)\
        .join(models.OrderItem)
    
    if seller_id:
        query = query.filter(models.OrderItem.seller_id == seller_id)
        
    returns = query.options(
            joinedload(models.Return.items).joinedload(models.ReturnItem.order_item),
            joinedload(models.Return.order).joinedload(models.Order.user)
        )\
        .order_by(models.Return.updated_at.desc())\
        .distinct().all()

    # Populate names for the schema
    for r in returns:
        r.customer_name = r.order.user.full_name if r.order and r.order.user else "Unknown"
        # Get seller name from the first item
        if r.items and r.items[0].order_item.seller_id:
            from app.modules.user.models import User
            seller = db.query(User).filter(User.id == r.items[0].order_item.seller_id).first()
            r.seller_name = seller.full_name if seller else "Unknown"
        else:
            r.seller_name = "Unknown"
            
    return returns
