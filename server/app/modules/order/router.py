from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.order import schemas, services
from app.modules.user.router import get_current_user
from app.modules.user.models import User
from typing import List
from uuid import UUID

router = APIRouter()

@router.post("/", response_model=schemas.OrderResponse)
def create_new_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.create_order(db, current_user.id, order_in.shipping_address, order_in.reward_id)

@router.get("/", response_model=List[schemas.OrderResponse])
def read_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.get_user_orders(db, current_user.id)

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def read_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = services.get_order(db, order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.put("/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(
    order_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = services.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Simple check: only admins can update any status, or payment logic updates to 'paid'
    # For now, let's allow it for the flow
    order.status = status
    db.commit()
    db.refresh(order)
    return order
