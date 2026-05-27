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

def create_order(db: Session, user_id: UUID, shipping_address: str, reward_id: UUID = None, payment_method_id: UUID = None, cart_item_ids: Optional[List[UUID]] = None):
    # 1. Get user's cart with items and products loaded
    cart = db.query(Cart).filter(Cart.user_id == user_id)\
        .options(joinedload(Cart.items).joinedload(CartItem.product).joinedload(Product.images))\
        .first()

    if not cart:
        raise HTTPException(status_code=400, detail="No cart found for this user")

    if not cart.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # Partition cart items into "in this order" vs "stays in cart"
    if cart_item_ids:
        selected_ids = {UUID(str(i)) for i in cart_item_ids}
        ordered_items = [it for it in cart.items if it.id in selected_ids]
        remaining_items = [it for it in cart.items if it.id not in selected_ids]
        if not ordered_items:
            raise HTTPException(status_code=400, detail="No valid items selected for this order")
    else:
        ordered_items = list(cart.items)
        remaining_items = []

    from app.modules.flash_sale.models import FlashSale, FlashSaleProduct
    now = datetime.now(UTC)

    # 2. Calculate total with Flash Sale support
    subtotal = 0
    order_items_data = []

    from app.modules.store.models import Store, DEFAULT_COMMISSION_RATE

    # Cache the commission rate per seller so we hit the stores table at most
    # once per distinct seller in the cart.
    commission_rate_cache: Dict[Any, float] = {}

    def _commission_rate_for(seller_id):
        if seller_id is None:
            return DEFAULT_COMMISSION_RATE
        if seller_id in commission_rate_cache:
            return commission_rate_cache[seller_id]
        store = db.query(Store).filter(Store.user_id == seller_id).first()
        rate = store.commission_rate if store else DEFAULT_COMMISSION_RATE
        commission_rate_cache[seller_id] = rate
        return rate

    for item in ordered_items:
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

        commission_rate = _commission_rate_for(item.product.seller_id)
        commission_amount = round(current_price * item.quantity * commission_rate, 2)

        order_items_data.append({
            "product_id": item.product_id,
            "seller_id": item.product.seller_id,
            "quantity": item.quantity,
            "price": current_price,
            "title": full_title,
            "image": next((img.url for img in item.product.images if img.is_main),
                         item.product.images[0].url if item.product.images else None),
            "commission_rate": commission_rate,
            "commission_amount": commission_amount,
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
                total_qty = sum(item.quantity for item in ordered_items)
                if total_qty >= 2:
                    # Discount the cheapest item being ordered
                    discount = min(item.product.price for item in ordered_items)
                else:
                    # Validation failed, discount remains 0
                    pass
            elif reward.reward_type == 'gift':
                # Fixed $10 discount for Free Gift
                discount = min(subtotal, 10.0)

            reward.is_used = True
            db.add(reward)

    # Platform fee — Stripe-style: flat $0.30 + 2% of pre-fee total.
    pre_fee_total = max(0, subtotal + shipping + tax - discount)
    platform_fee = round(0.30 + 0.02 * pre_fee_total, 2)
    total = round(pre_fee_total + platform_fee, 2)

    # 3. Create Order
    order = models.Order(
        user_id=user_id,
        total_amount=total,
        shipping_amount=round(shipping, 2),
        tax_amount=round(tax, 2),
        platform_fee=platform_fee,
        discount_amount=round(discount, 2),
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
            product_image=data["image"],
            commission_rate=data["commission_rate"],
            commission_amount=data["commission_amount"],
        )
        db.add(order_item)

        # 6. Deduct Stock
        product = db.query(Product).filter(Product.id == data["product_id"]).with_for_update().first()
        if product:
            if product.stock < data["quantity"]:
                raise HTTPException(status_code=400, detail=f"Product {data['title']} is out of stock")
            product.stock -= data["quantity"]

    # 7. Remove only the ordered items from the cart; leave the rest intact
    for it in ordered_items:
        db.delete(it)
    if remaining_items:
        # Re-bind the cart to the items that should remain
        cart.items = remaining_items
    else:
        cart.items = []
    db.add(cart)

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
        .order_by(models.Order.updated_at.desc()).all()

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

def process_return_request(db: Session, actor_id: UUID, return_id: UUID, approved: bool, reason: str = None, is_admin: bool = False):
    # Sellers act on "requested" returns; admins act on seller-rejected returns (disputes).
    allowed_statuses = ["requested", "rejected"] if is_admin else ["requested"]
    return_request = db.query(models.Return).filter(
        models.Return.id == return_id,
        models.Return.status.in_(allowed_statuses)
    ).first()

    if not return_request:
        detail = (
            "Dispute not found or already resolved"
            if is_admin
            else "Return request not found or already processed"
        )
        raise HTTPException(status_code=404, detail=detail)

    order = db.query(models.Order).filter(models.Order.id == return_request.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")

    from_status = order.status
    new_status = models.OrderStatus.RETURN_APPROVED if approved else models.OrderStatus.RETURN_REJECTED

    # Update statuses
    order.status = new_status
    return_request.status = "approved" if approved else "rejected"

    actor = models.OrderActor.ADMIN if is_admin else models.OrderActor.SELLER
    actor_label = "admin" if is_admin else "seller"
    default_reason = (
        f"Return approved by {actor_label}" if approved else f"Return rejected by {actor_label}"
    )
    log_order_event(
        db,
        order.id,
        from_status,
        new_status,
        actor,
        reason or default_reason,
    )

    db.commit()
    db.refresh(order)
    return order

# Statuses where the seller actually earned the money (mirrors admin REVENUE_STATUSES).
_SELLER_REVENUE_STATUSES = {
    models.OrderStatus.PAID,
    models.OrderStatus.PACKED,
    models.OrderStatus.SHIPPED,
    models.OrderStatus.DELIVERED,
    models.OrderStatus.RETURN_REQUESTED,
    models.OrderStatus.RETURN_APPROVED,
    models.OrderStatus.RETURN_REJECTED,
    models.OrderStatus.RETURNED,
    models.OrderStatus.REFUNDED,
    models.OrderStatus.CLOSED,
}
_REFUNDED_RETURN_STATUSES = {"approved", "refunded"}

def compute_seller_share(order, seller_id: UUID):
    """
    The seller's slice of one order — the numbers both dashboards agree on.

    Money attribution:
      items value (price × qty for seller's items)  → seller
      shipping (prorated by seller's item share)    → seller (covers fulfilment)
      tax                                            → govt (NOT the seller)
      platform_fee                                   → admin (NOT the seller)
      discount                                       → platform absorbed
      commission (commission_amount on items)       → admin (deducted from seller)
      refunds                                       → seller takes the hit, but
                                                       commission is credited back

    Returns:
      gross   — seller's gross credited = items + shipping share
      fee     — commission deducted (admin's cut)
      refunds — refund hit (commission-adjusted)
      net     — gross − fee − refunds

    Falls back to the old "prorate the entire total_amount" logic for orders
    placed before the money-breakdown columns existed (all four fields = 0).
    """
    zero = {"gross": 0.0, "fee": 0.0, "refunds": 0.0, "net": 0.0}

    if order.status not in _SELLER_REVENUE_STATUSES:
        return zero

    all_items = list(order.items or [])
    order_item_subtotal = sum((it.price or 0) * (it.quantity or 0) for it in all_items)
    if order_item_subtotal <= 0:
        return zero

    seller_items = [it for it in all_items if it.seller_id == seller_id]
    seller_item_subtotal = sum((it.price or 0) * (it.quantity or 0) for it in seller_items)
    if seller_item_subtotal <= 0:
        return zero

    seller_ratio = seller_item_subtotal / order_item_subtotal

    # Historical orders never had the money breakdown stored. Detect that and
    # fall back to the old "prorate total_amount" formula so old data still
    # shows something sensible on the dashboards.
    has_breakdown = (
        (order.shipping_amount or 0) > 0
        or (order.tax_amount or 0) > 0
        or (order.platform_fee or 0) > 0
        or (order.discount_amount or 0) > 0
    )
    if has_breakdown:
        seller_shipping = float(order.shipping_amount or 0) * seller_ratio
        gross = seller_item_subtotal + seller_shipping
    else:
        gross = float(order.total_amount or 0) * seller_ratio

    fee = sum((it.commission_amount or 0) for it in seller_items)

    item_lookup = {it.id: it for it in all_items}
    refunds = 0.0
    for ret in order.returns or []:
        if ret.status not in _REFUNDED_RETURN_STATUSES:
            continue
        return_basis_total = 0.0
        return_basis_seller = 0.0
        seller_returned_commission = 0.0
        for ri in ret.items or []:
            oi = item_lookup.get(ri.order_item_id)
            if oi is None:
                continue
            basis = (oi.price or 0) * (ri.quantity or 0)
            return_basis_total += basis
            if oi.seller_id == seller_id:
                return_basis_seller += basis
                if oi.quantity:
                    per_unit_commission = (oi.commission_amount or 0) / oi.quantity
                    seller_returned_commission += per_unit_commission * (ri.quantity or 0)
        if return_basis_total > 0:
            refunds += (
                float(ret.refund_amount or 0) * (return_basis_seller / return_basis_total)
                - seller_returned_commission
            )

    net = max(0.0, gross - fee - refunds)

    return {
        "gross": round(gross, 2),
        "fee": round(fee, 2),
        "refunds": round(refunds, 2),
        "net": round(net, 2),
    }


def get_seller_orders(db: Session, seller_id: UUID):
    orders = db.query(models.Order)\
        .join(models.OrderItem)\
        .filter(models.OrderItem.seller_id == seller_id)\
        .options(
            joinedload(models.Order.items),
            joinedload(models.Order.user),
            joinedload(models.Order.returns).joinedload(models.Return.items),
        )\
        .order_by(models.Order.updated_at.desc())\
        .distinct().all()

    for order in orders:
        order.customer_name = order.user.full_name if order.user else "Unknown"
        share = compute_seller_share(order, seller_id)
        order.seller_subtotal = share["gross"]
        order.seller_fee = share["fee"]
        order.seller_refund = share["refunds"]
        order.seller_net = share["net"]

    return orders

def get_seller_returns(db: Session, seller_id: UUID = None, admin_view: bool = False):
    query = db.query(models.Return)\
        .join(models.ReturnItem)\
        .join(models.OrderItem)

    if seller_id:
        query = query.filter(models.OrderItem.seller_id == seller_id)

    # Admin only sees disputes — i.e., returns that the seller has rejected.
    # Until the seller acts, the return is the seller's to handle.
    if admin_view:
        query = query.filter(models.Return.status == "rejected")

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
