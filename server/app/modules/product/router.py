from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
import shutil
import os
import uuid
import json
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.product import schemas, services
from typing import Dict, List, Optional
from app.modules.user.models import User, UserRole
from app.modules.user.router import get_current_user
from uuid import UUID

router = APIRouter()

@router.post("/upload")
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.SELLER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only sellers can upload images")
        
    ext = file.filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = f"uploads/{filename}"
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return absolute URL to be saved in DB
    return {"url": f"http://localhost:8000/uploads/{filename}"}

@router.get("/related/{product_id}", response_model=List[schemas.ProductResponse])
def get_related_products(
    product_id: UUID,
    db: Session = Depends(get_db),
    limit: int = 6
):
    return services.get_related_products(db, product_id=product_id, limit=limit)

@router.get("/recommended", response_model=List[schemas.ProductResponse])
def get_recommended_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20
):
    # Use the current_user.id if available for personalized recommendations
    return services.get_recommended_products(db, user_id=current_user.id, limit=limit)

@router.get("/", response_model=List[schemas.ProductResponse])
def read_products(
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    deal_only: bool = False,
    normal_only: bool = False,
    category_id: str = None,
    new_arrivals: bool = False,
    sort_by: str = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    include_out_of_stock: bool = False,
    # JSON-encoded attribute filters, e.g. {"ram":"16GB","brand":"Dell"}
    filters: Optional[str] = Query(None, description='JSON object of attribute filters e.g. {"ram":"16GB"}'),
    db: Session = Depends(get_db)
):
    attribute_filters = None
    if filters:
        try:
            attribute_filters = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="filters must be valid JSON")

    products = services.get_products(
        db, skip=skip, limit=limit, search=search, deal_only=deal_only,
        normal_only=normal_only, category_id=category_id, new_arrivals=new_arrivals,
        sort_by=sort_by, attribute_filters=attribute_filters,
        price_min=price_min, price_max=price_max,
        include_out_of_stock=include_out_of_stock,
    )
    return products

@router.get("/facets", response_model=schemas.ProductFacetsResponse)
def read_product_facets(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    deal_only: bool = False,
    normal_only: bool = False,
    new_arrivals: bool = False,
    db: Session = Depends(get_db),
):
    """Aggregate attribute facets + price range for products matching the
    given base filters. Used by the search page to drive its filter sidebar."""
    return services.get_product_facets(
        db,
        search=search,
        category_id=category_id,
        deal_only=deal_only,
        normal_only=normal_only,
        new_arrivals=new_arrivals,
    )

@router.get("/categories", response_model=List[schemas.CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return services.get_categories(db)

@router.post("/categories", response_model=schemas.CategoryResponse)
def create_category(
    category_in: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create categories")
    return services.create_category(db, category_in)

@router.put("/categories/{category_id}", response_model=schemas.CategoryResponse)
def update_category(
    category_id: UUID,
    category_in: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update categories")
    category = services.update_category(db, category_id, category_in)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete categories")
    success = services.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "success"}

@router.get("/categories/{category_id}/attributes", response_model=List[schemas.CategoryAttributeDefinitionResponse])
def get_category_attributes(category_id: UUID, db: Session = Depends(get_db)):
    """Return the dynamic field definitions for a category (used to build forms and filter sidebars)."""
    return services.get_category_attribute_definitions(db, str(category_id))

@router.post("/categories/{category_id}/attributes", response_model=schemas.CategoryAttributeDefinitionResponse)
def create_category_attribute(
    category_id: UUID,
    definition_in: schemas.CategoryAttributeDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage attribute definitions")
    return services.create_attribute_definition(db, str(category_id), definition_in)

@router.put("/attributes/{definition_id}", response_model=schemas.CategoryAttributeDefinitionResponse)
def update_category_attribute(
    definition_id: UUID,
    definition_in: schemas.CategoryAttributeDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage attribute definitions")
    result = services.update_attribute_definition(db, str(definition_id), definition_in)
    if not result:
        raise HTTPException(status_code=404, detail="Attribute definition not found")
    return result

@router.delete("/attributes/{definition_id}")
def delete_category_attribute(
    definition_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage attribute definitions")
    if not services.delete_attribute_definition(db, str(definition_id)):
        raise HTTPException(status_code=404, detail="Attribute definition not found")
    return {"status": "success"}


@router.get("/me", response_model=List[schemas.ProductResponse])
def read_my_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.SELLER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only sellers can access this")
    return services.get_seller_products(db, current_user.id)

@router.get("/{slug}", response_model=schemas.ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = services.get_product_by_slug(db, slug=slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

from app.modules.quest import services as quest_services

@router.post("/", response_model=schemas.ProductResponse)
def create_product(
    product_in: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.SELLER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to create products")
    res = services.create_product(db, product_in, current_user.id)
    quest_services.update_quest_progress(db, current_user.id, "PRODUCT_UPLOAD")
    return res

@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: UUID,
    product_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = services.update_product(db, product_id, product_in, current_user.id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or not owned by you")
    return product

@router.delete("/{product_id}")
def delete_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = services.delete_product(db, product_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found or not owned by you")
    return {"status": "success"}
