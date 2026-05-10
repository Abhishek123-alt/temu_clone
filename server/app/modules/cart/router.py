from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.cart import schemas, services
from app.modules.user.router import get_current_user
from app.modules.user.models import User
from typing import List

router = APIRouter()

@router.get("/", response_model=schemas.CartResponse)
def get_cart(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return services.get_or_create_cart(db, user_id=current_user.id)

@router.post("/items", response_model=schemas.CartItemResponse)
def add_item(item_in: schemas.CartItemBase, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cart = services.get_or_create_cart(db, user_id=current_user.id)
    return services.add_item_to_cart(db, cart_id=cart.id, product_id=item_in.product_id, quantity=item_in.quantity)

@router.put("/items/{product_id}", response_model=schemas.CartItemResponse)
def update_item(product_id: str, item_in: schemas.CartItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cart = services.get_or_create_cart(db, user_id=current_user.id)
    item = services.update_cart_item(db, cart_id=cart.id, product_id=product_id, quantity=item_in.quantity)
    if not item:
        raise HTTPException(status_code=404, detail="Item not in cart")
    return item

@router.delete("/items/{product_id}")
def remove_item(product_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cart = services.get_or_create_cart(db, user_id=current_user.id)
    services.remove_item_from_cart(db, cart_id=cart.id, product_id=product_id)
    return {"message": "Item removed"}
