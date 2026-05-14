import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.modules.user.models import User
from app.modules.product.models import Product, ProductVariant, ProductOption, ProductOptionValue, VariantOptionValue

def migrate_products_to_variants():
    print("Starting data migration: Products -> Variants...")
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        count = 0
        for product in products:
            # Create a default variant for every existing product
            variant = ProductVariant(
                product_id=product.id,
                sku=f"{product.slug}-std",
                price=product.price,
                original_price=product.original_price,
                stock=product.stock
            )
            db.add(variant)
            count += 1

        db.commit()
        print(f"Successfully migrated {count} products to variants.")
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_products_to_variants()
