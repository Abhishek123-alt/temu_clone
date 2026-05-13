from sqlalchemy.orm import Session
from sqlalchemy import select, func, update
from app.modules.review.models import Review
from app.modules.product.models import Product
from app.modules.order.models import Order, OrderItem, OrderStatus
from fastapi import HTTPException, status
from app.modules.review.schemas import ReviewWithUser

def verify_purchase_eligibility(db: Session, user_id, product_id):
    """
    Checks if the user has an order containing the product.
    """
    query = (
        select(Order)
        .join(OrderItem)
        .where(Order.user_id == user_id)
        .where(OrderItem.product_id == product_id)
    )
    result = db.execute(query).first()
    return result is not None

def create_review(db: Session, user_id, product_id, rating, comment):
    """
    Creates a review and updates product rating atomically.
    """
    # 1. Check eligibility
    if not verify_purchase_eligibility(db, user_id, product_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review products you have ordered."
        )

    # 2. Check if already reviewed
    existing = db.query(Review).filter(
        Review.user_id == user_id,
        Review.product_id == product_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this product."
        )

    # 3. Create the review
    new_review = Review(
        user_id=user_id,
        product_id=product_id,
        rating=rating,
        comment=comment
    )
    db.add(new_review)

    # 4. Update product rating (Atomic update)
    # Lock the product row to avoid race conditions
    product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    old_count = product.review_count
    old_rating = product.rating

    new_count = old_count + 1
    new_rating = ((old_rating * old_count) + rating) / new_count

    product.review_count = new_count
    product.rating = new_rating

    db.commit()
    db.refresh(new_review)
    return new_review

def get_product_reviews(db: Session, product_id):
    """
    Retrieves all reviews for a product with user details.
    """
    from app.modules.user.models import User # Avoid circular import

    # Use a simpler query and then map the results
    reviews_objs = db.query(Review).filter(Review.product_id == product_id).order_by(Review.created_at.desc()).all()
    
    results = []
    for r in reviews_objs:
        user = db.query(User).filter(User.id == r.user_id).first()
        results.append(ReviewWithUser(
            id=r.id,
            user_id=r.user_id,
            product_id=r.product_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            user_name=user.full_name if user else "Anonymous",
            user_avatar=None
        ))
    
    return results
