from sqlalchemy.orm import Session, joinedload
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import cast, or_, case, literal
from app.modules.product.models import Product, Category, CategoryAttributeDefinition, WishlistItem, RecentlyViewed, ProductOption, ProductOptionValue, ProductVariant, VariantOptionValue, ProductImage
from app.modules.product import schemas
from app.core.embeddings import generate_embedding
from typing import Dict, List, Any, Optional
import uuid
import re


def _generate_unique_slug(db: Session, title: str, exclude_id=None) -> str:
    """Slugify a title and guarantee uniqueness across the products table.
    Appends -2, -3, ... if the base slug is already taken by another product."""
    base = re.sub(r'[^a-z0-9]+', '-', (title or '').lower()).strip('-') or "product"
    candidate = base
    suffix = 2
    while True:
        q = db.query(Product.id).filter(Product.slug == candidate)
        if exclude_id is not None:
            q = q.filter(Product.id != exclude_id)
        if q.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _tokenize_search(search: str) -> List[str]:
    """Split a query into lowercase tokens of length >= 2. Used so 'red shoes'
    matches products whose title contains 'shoes' even if not the full phrase."""
    if not search:
        return []
    return [t for t in re.split(r"\s+", search.strip().lower()) if len(t) >= 2]


def _expand_category_ids_matching_search(
    db: Session,
    search: str,
    tokens: Optional[List[str]] = None,
    query_vector: Optional[List[float]] = None,
) -> List[str]:
    """Find categories whose name matches the search term (or any of its
    tokens), then expand to include all of their descendant categories. When a
    query embedding is provided, also pull semantically-close categories
    (cosine_distance < 0.35) so 'mobile' surfaces a 'Smartphones' category.
    Returns a flat list of UUID strings suitable for `Product.category_id.in_(...)`."""
    text_clauses = [Category.name.ilike(f"%{search}%")]
    for token in (tokens or []):
        text_clauses.append(Category.name.ilike(f"%{token}%"))

    filter_clause = or_(*text_clauses)
    if query_vector is not None:
        filter_clause = or_(
            filter_clause,
            Category.embedding.cosine_distance(query_vector) < 0.35,
        )

    matched = db.query(Category.id).filter(filter_clause).all()
    matched_ids = {str(c[0]) for c in matched}
    if not matched_ids:
        return []

    # Expand to descendants (one level is what other filters rely on; mirror that
    # behavior so a search for a parent category surfaces its subcategories too).
    children = db.query(Category.id).filter(Category.parent_id.in_(list(matched_ids))).all()
    matched_ids.update(str(c[0]) for c in children)
    return list(matched_ids)

def get_products(db: Session, skip: int = 0, limit: int = 20, search: str = None, deal_only: bool = False, normal_only: bool = False, category_id: str = None, new_arrivals: bool = False, sort_by: str = None, attribute_filters: Optional[Dict[str, Any]] = None, price_min: Optional[float] = None, price_max: Optional[float] = None, include_out_of_stock: bool = False):
    query = db.query(Product)

    if not include_out_of_stock:
        query = query.filter(Product.stock > 0)

    if deal_only:
        query = query.filter(Product.original_price != None, Product.original_price > Product.price)
    if normal_only:
        query = query.filter((Product.original_price == None) | (Product.original_price <= Product.price))
    if category_id:
        category_ids = [category_id]
        children = db.query(Category.id).filter(Category.parent_id == category_id).all()
        category_ids.extend([str(c[0]) for c in children])
        query = query.filter(Product.category_id.in_(category_ids))

    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)

    if attribute_filters:
        for key, value in attribute_filters.items():
            # Use PostgreSQL JSONB containment: attributes @> '{"key": "value"}'
            query = query.filter(
                Product.attributes[key].astext == str(value)
            )

    if search:
        tokens = _tokenize_search(search)
        query_vector = generate_embedding(search)
        category_match_ids = _expand_category_ids_matching_search(db, search, tokens, query_vector)

        title_terms = [Product.title.ilike(f"%{search}%")] + [Product.title.ilike(f"%{t}%") for t in tokens]
        desc_terms = [Product.description.ilike(f"%{search}%")] + [Product.description.ilike(f"%{t}%") for t in tokens]
        title_match = or_(*title_terms)
        desc_match = or_(*desc_terms)

        text_clauses = [title_match, desc_match]
        if category_match_ids:
            text_clauses.append(Product.category_id.in_(category_match_ids))

        if query_vector:
            query = query.filter(
                or_(
                    Product.embedding.cosine_distance(query_vector) < 0.35,
                    *text_clauses,
                )
            )
            # Default order for search: text matches first (title > desc > category),
            # then pure semantic neighbors, finally tie-break by embedding distance.
            if not sort_by:
                rank_whens = [(title_match, 0), (desc_match, 1)]
                if category_match_ids:
                    rank_whens.append((Product.category_id.in_(category_match_ids), 2))
                rank_case = case(*rank_whens, else_=3)
                query = query.order_by(rank_case, Product.embedding.cosine_distance(query_vector))
        else:
            query = query.filter(or_(*text_clauses))

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

