from sqlalchemy.orm import Session
from app.modules.product.models import Product, Category
from app.core.embeddings import generate_embedding
from typing import List

def get_products(db: Session, skip: int = 0, limit: int = 20, search: str = None):
    query = db.query(Product)
    if search:
        # Generate embedding for the search query
        query_vector = generate_embedding(search)
        
        if query_vector:
            # HYBRID SEARCH: Semantic match OR Text match
            query = query.filter(
                (Product.embedding.cosine_distance(query_vector) < 0.8) | # Lenient threshold
                (Product.title.ilike(f"%{search}%")) |
                (Product.description.ilike(f"%{search}%"))
            )
            # Sort by cosine similarity
            query = query.order_by(Product.embedding.cosine_distance(query_vector))
        else:
            # Fallback to basic text match if embedding fails
            query = query.filter(
                (Product.title.ilike(f"%{search}%")) | 
                (Product.description.ilike(f"%{search}%"))
            )
    return query.offset(skip).limit(limit).all()

def get_product_by_slug(db: Session, slug: str):
    return db.query(Product).filter(Product.slug == slug).first()

def get_categories(db: Session):
    return db.query(Category).all()

def create_product(db: Session, product_in, seller_id):
    from app.modules.product.models import Product
    import slugify # Ensure you have this or use a simple slug logic
    
    # Generate slug if not provided
    slug = product_in.title.lower().replace(" ", "-")
    
    # Generate Embedding on the fly
    embedding = generate_embedding(f"{product_in.title} {product_in.description}")
    
    product = Product(
        **product_in.dict(),
        slug=slug,
        seller_id=seller_id,
        embedding=embedding
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
