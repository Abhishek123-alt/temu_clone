from sqlalchemy.orm import Session, joinedload
from app.modules.product.models import Product, Category, WishlistItem, RecentlyViewed, ProductOption, ProductOptionValue, ProductVariant, VariantOptionValue, ProductImage
from app.modules.product import schemas
from app.core.embeddings import generate_embedding
from typing import List
import uuid
import re

def get_products(db: Session, skip: int = 0, limit: int = 20, search: str = None, deal_only: bool = False, normal_only: bool = False, category_id: str = None, new_arrivals: bool = False, sort_by: str = None):
    query = db.query(Product)

    if deal_only:
        query = query.filter(Product.original_price != None, Product.original_price > Product.price)
    if normal_only:
        query = query.filter((Product.original_price == None) | (Product.original_price <= Product.price))
    if category_id:
        category_ids = [category_id]
        children = db.query(Category.id).filter(Category.parent_id == category_id).all()
        category_ids.extend([str(c[0]) for c in children])
        query = query.filter(Product.category_id.in_(category_ids))

    if search:
        query_vector = generate_embedding(search)
        if query_vector:
            query = query.filter(
                (Product.embedding.cosine_distance(query_vector) < 0.4) |
                (Product.title.ilike(f"%{search}%")) |
                (Product.description.ilike(f"%{search}%"))
            )
            # Default order for search is relevance if not specified
            if not sort_by:
                query = query.order_by(Product.embedding.cosine_distance(query_vector))
        else:
            query = query.filter(
                (Product.title.ilike(f"%{search}%")) |
                (Product.description.ilike(f"%{search}%"))
            )

    # Handle explicit sorting
    if sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort_by == "top_sales":
        query = query.order_by(Product.sales_count.desc())
    elif not search:
        if new_arrivals:
            query = query.order_by(Product.created_at.desc())
        else:
            query = query.order_by(Product.updated_at.desc())

    return query.offset(skip).limit(limit).all()

def get_product_by_slug(db: Session, slug: str):
    return db.query(Product).options(
        joinedload(Product.images),
        joinedload(Product.options).joinedload(ProductOption.values),
        joinedload(Product.variants).joinedload(ProductVariant.option_values)
    ).filter(Product.slug == slug).first()

def get_related_products(db: Session, product_id: str, limit: int = 6):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.embedding:
        category_id = product.category_id if product else None
        return get_products(db, limit=limit, category_id=category_id)

    related = db.query(Product).filter(
        Product.id != product_id,
        Product.is_active == True
    ).order_by(
        Product.embedding.cosine_distance(product.embedding)
    ).limit(limit).all()

    return related

def get_recommended_products(db: Session, user_id: str = None, limit: int = 20):
    if user_id:
        recent_views = db.query(RecentlyViewed).filter(
            RecentlyViewed.user_id == user_id
        ).order_by(RecentlyViewed.viewed_at.desc()).limit(10).all()

        if recent_views:
            product_ids = [rv.product_id for rv in recent_views]
            products = db.query(Product).filter(Product.id.in_(product_ids)).all()
            embeddings = [p.embedding for p in products if p.embedding]

            if embeddings:
                centroid = [sum(axis) / len(embeddings) for axis in zip(*embeddings)]
                recommendations = db.query(Product).filter(
                    Product.is_active == True
                ).order_by(
                    Product.embedding.cosine_distance(centroid)
                ).limit(limit).all()

                viewed_ids = {p.id for p in products}
                final_recs = [p for p in recommendations if p.id not in viewed_ids]

                if len(final_recs) >= limit // 2:
                    return final_recs[:limit]

    return db.query(Product).filter(
        Product.is_active == True
    ).order_by(
        (Product.rating * Product.review_count).desc(),
        Product.created_at.desc()
    ).limit(limit).all()

def get_categories(db: Session):
    return db.query(Category).all()

def create_category(db: Session, category_in: schemas.CategoryCreate):
    slug = re.sub(r'[^a-z0-9]+', '-', category_in.name.lower()).strip('-')
    db_category = Category(**category_in.dict(), slug=slug)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def update_category(db: Session, category_id, category_in: schemas.CategoryCreate):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        return None

    update_data = category_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)

    if "name" in update_data:
        db_category.slug = re.sub(r'[^a-z0-9]+', '-', db_category.name.lower()).strip('-')

    db.commit()
    db.refresh(db_category)
    return db_category

def delete_category(db: Session, category_id):
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if db_category:
        db.delete(db_category)
        db.commit()
        return True
    return False