def get_product_facets(
    db: Session,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    deal_only: bool = False,
    normal_only: bool = False,
    new_arrivals: bool = False,
    sample_limit: int = 1000,
) -> Dict[str, Any]:
    """Compute attribute facets + price range for products matching the given
    base filters (search/category). Intentionally ignores attribute_filters so
    that users can see all available filter options regardless of their current
    selection."""

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
        tokens = _tokenize_search(search)
        query_vector = generate_embedding(search)
        category_match_ids = _expand_category_ids_matching_search(db, search, tokens, query_vector)

        title_terms = [Product.title.ilike(f"%{search}%")] + [Product.title.ilike(f"%{t}%") for t in tokens]
        desc_terms = [Product.description.ilike(f"%{search}%")] + [Product.description.ilike(f"%{t}%") for t in tokens]
        text_clauses = [or_(*title_terms), or_(*desc_terms)]
        if category_match_ids:
            text_clauses.append(Product.category_id.in_(category_match_ids))

        if query_vector:
            query = query.filter(
                or_(
                    Product.embedding.cosine_distance(query_vector) < 0.35,
                    *text_clauses,
                )
            )
        else:
            query = query.filter(or_(*text_clauses))

    products = query.limit(sample_limit).all()

    # Aggregate attribute key -> value -> count
    aggregated: Dict[str, Dict[str, int]] = {}
    category_ids_seen = set()
    price_min: Optional[float] = None
    price_max: Optional[float] = None

    for p in products:
        if p.price is not None:
            price_min = p.price if price_min is None else min(price_min, p.price)
            price_max = p.price if price_max is None else max(price_max, p.price)
        if p.category_id:
            category_ids_seen.add(str(p.category_id))
        if not p.attributes:
            continue
        for k, v in p.attributes.items():
            if v is None or v == "":
                continue
            # Normalize value to string for consistent counting
            v_str = str(v)
            bucket = aggregated.setdefault(k, {})
            bucket[v_str] = bucket.get(v_str, 0) + 1

    # Pull definitions for the categories that actually appear in results so we
    # can label each key nicely and respect filterable=False to hide noisy keys.
    definitions_by_key: Dict[str, CategoryAttributeDefinition] = {}
    for cid in category_ids_seen:
        for d in get_category_attribute_definitions(db, cid):
            # First definition seen for a key wins — categories merge cleanly enough for labels
            definitions_by_key.setdefault(d.key, d)

    facets = []
    for key, value_counts in aggregated.items():
        definition = definitions_by_key.get(key)
        if definition and not definition.filterable:
            continue
        label = definition.label if definition else key.replace("_", " ").title()
        field_type = definition.field_type if definition else "select"
        sort_order = definition.sort_order if definition else 999
        values = sorted(
            [{"value": v, "count": c} for v, c in value_counts.items()],
            key=lambda x: (-x["count"], x["value"]),
        )
        facets.append({
            "key": key,
            "label": label,
            "field_type": field_type,
            "values": values,
            "_sort_order": sort_order,
        })

    facets.sort(key=lambda f: (f["_sort_order"], f["label"]))
    for f in facets:
        f.pop("_sort_order", None)

    return {
        "attributes": facets,
        "price_min": price_min,
        "price_max": price_max,
        "total": len(products),
    }


def get_product_by_slug(db: Session, slug: str):
    return db.query(Product).options(
        joinedload(Product.images),
        joinedload(Product.options).joinedload(ProductOption.values),
        joinedload(Product.variants).joinedload(ProductVariant.option_values)
    ).filter(Product.slug == slug).first()

