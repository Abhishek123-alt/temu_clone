from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.user.router import get_current_user
from app.modules.review.schemas import ReviewCreate, ReviewRead, ReviewWithUser
from app.modules.review.services import create_review, get_product_reviews
from app.modules.user.models import User

router = APIRouter(tags=["Reviews"])

@router.post("/", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def post_review(
    review_in: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a product review.
    """
    return create_review(
        db=db,
        user_id=current_user.id,
        product_id=review_in.product_id,
        rating=review_in.rating,
        comment=review_in.comment
    )

@router.get("/product/{product_id}", response_model=list[ReviewWithUser])
def read_product_reviews(
    product_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all reviews for a specific product.
    """
    return get_product_reviews(db, product_id)
