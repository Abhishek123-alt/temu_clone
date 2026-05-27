from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from app.db.session import get_db
from app.modules.user.models import User, UserRole
from app.modules.product.models import Product
from app.modules.store.models import Store, StoreStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

from app.modules.order.models import Order, OrderStatus, OrderItem, Return, ReturnItem

# Statuses where revenue is "recognised" — money has been collected (or is owed).
# Excludes carts that never paid (PENDING), failed payments, and cancellations.
REVENUE_STATUSES = [
    OrderStatus.PAID,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.RETURN_APPROVED,
    OrderStatus.RETURN_REJECTED,
    OrderStatus.RETURNED,
    OrderStatus.REFUNDED,
    OrderStatus.CLOSED,
]

# Return states that actually take money back from the seller / platform.
REFUNDED_RETURN_STATUSES = ["approved", "refunded"]

@router.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
    total_sellers = db.query(User).filter(User.role == UserRole.SELLER).count()
    total_products = db.query(Product).count()

    gross_sales = (
        db.query(func.sum(Order.total_amount))
        .filter(Order.status.in_(REVENUE_STATUSES))
        .scalar()
        or 0
    )
    total_refunds = (
        db.query(func.sum(Return.refund_amount))
        .filter(Return.status.in_(REFUNDED_RETURN_STATUSES))
        .scalar()
        or 0
    )
    net_sales = max(0, gross_sales - total_refunds)

    # Commission income = % of items the platform charges sellers.
    # Refunds give that commission back to the seller, so subtract it here too.
    commission_gross = (
        db.query(func.sum(OrderItem.commission_amount))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status.in_(REVENUE_STATUSES))
        .scalar()
        or 0
    )
    refunded_commission_rows = (
        db.query(
            OrderItem.commission_amount,
            OrderItem.quantity,
            ReturnItem.quantity.label("returned_qty"),
        )
        .join(ReturnItem, ReturnItem.order_item_id == OrderItem.id)
        .join(Return, Return.id == ReturnItem.return_id)
        .filter(Return.status.in_(REFUNDED_RETURN_STATUSES))
        .all()
    )
    refunded_commission = 0.0
    for row in refunded_commission_rows:
        if row.quantity:
            per_unit = (row.commission_amount or 0) / row.quantity
            refunded_commission += per_unit * (row.returned_qty or 0)
    commission_income = max(0.0, commission_gross - refunded_commission)

    # Platform fee = flat-per-order transaction fee (Stripe-style).
    # Non-refundable on returns (matches real payment processors).
    platform_fee_income = (
        db.query(func.sum(Order.platform_fee))
        .filter(Order.status.in_(REVENUE_STATUSES))
        .scalar()
        or 0
    )

    # Tax — collected by the platform, owed to govt. Not platform income,
    # but show it on the dashboard so admin sees the liability.
    tax_collected = (
        db.query(func.sum(Order.tax_amount))
        .filter(Order.status.in_(REVENUE_STATUSES))
        .scalar()
        or 0
    )

    # Total admin revenue = the two streams admin actually keeps.
    admin_revenue = commission_income + platform_fee_income

    return {
        "total_customers": total_customers,
        "total_sellers": total_sellers,
        "total_products": total_products,
        "total_sales": round(net_sales, 2),
        "gross_sales": round(gross_sales, 2),
        "total_refunds": round(total_refunds, 2),
        "net_sales": round(net_sales, 2),
        # Admin's two revenue streams, plus passthrough tax for transparency.
        "commission_income": round(commission_income, 2),
        "platform_fee_income": round(platform_fee_income, 2),
        "tax_collected": round(tax_collected, 2),
        "admin_revenue": round(admin_revenue, 2),
    }