def get_related_products(db: Session, product_id: str, limit: int = 6):
    product = db.query(Product).filter(Product.id == product_id).first()
    # NOTE: embedding is a numpy array — use `is None` to avoid
    # "truth value of an array is ambiguous" when checking the vector.
    if product is None or product.embedding is None:
        category_id = product.category_id if product else None
        return get_products(db, limit=limit, category_id=category_id)

    related = db.query(Product).filter(
        Product.id != product_id,
        Product.is_active == True,
        Product.embedding.isnot(None),
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
            # NOTE: embedding is a numpy array — `if p.embedding` raises
            # ValueError on arrays; check `is not None` explicitly.
            embeddings = [p.embedding for p in products if p.embedding is not None]

            if embeddings:
                centroid = [sum(axis) / len(embeddings) for axis in zip(*embeddings)]
                recommendations = db.query(Product).filter(
                    Product.is_active == True,
                    Product.stock > 0,
                    Product.embedding.isnot(None),
                ).order_by(
                    Product.embedding.cosine_distance(centroid)
                ).limit(limit).all()

                viewed_ids = {p.id for p in products}
                final_recs = [p for p in recommendations if p.id not in viewed_ids]

                if len(final_recs) >= limit // 2:
                    return final_recs[:limit]

    return db.query(Product).filter(
        Product.is_active == True,
        Product.stock > 0,
    ).order_by(
        (Product.rating * Product.review_count).desc(),
        Product.created_at.desc()
    ).limit(limit).all()

def get_categories(db: Session):
    return db.query(Category).order_by(Category.name).all()

def _category_embedding_text(name: str, description: Optional[str]) -> str:
    return f"{name or ''} {description or ''}".strip()


def create_category(db: Session, category_in: schemas.CategoryCreate):
    slug = re.sub(r'[^a-z0-9]+', '-', category_in.name.lower()).strip('-')
    embedding = generate_embedding(_category_embedding_text(category_in.name, category_in.description))
    db_category = Category(**category_in.dict(), slug=slug, embedding=embedding)
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

    if "name" in update_data or "description" in update_data:
        db_category.embedding = generate_embedding(
            _category_embedding_text(db_category.name, db_category.description)
        )

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

def get_category_attribute_definitions(db: Session, category_id: str) -> List[CategoryAttributeDefinition]:
    """Return definitions merged from the category and all its ancestors.
    Deeper (child) definitions override ancestors with the same key.
    So `Fashion → Men → Shirts` inherits Size/Color/Brand from `Men`/`Fashion`."""
    chain: List[Category] = []
    current_id = category_id
    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        cat = db.query(Category).filter(Category.id == current_id).first()
        if not cat:
            break
        chain.append(cat)
        current_id = cat.parent_id

    merged: Dict[str, CategoryAttributeDefinition] = {}
    # Walk root → leaf so child definitions overwrite ancestor ones with the same key
    for cat in reversed(chain):
        defs = db.query(CategoryAttributeDefinition).filter(
            CategoryAttributeDefinition.category_id == cat.id
        ).all()
        for d in defs:
            merged[d.key] = d

    return sorted(merged.values(), key=lambda d: d.sort_order)

def create_attribute_definition(db: Session, category_id: str, definition_in: schemas.CategoryAttributeDefinitionCreate) -> CategoryAttributeDefinition:
    db_def = CategoryAttributeDefinition(
        category_id=category_id,
        **definition_in.dict()
    )
    db.add(db_def)
    db.commit()
    db.refresh(db_def)
    return db_def

def update_attribute_definition(db: Session, definition_id: str, definition_in: schemas.CategoryAttributeDefinitionCreate) -> Optional[CategoryAttributeDefinition]:
    db_def = db.query(CategoryAttributeDefinition).filter(CategoryAttributeDefinition.id == definition_id).first()
    if not db_def:
        return None
    for key, value in definition_in.dict(exclude_unset=True).items():
        setattr(db_def, key, value)
    db.commit()
    db.refresh(db_def)
    return db_def

def delete_attribute_definition(db: Session, definition_id: str) -> bool:
    db_def = db.query(CategoryAttributeDefinition).filter(CategoryAttributeDefinition.id == definition_id).first()
    if not db_def:
        return False
    db.delete(db_def)
    db.commit()
    return True


def create_product(db: Session, product_in, seller_id):
    slug = _generate_unique_slug(db, product_in.title)
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
    product = db.query(Product).filter(Product.id == product_id, Product.seller_id == seller_id).first()
    if not product:
        return None

    update_data = product_in.dict(exclude_unset=True, exclude={'images', 'options', 'variants'})
    old_title = product.title
    for field, value in update_data.items():
        setattr(product, field, value)

    # Merge incoming attributes into existing ones (patch semantics)
    if product_in.attributes is not None:
        existing = product.attributes or {}
        product.attributes = {**existing, **product_in.attributes}

    if "title" in update_data or "description" in update_data:
        product.embedding = generate_embedding(f"{product.title} {product.description}")
    if "title" in update_data and product.title != old_title:
        product.slug = _generate_unique_slug(db, product.title, exclude_id=product.id)

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
