from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.product import schemas, services
from typing import List

router = APIRouter()

@router.get("/", response_model=List[schemas.ProductResponse])
def read_products(skip: int = 0, limit: int = 20, search: str = None, db: Session = Depends(get_db)):
    products = services.get_products(db, skip=skip, limit=limit, search=search)
    return products

@router.get("/categories", response_model=List[schemas.CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return services.get_categories(db)

@router.get("/{slug}", response_model=schemas.ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = services.get_product_by_slug(db, slug=slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
