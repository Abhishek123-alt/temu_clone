from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.order import schemas, services, models
from app.modules.user.router import get_current_user
from app.modules.user.models import User, UserRole
from typing import List, Optional
from uuid import UUID

router = APIRouter()

@router.post("/", response_model=schemas.OrderResponse)
def create_new_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.create_order(
        db,
        current_user.id,
        order_in.shipping_address,
        order_in.reward_id,
        order_in.payment_method_id,
        cart_item_ids=order_in.cart_item_ids,
    )

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
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Allow user to see their own order, or Admin/Seller to see relevant orders
    if order.user_id != current_user.id and current_user.role == UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")
        
    return order

@router.put("/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(
    order_id: UUID,
    update: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, strict RBAC here
    actor = models.OrderActor.ADMIN if current_user.role == UserRole.ADMIN else models.OrderActor.SYSTEM
    return services.update_order_status(db, order_id, update.status, actor, update.reason, update.metadata)

@router.post("/{order_id}/shipments", response_model=schemas.ShipmentResponse)
def create_order_shipment(
    order_id: UUID,
    shipment_in: schemas.ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.SELLER]:
        raise HTTPException(status_code=403, detail="Only admins or sellers can create shipments")
    return services.create_shipment(db, order_id, shipment_in.carrier, shipment_in.tracking_number, shipment_in.tracking_url)

@router.post("/{order_id}/returns", response_model=schemas.ReturnResponse)
def request_order_return(
    order_id: UUID,
    return_in: schemas.ReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.request_return(db, current_user.id, order_id, return_in)

@router.get("/{order_id}/tracking", response_model=List[schemas.ShipmentResponse])
def get_order_tracking(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = services.get_order(db, order_id)
    if not order or (order.user_id != current_user.id and current_user.role == UserRole.CUSTOMER):
        raise HTTPException(status_code=404, detail="Order not found")
    return order.shipments

@router.post("/returns/{return_id}/process", response_model=schemas.OrderResponse)
def process_return(
    return_id: UUID,
    approved: bool,
    reason: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.SELLER]:
        raise HTTPException(status_code=403, detail="Only admins or sellers can process returns")
    is_admin = current_user.role == UserRole.ADMIN
    return services.process_return_request(db, current_user.id, return_id, approved, reason, is_admin=is_admin)

@router.get("/seller/orders", response_model=List[schemas.OrderResponse])
def read_seller_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.SELLER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only sellers can view seller orders")
    return services.get_seller_orders(db, current_user.id)

@router.get("/seller/returns", response_model=List[schemas.ReturnDetailResponse])
def read_seller_returns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.SELLER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only sellers can view return requests")

    # Sellers see their own returns (all statuses). Admins see only disputes —
    # returns the seller has rejected — so untouched return requests stay with the seller.
    is_admin = current_user.role == UserRole.ADMIN
    seller_id = None if is_admin else current_user.id
    return services.get_seller_returns(db, seller_id, admin_view=is_admin)
