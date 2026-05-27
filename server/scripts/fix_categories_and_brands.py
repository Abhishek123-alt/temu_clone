"""
Fix category hierarchy + slug consistency, and add fashion brands list to DB.
Run with: python3 -m scripts.fix_categories_and_brands
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category, CategoryAttributeDefinition


FASHION_BRANDS = [
    "Nike", "Adidas", "Puma", "Levi's", "H&M", "Zara", "Uniqlo",
    "Gucci", "Prada", "Calvin Klein", "Tommy Hilfiger", "Ralph Lauren",
    "Gap", "Forever 21", "Mango", "Under Armour", "Reebok", "New Balance",
    "Old Navy", "American Eagle", "Lululemon", "Champion", "Hollister",
    "Diesel", "Burberry", "Lacoste", "Versace", "Armani", "Hugo Boss",
    "Other",
]

# Slug renames: (old_slug, new_slug)
SLUG_RENAMES = [
    ("smartphones", "electronics-smartphones"),
]

# Categories to remove (only if they have no products and no children)
CATEGORIES_TO_REMOVE = ["new-arrivals"]


def upsert_brand_attribute(db, category, brands):
    existing = db.query(CategoryAttributeDefinition).filter(
        CategoryAttributeDefinition.category_id == category.id,
        CategoryAttributeDefinition.key == "brand"
    ).first()

    if existing:
        existing.field_type = "select"
        existing.options = brands
        existing.filterable = True
        print(f"  [Updated]  brand definition for '{category.slug}' ({len(brands)} options)")
    else:
        db.add(CategoryAttributeDefinition(
            category_id=category.id,
            key="brand",
            label="Brand",
            field_type="select",
            options=brands,
            filterable=True,
            sort_order=0,
        ))
        print(f"  [Inserted] brand definition for '{category.slug}' ({len(brands)} options)")


def fix():
    db = SessionLocal()
    try:
        print("\n1. Adding fashion brands list to DB")
        fashion_slugs = ["fashion", "fashion-men", "fashion-women", "fashion-kids"]
        for slug in fashion_slugs:
            cat = db.query(Category).filter(Category.slug == slug).first()
            if cat:
                upsert_brand_attribute(db, cat, FASHION_BRANDS)
            else:
                print(f"  [SKIP] category '{slug}' not found")

        print("\n2. Standardising slug names")
        for old, new in SLUG_RENAMES:
            cat = db.query(Category).filter(Category.slug == old).first()
            if not cat:
                print(f"  [SKIP] '{old}' not found")
                continue
            if cat.slug == new:
                print(f"  [OK]   '{old}' already named '{new}'")
                continue
            cat.slug = new
            print(f"  [Renamed] '{old}' → '{new}'")

        print("\n3. Removing non-real top-level 'categories'")
        from app.modules.product.models import Product
        for slug in CATEGORIES_TO_REMOVE:
            cat = db.query(Category).filter(Category.slug == slug).first()
            if not cat:
                print(f"  [SKIP] '{slug}' not found")
                continue
            child_count = db.query(Category).filter(Category.parent_id == cat.id).count()
            product_count = db.query(Product).filter(Product.category_id == cat.id).count()
            if child_count or product_count:
                print(f"  [SKIP] '{slug}' has {child_count} children, {product_count} products — leaving alone")
                continue
            db.delete(cat)
            print(f"  [Deleted] '{slug}'")

        db.commit()
        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    fix()