def create_product(db: Session, product_in, seller_id):
    slug = re.sub(r'[^a-z0-9]+', '-', product_in.title.lower()).strip('-')
    embedding = generate_embedding(f"{product_in.title} {product_in.description}")

    base_data = product_in.dict(exclude={'images', 'options', 'variants'})
    product = Product(
        **base_data,
        slug=slug,
        seller_id=seller_id,
        embedding=embedding
    )
    db.add(product)
    db.flush()

    if product_in.images:
        for i, img_url in enumerate(product_in.images):
            existing_img = db.query(ProductImage).filter(ProductImage.url == img_url).first()
            if existing_img:
                separator = "&" if "?" in img_url else "?"
                img_url = f"{img_url}{separator}unique={uuid.uuid4().hex[:6]}"

            img = ProductImage(product_id=product.id, url=img_url, is_main=(i==0))
            db.add(img)

    if product_in.options:
        for opt_in in product_in.options:
            option = ProductOption(
                product_id=product.id,
                name=opt_in.name,
                sort_order=0
            )
            db.add(option)
            db.flush()

            for val_str in opt_in.values:
                val = ProductOptionValue(
                    option_id=option.id,
                    value=val_str
                )
                db.add(val)

    if product_in.variants:
        for var_in in product_in.variants:
            variant = ProductVariant(
                product_id=product.id,
                sku=var_in.sku,
                price=var_in.price,
                original_price=var_in.original_price,
                stock=var_in.stock
            )
            db.add(variant)
            db.flush()

            for val_str in var_in.option_values:
                opt_val = db.query(ProductOptionValue).filter(
                    ProductOptionValue.value == val_str,
                    ProductOptionValue.option.has(ProductOption.product_id == product.id)
                ).first()
                if opt_val:
                    vov = VariantOptionValue(
                        variant_id=variant.id,
                        option_value_id=opt_val.id
                    )
                    db.add(vov)

    db.commit()
    db.refresh(product)
    return product

def get_wishlist(db: Session, user_id: str):
    return db.query(WishlistItem).filter(WishlistItem.user_id == user_id).options(joinedload(WishlistItem.product)).all()

def add_to_wishlist(db: Session, user_id: str, product_id: str):
    existing = db.query(WishlistItem).filter(
        WishlistItem.user_id == user_id,
        WishlistItem.product_id == product_id
    ).first()
    if existing:
        return existing

    wish_item = WishlistItem(user_id=user_id, product_id=product_id)
    db.add(wish_item)
    db.commit()
    db.refresh(wish_item)
    return wish_item

def remove_from_wishlist(db: Session, user_id: str, product_id: str):
    db.query(WishlistItem).filter(
        WishlistItem.user_id == user_id,
        WishlistItem.product_id == product_id
    ).delete()
    db.commit()

def get_recently_viewed(db: Session, user_id: str, limit: int = 10):
    return db.query(RecentlyViewed).filter(
        RecentlyViewed.user_id == user_id
    ).order_by(RecentlyViewed.viewed_at.desc()).limit(limit).all()

def add_to_recently_viewed(db: Session, user_id: str, product_id: str):
    from datetime import datetime, UTC
    existing = db.query(RecentlyViewed).filter(
        RecentlyViewed.user_id == user_id,
        RecentlyViewed.product_id == product_id
    ).first()

    if existing:
        existing.viewed_at = datetime.now(UTC)
    else:
        new_view = RecentlyViewed(user_id=user_id, product_id=product_id)
        db.add(new_view)

    db.commit()

    from app.modules.quest import services as quest_services
    quest_services.update_quest_progress(db, user_id, "PRODUCT_VIEW")

def update_product(db: Session, product_id, product_in, seller_id):
    from app.modules.product.models import Product, ProductImage
    import re
    product = db.query(Product).filter(Product.id == product_id, Product.seller_id == seller_id).first()
    if not product:
        return None

    update_data = product_in.dict(exclude_unset=True, exclude={'images', 'options', 'variants'})
    for field, value in update_data.items():
        setattr(product, field, value)

    if "title" in update_data or "description" in update_data:
        product.embedding = generate_embedding(f"{product.title} {product.description}")
        product.slug = re.sub(r'[^a-z0-9]+', '-', product.title.lower()).strip('-')

    if product_in.images is not None:
        db.query(ProductImage).filter(ProductImage.product_id == product.id).delete()
        for i, img_url in enumerate(product_in.images):
            existing_img = db.query(ProductImage).filter(ProductImage.url == img_url).first()
            if existing_img:
                separator = "&" if "?" in img_url else "?"
                img_url = f"{img_url}{separator}unique={uuid.uuid4().hex[:6]}"

            img = ProductImage(product_id=product.id, url=img_url, is_main=(i==0))
            db.add(img)

    db.commit()
    db.refresh(product)
    return product

def get_seller_products(db: Session, seller_id):
    return db.query(Product).filter(Product.seller_id == seller_id).order_by(Product.updated_at.desc()).all()

def delete_product(db: Session, product_id, seller_id):
    from app.modules.product.models import Product
    from app.modules.order.models import OrderItem
    from sqlalchemy import text

    product = db.query(Product).filter(Product.id == product_id, Product.seller_id == seller_id).first()
    if not product:
        return False

    try:
        db.execute(text("ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL"))
        db.commit()
    except Exception as e:
        print(f"Note: Could not drop NOT NULL constraint: {e}")

    db.query(OrderItem).filter(OrderItem.product_id == product_id).update({"product_id": None})
    db.delete(product)
    db.commit()
    return True