@router.get("/sales-orders")
def get_sales_orders(
    seller_id: Optional[UUID] = None,
    db: Session = Depends(get_db)
):
    """
    Returns a flat list of sales records the admin can chart over time.
    Each row carries gross (total_amount), refund_amount, and net_amount so the
    client can plot revenue net of returned/refunded items.
    - No seller_id: one row per platform order (uses Order.total_amount).
    - With seller_id: one row per (order, seller) pair, amount = sum of that seller's items.
    """
    if seller_id is None:
        refund_per_order = (
            db.query(
                Return.order_id.label("order_id"),
                func.sum(Return.refund_amount).label("refund"),
            )
            .filter(Return.status.in_(REFUNDED_RETURN_STATUSES))
            .group_by(Return.order_id)
            .subquery()
        )

        rows = (
            db.query(
                Order.id,
                Order.total_amount,
                Order.created_at,
                func.coalesce(refund_per_order.c.refund, 0).label("refund_amount"),
            )
            .outerjoin(refund_per_order, refund_per_order.c.order_id == Order.id)
            .filter(Order.status.in_(REVENUE_STATUSES))
            .order_by(Order.created_at.asc())
            .all()
        )
        return [
            {
                "id": str(r.id),
                "total_amount": float(r.total_amount or 0),
                "refund_amount": float(r.refund_amount or 0),
                "net_amount": max(0.0, float(r.total_amount or 0) - float(r.refund_amount or 0)),
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]

    # Per-seller revenue is computed by prorating the actually-collected
    # Order.total_amount (and Return.refund_amount) by each seller's item share.
    # This guarantees the per-seller numbers add up to the platform totals shown
    # in /admin/stats — they're slices of the same pie.
    from sqlalchemy.orm import joinedload
    from app.modules.order import services as order_services

    seller_order_ids = {
        row[0]
        for row in db.query(Order.id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(OrderItem.seller_id == seller_id)
        .filter(Order.status.in_(REVENUE_STATUSES))
        .distinct()
        .all()
    }
    if not seller_order_ids:
        return []

    orders = (
        db.query(Order)
        .filter(Order.id.in_(seller_order_ids))
        .options(
            joinedload(Order.items),
            joinedload(Order.returns).joinedload(Return.items),
        )
        .order_by(Order.created_at.asc())
        .all()
    )

    rows = []
    for order in orders:
        share = order_services.compute_seller_share(order, seller_id)
        if share["gross"] <= 0 and share["refunds"] <= 0:
            continue
        rows.append({
            "id": str(order.id),
            "total_amount": share["gross"],
            "refund_amount": share["refunds"],
            "net_amount": share["net"],
            "fee": share["fee"],
            "created_at": order.created_at.isoformat(),
        })
    return rows

@router.get("/sellers")
def get_sellers(db: Session = Depends(get_db)):
    sellers = db.query(User).filter(User.role == UserRole.SELLER).order_by(User.full_name.asc()).all()
    return [{"id": str(s.id), "full_name": s.full_name, "email": s.email} for s in sellers]

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

@router.patch("/users/{user_id}/active")
def toggle_user_active(
    user_id: UUID,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify admin accounts")

    user.is_active = not user.is_active
    try:
        db.commit()
        db.refresh(user)
        return {"id": str(user.id), "is_active": user.is_active}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to toggle user status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sellers/pending")
def get_pending_sellers(db: Session = Depends(get_db)):
    # Find stores that are PENDING and get their users
    pending_stores = db.query(Store).filter(Store.status == StoreStatus.PENDING).all()

    results = []
    for store in pending_stores:
        user = db.query(User).filter(User.id == store.user_id).first()
        if user:
            results.append({
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "store": store
            })
    return results

class ReviewDecision(BaseModel):
    decision: str # "approve" or "reject"

@router.post("/sellers/{user_id}/review")
def review_seller_application(
    user_id: UUID,
    review_in: ReviewDecision,
    db: Session = Depends(get_db)
):
    decision = review_in.decision.lower()
    logger.info(f"Reviewing seller {user_id} with decision: {decision}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error(f"User {user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")

    store = db.query(Store).filter(Store.user_id == user.id).first()
    if not store:
        logger.error(f"No store found for user {user_id}")
        raise HTTPException(status_code=400, detail="No store application found for this user")

    if decision == "approve":
        user.role = UserRole.SELLER
        user.is_active = True
        store.status = StoreStatus.ACTIVE
    elif decision == "reject":
        user.role = UserRole.CUSTOMER
        user.is_active = False # Keep inactive as requested
        store.status = StoreStatus.REJECTED
    else:
        logger.error(f"Invalid decision: {decision}")
        raise HTTPException(status_code=400, detail="Invalid decision. Use 'approve' or 'reject'")

    try:
        db.commit()
        db.refresh(user)
        logger.info(f"Seller {user_id} {decision}ed successfully")
        return {"status": "success", "message": f"Seller application {decision}ed"}
    except Exception as e:
        db.rollback()
        logger.error(f"Database error during review: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
