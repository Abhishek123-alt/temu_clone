from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.modules.user.models import User, UserRole
from app.modules.product.models import Product
from app.modules.store.models import Store, StoreStatus
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

from app.modules.order.models import Order, OrderStatus

@router.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
    total_sellers = db.query(User).filter(User.role == UserRole.SELLER).count()
    total_products = db.query(Product).count()

    total_sales = db.query(func.sum(Order.total_amount)).filter(Order.status == OrderStatus.DELIVERED).scalar() or 0

    return {
        "total_customers": total_customers,
        "total_sellers": total_sellers,
        "total_products": total_products,
        "total_sales": round(total_sales, 2)
    }

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

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

from pydantic import BaseModel

class ReviewDecision(BaseModel):
    decision: str # "approve" or "reject"

from uuid import UUID

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
