from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.modules.user.models import User, UserRole
from app.modules.product.models import Product

router = APIRouter()

@router.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    total_customers = db.query(User).filter(User.role == UserRole.CUSTOMER).count()
    total_sellers = db.query(User).filter(User.role == UserRole.SELLER).count()
    total_products = db.query(Product).count()
    
    return {
        "total_customers": total_customers,
        "total_sellers": total_sellers,
        "total_products": total_products,
        "total_sales": 0 # Placeholder until orders are implemented
    }

@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users
