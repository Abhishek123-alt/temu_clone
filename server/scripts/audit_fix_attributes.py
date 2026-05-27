"""
Real-world attribute audit fixes:
  1. Remove 'gender' from Fashion (Men/Women/Kids sub-cats already convey it)
  2. Move 'author' & 'publisher' from 'books' (top-level) → 'books-reading' only
     so Stationery/Office Supplies don't show them.
  3. Move 'form' from 'health' (top-level) → 'health-vitamins' + 'health-medical' only
     so Wellness items don't show it.

Run with: python3 -m scripts.audit_fix_attributes
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category, CategoryAttributeDefinition


def remove_attribute(db, category_slug: str, key: str):
    cat = db.query(Category).filter(Category.slug == category_slug).first()
    if not cat:
        print(f"  [SKIP] category '{category_slug}' not found")
        return None
    defn = db.query(CategoryAttributeDefinition).filter(
        CategoryAttributeDefinition.category_id == cat.id,
        CategoryAttributeDefinition.key == key,
    ).first()
    if not defn:
        print(f"  [OK]   '{category_slug}' has no '{key}' to remove")
        return None
    snapshot = {
        "key": defn.key, "label": defn.label, "field_type": defn.field_type,
        "options": defn.options, "filterable": defn.filterable, "sort_order": defn.sort_order,
    }
    db.delete(defn)
    print(f"  [Removed] '{key}' from '{category_slug}'")
    return snapshot


def add_attribute(db, category_slug: str, snapshot: dict):
    if not snapshot:
        return
    cat = db.query(Category).filter(Category.slug == category_slug).first()
    if not cat:
        print(f"  [SKIP] target category '{category_slug}' not found")
        return
    existing = db.query(CategoryAttributeDefinition).filter(
        CategoryAttributeDefinition.category_id == cat.id,
        CategoryAttributeDefinition.key == snapshot["key"],
    ).first()
    if existing:
        print(f"  [OK]   '{category_slug}' already has '{snapshot['key']}'")
        return
    db.add(CategoryAttributeDefinition(category_id=cat.id, **snapshot))
    print(f"  [Added]   '{snapshot['key']}' to '{category_slug}'")


def run():
    db = SessionLocal()
    try:
        print("\n1. Removing redundant 'gender' from Fashion")
        remove_attribute(db, "fashion", "gender")

        print("\n2. Moving 'author' & 'publisher' from books (L1) → books-reading (L2)")
        for key in ("author", "publisher"):
            snap = remove_attribute(db, "books", key)
            if snap:
                add_attribute(db, "books-reading", snap)

        print("\n3. Moving 'form' from health (L1) → vitamins + medical (L2)")
        snap = remove_attribute(db, "health", "form")
        if snap:
            add_attribute(db, "health-vitamins", snap)
            add_attribute(db, "health-medical", snap)

        db.commit()
        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
