"""
1. Expand & re-organise Electronics (add Tablets, TVs, Audio, Cameras,
   Wearables, Gaming, Monitors, Desktops; move misplaced L3s).
2. Beauty: convert 'volume' to a select with predefined options.
3. Beauty: remove 'skin_type' from L1; add it only to Skincare + Makeup
   (so perfumes / grooming don't show it).
4. Add 'Women's Grooming' under Beauty.

Run with: python3 -m scripts.improve_catalog
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import update
from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category, CategoryAttributeDefinition


def get_or_create_cat(db, name, slug, parent=None):
    cat = db.query(Category).filter(Category.slug == slug).first()
    if cat:
        return cat, False
    cat = Category(name=name, slug=slug, parent_id=parent.id if parent else None)
    db.add(cat)
    db.flush()
    return cat, True


def reparent_by_slug(db, child_slug, new_parent):
    child = db.query(Category).filter(Category.slug == child_slug).first()
    if not child:
        return False
    if child.parent_id == new_parent.id:
        return False
    child.parent_id = new_parent.id
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Electronics: new L2s and their L3 product types
# ─────────────────────────────────────────────────────────────────────────────
ELECTRONICS_NEW = {
    ("Tablets",     "electronics-tablets"):     ["iPads", "Android Tablets", "E-Readers", "Kids Tablets"],
    ("Desktops",    "electronics-desktops"):    ["Tower PCs", "All-in-One PCs", "Mini PCs", "Gaming PCs"],
    ("Monitors",    "electronics-monitors"):    ["4K Monitors", "Ultrawide", "Gaming Monitors", "Office Monitors"],
    ("Televisions", "electronics-televisions"): ["LED TVs", "OLED TVs", "QLED TVs", "Smart TVs", "4K TVs"],
    ("Audio",       "electronics-audio"):       ["Soundbars", "Home Theatre", "Bluetooth Speakers"],
    ("Cameras",     "electronics-cameras"):     ["DSLR", "Mirrorless", "Action Cameras", "Lenses", "Tripods"],
    ("Wearables",   "electronics-wearables"):   ["Fitness Trackers", "VR Headsets"],
    ("Gaming",      "electronics-gaming"):      ["PlayStation", "Xbox", "Nintendo Switch", "Gaming Accessories"],
}

# Movements: child slug → new parent slug (must already exist after creating ELECTRONICS_NEW)
REPARENT = [
    # Audio gear out of Accessories
    ("electronics-accessories-headphones", "electronics-audio"),
    ("electronics-accessories-earbuds",    "electronics-audio"),
    ("electronics-accessories-speakers",   "electronics-audio"),
    # Smart watch out of Accessories → Wearables
    ("electronics-accessories-smartwatches", "electronics-wearables"),
]

# Beauty: predefined volume options
VOLUME_OPTIONS = ["10ml", "30ml", "50ml", "75ml", "100ml", "150ml", "200ml", "250ml", "500ml", "1L"]

# Women's Grooming
WOMENS_GROOMING_TYPES = [
    "Razors", "Hair Removal", "Waxing Kits", "Body Lotion", "Body Wash", "Sanitary Care"
]


def restructure_electronics(db):
    electronics = db.query(Category).filter(Category.slug == "electronics").first()
    if not electronics:
        print("  [SKIP] electronics not found")
        return

    print("  Adding new L2 categories under Electronics:")
    for (name, slug), l3_names in ELECTRONICS_NEW.items():
        l2, created = get_or_create_cat(db, name, slug, parent=electronics)
        if created:
            print(f"    [+] {name}")
        for l3_name in l3_names:
            import re
            l3_slug = f"{slug}-" + re.sub(r"[^a-z0-9]+", "-", l3_name.lower()).strip("-")
            _, c = get_or_create_cat(db, l3_name, l3_slug, parent=l2)
            if c:
                print(f"        └── {l3_name}")

    print("  Re-parenting misplaced L3s to better L2s:")
    for child_slug, new_parent_slug in REPARENT:
        np = db.query(Category).filter(Category.slug == new_parent_slug).first()
        if not np:
            continue
        if reparent_by_slug(db, child_slug, np):
            print(f"    [moved] {child_slug} → {new_parent_slug}")


def fix_beauty_volume(db):
    beauty = db.query(Category).filter(Category.slug == "beauty").first()
    if not beauty:
        return
    defn = db.query(CategoryAttributeDefinition).filter(
        CategoryAttributeDefinition.category_id == beauty.id,
        CategoryAttributeDefinition.key == "volume",
    ).first()
    if not defn:
        print("  [SKIP] beauty.volume definition not found")
        return
    defn.field_type = "select"
    defn.options = VOLUME_OPTIONS
    defn.filterable = True
    defn.label = "Volume"
    print(f"  [Updated] beauty.volume → select with {len(VOLUME_OPTIONS)} options")


def fix_skin_type(db):
    """Move skin_type from beauty (L1) to beauty-skincare and beauty-makeup (L2)
    so perfumes and grooming don't inherit it."""
    beauty = db.query(Category).filter(Category.slug == "beauty").first()
    if not beauty:
        return
    defn = db.query(CategoryAttributeDefinition).filter(
        CategoryAttributeDefinition.category_id == beauty.id,
        CategoryAttributeDefinition.key == "skin_type",
    ).first()
    if not defn:
        print("  [OK] beauty.skin_type already removed")
        return
    snapshot = {
        "key": defn.key, "label": defn.label, "field_type": defn.field_type,
        "options": defn.options, "filterable": defn.filterable, "sort_order": defn.sort_order,
    }
    db.delete(defn)
    print(f"  [Removed] skin_type from beauty (L1)")

    for slug in ("beauty-skincare", "beauty-makeup"):
        cat = db.query(Category).filter(Category.slug == slug).first()
        if not cat:
            continue
        exists = db.query(CategoryAttributeDefinition).filter(
            CategoryAttributeDefinition.category_id == cat.id,
            CategoryAttributeDefinition.key == "skin_type",
        ).first()
        if exists:
            continue
        db.add(CategoryAttributeDefinition(category_id=cat.id, **snapshot))
        print(f"  [Added] skin_type to {slug}")


def add_womens_grooming(db):
    beauty = db.query(Category).filter(Category.slug == "beauty").first()
    if not beauty:
        return

    # Rename existing Men's slug-only for consistency (optional, skip for safety)
    wg, created = get_or_create_cat(db, "Women's Grooming", "beauty-womens-grooming", parent=beauty)
    if created:
        print(f"  [+] Women's Grooming added under Beauty")
    import re
    for name in WOMENS_GROOMING_TYPES:
        slug = f"beauty-womens-grooming-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        _, c = get_or_create_cat(db, name, slug, parent=wg)
        if c:
            print(f"        └── {name}")


def run():
    db = SessionLocal()
    try:
        print("\n1. Restructuring Electronics")
        restructure_electronics(db)

        print("\n2. Beauty: convert volume to select with predefined options")
        fix_beauty_volume(db)

        print("\n3. Beauty: move skin_type from L1 to Skincare + Makeup only")
        fix_skin_type(db)

        print("\n4. Adding Women's Grooming")
        add_womens_grooming(db)

        db.commit()
        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
