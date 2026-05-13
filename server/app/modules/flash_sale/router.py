from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from datetime import datetime, UTC
from app.db.session import get_db
from sqlalchemy.orm import joinedload
from app.modules.flash_sale import models, schemas
from uuid import UUID
from app.modules.user.router import get_current_user
from app.modules.quest import services as quest_services

router = APIRouter()

@router.get("/active", response_model=List[schemas.FlashSaleResponse])
def get_active_flash_sales(db: Session = Depends(get_db)):
    now = datetime.now(UTC)
    sales = db.query(models.FlashSale).options(
        joinedload(models.FlashSale.products).joinedload(models.FlashSaleProduct.product)
    ).filter(
        models.FlashSale.is_active == True,
        models.FlashSale.start_time <= now,
        models.FlashSale.end_time >= now
    ).all()
    return sales

@router.get("/all", response_model=List[schemas.FlashSaleResponse])
def get_all_flash_sales(db: Session = Depends(get_db)):
    sales = db.query(models.FlashSale).options(
        joinedload(models.FlashSale.products).joinedload(models.FlashSaleProduct.product)
    ).all()
    return sales


@router.get("/{sale_id}", response_model=schemas.FlashSaleResponse)
def get_flash_sale(sale_id: UUID, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    sale = db.query(models.FlashSale).options(
        joinedload(models.FlashSale.products).joinedload(models.FlashSaleProduct.product)
    ).filter(models.FlashSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    quest_services.update_quest_progress(db, current_user.id, "FLASH_SALE_VIEW")
    return sale

@router.post("/admin", response_model=schemas.FlashSaleResponse)
def create_flash_sale(
    sale_in: schemas.FlashSaleCreate,
    db: Session = Depends(get_db)
):
    # In a real app, we would check for admin role here
    sale_data = sale_in.dict(exclude={'products'})
    db_sale = models.FlashSale(**sale_data)
    db.add(db_sale)
    db.flush() # Get the ID
    
    if sale_in.products:
        for p in sale_in.products:
            db_product = models.FlashSaleProduct(**p.dict(), flash_sale_id=db_sale.id)
            db.add(db_product)
    
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.post("/{sale_id}/products")
def add_product_to_sale(
    sale_id: UUID,
    product_in: schemas.FlashSaleProductCreate,
    db: Session = Depends(get_db)
):
    sale = db.query(models.FlashSale).filter(models.FlashSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")

    db_product = models.FlashSaleProduct(**product_in.dict(), flash_sale_id=sale_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product
@router.put("/admin/{sale_id}", response_model=schemas.FlashSaleResponse)
def update_flash_sale(
    sale_id: UUID,
    sale_in: schemas.FlashSaleCreate,
    db: Session = Depends(get_db)
):
    db_sale = db.query(models.FlashSale).filter(models.FlashSale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    
    # Update main fields
    for field, value in sale_in.dict(exclude={'products'}).items():
        setattr(db_sale, field, value)
    
    # Update products (replace all for simplicity in this version)
    db.query(models.FlashSaleProduct).filter(models.FlashSaleProduct.flash_sale_id == sale_id).delete()
    if sale_in.products:
        for p in sale_in.products:
            db_product = models.FlashSaleProduct(**p.dict(), flash_sale_id=sale_id)
            db.add(db_product)
            
    db.commit()
    db.refresh(db_sale)
    return db_sale

@router.delete("/admin/{sale_id}")
def delete_flash_sale(sale_id: UUID, db: Session = Depends(get_db)):
    db_sale = db.query(models.FlashSale).filter(models.FlashSale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    db.delete(db_sale)
    db.commit()
    return {"status": "success"}
