"""
Catalog audit & restructure:

1. Kids: remove 'Baby Clothing' (redundant) and rename 'Kids Shoes' → 'Shoes'.
2. Sports → Fitness: remove Dumbbells, Treadmills, Exercise Bikes (not stocked).
3. Electronics FULL restructure — L3 should be actual products (Laptop,
   Smartphone, Headphone) not sub-types (Gaming Laptop, iPhone, Bluetooth Speaker).
4. Toys: fix Action Figures / Board Games / Video Games L3s where they were
   genres/platforms instead of actual products.

Any product tagged to a deleted category is moved up to its grandparent so nothing
is lost.

Run with: python3 -m scripts.restructure_audit
"""
import os
import re
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import update
from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category, CategoryAttributeDefinition, Product


def slugify(parent_slug, name):
    leaf = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{parent_slug}-{leaf}"


def delete_categories_safely(db, categories, fallback_id):
    """Move every product under each category to the fallback, then delete the categories.
    `categories` may include parents — we walk depth-first."""
    if not categories:
        return

    all_ids = set()
    def collect(cat):
        all_ids.add(cat.id)
        for child in db.query(Category).filter(Category.parent_id == cat.id).all():
            collect(child)
    for cat in categories:
        collect(cat)

    moved = db.execute(
        update(Product).where(Product.category_id.in_(all_ids)).values(category_id=fallback_id)
    ).rowcount
    db.expire_all()
    if moved:
        print(f"    [moved] {moved} product(s) → fallback category")

    # delete leaves first
    sorted_cats = sorted(
        [db.query(Category).get(cid) for cid in all_ids],
        key=lambda c: -len(c.slug),  # deeper slugs (with more dashes) first
    )
    for c in sorted_cats:
        if c:
            db.delete(c)
    db.flush()


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Kids cleanup
# ─────────────────────────────────────────────────────────────────────────────
def fix_kids(db):
    kids = db.query(Category).filter(Category.slug == "fashion-kids").first()
    if not kids:
        print("  [SKIP] fashion-kids not found")
        return

    # Remove 'Baby Clothing'
    baby = db.query(Category).filter(Category.slug == "fashion-kids-baby").first()
    if baby:
        delete_categories_safely(db, [baby], kids.id)
        print("  [Removed] Baby Clothing")

    # Rename Kids Shoes → Shoes
    shoes = db.query(Category).filter(Category.slug == "fashion-kids-shoes").first()
    if shoes:
        shoes.name = "Shoes"
        print("  [Renamed] 'Kids Shoes' → 'Shoes'")


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Sports cleanup
# ─────────────────────────────────────────────────────────────────────────────
def fix_sports(db):
    fitness = db.query(Category).filter(Category.slug == "sports-fitness").first()
    if not fitness:
        return

    to_remove_slugs = [
        "sports-fitness-dumbbells",
        "sports-fitness-treadmills",
        "sports-fitness-exercise-bikes",
    ]
    cats = [db.query(Category).filter(Category.slug == s).first() for s in to_remove_slugs]
    cats = [c for c in cats if c]
    if cats:
        delete_categories_safely(db, cats, fitness.id)
        print(f"  [Removed] {', '.join(c.name for c in cats)}")


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Electronics full restructure
# ─────────────────────────────────────────────────────────────────────────────
NEW_ELECTRONICS_TREE = {
    ("Mobiles & Tablets", "electronics-mobiles"): [
        "Smartphone", "Tablet", "Feature Phone", "E-Reader",
    ],
    ("Computers", "electronics-computers"): [
        "Laptop", "Desktop", "Monitor", "Keyboard", "Mouse", "Printer", "Webcam", "PC Components",
    ],
    ("TV & Home Entertainment", "electronics-tv"): [
        "Television", "Projector", "Streaming Device", "TV Mount",
    ],
    ("Audio", "electronics-audio"): [
        "Headphone", "Earbuds", "Bluetooth Speaker", "Soundbar", "Home Theatre", "Microphone",
    ],
    ("Camera & Photo", "electronics-camera"): [
        "DSLR Camera", "Mirrorless Camera", "Action Camera", "Camera Lens", "Tripod", "Memory Card",
    ],
    ("Wearables", "electronics-wearables"): [
        "Smart Watch", "Fitness Band", "VR Headset", "Smart Glasses",
    ],
    ("Gaming", "electronics-gaming"): [
        "Gaming Console", "Video Game", "Game Controller", "Gaming Headset", "Gaming Chair",
    ],
    ("Accessories", "electronics-accessories"): [
        "Cable", "Charger", "Power Bank", "Phone Case", "Laptop Bag", "USB Hub", "Adapter",
    ],
}

# Level-2 attributes (descendants inherit via the merge logic)
NEW_L2_ATTRS = {
    "electronics-mobiles": [
        {"key": "brand",   "label": "Brand",   "field_type": "select", "options": ["Apple", "Samsung", "OnePlus", "Xiaomi", "Google", "Oppo", "Vivo", "Nokia", "Other"], "filterable": True, "sort_order": 0},
        {"key": "ram",     "label": "RAM",     "field_type": "select", "options": ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB"], "filterable": True, "sort_order": 1},
        {"key": "storage", "label": "Storage", "field_type": "select", "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], "filterable": True, "sort_order": 2},
        {"key": "os",      "label": "OS",      "field_type": "select", "options": ["iOS", "Android", "iPadOS", "Other"], "filterable": True, "sort_order": 3},
        {"key": "color",   "label": "Color",   "field_type": "select", "options": ["Black", "White", "Blue", "Gold", "Silver", "Purple", "Green"], "filterable": True, "sort_order": 4},
    ],
    "electronics-computers": [
        {"key": "brand",       "label": "Brand",       "field_type": "select", "options": ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI", "Microsoft", "Other"], "filterable": True, "sort_order": 0},
        {"key": "ram",         "label": "RAM",         "field_type": "select", "options": ["4GB", "8GB", "16GB", "32GB", "64GB"], "filterable": True, "sort_order": 1},
        {"key": "storage",     "label": "Storage",     "field_type": "select", "options": ["128GB", "256GB", "512GB", "1TB", "2TB", "4TB"], "filterable": True, "sort_order": 2},
        {"key": "processor",   "label": "Processor",   "field_type": "select", "options": ["Intel i3", "Intel i5", "Intel i7", "Intel i9", "AMD Ryzen 5", "AMD Ryzen 7", "Apple M1", "Apple M2", "Apple M3"], "filterable": True, "sort_order": 3},
        {"key": "screen_size", "label": "Screen Size", "field_type": "select", "options": ["13\"", "14\"", "15.6\"", "16\"", "17\"", "24\"", "27\"", "32\""], "filterable": True, "sort_order": 4},
        {"key": "os",          "label": "OS",          "field_type": "select", "options": ["Windows 11", "macOS", "Linux", "Chrome OS"], "filterable": True, "sort_order": 5},
    ],
    "electronics-tv": [
        {"key": "brand",       "label": "Brand",       "field_type": "select", "options": ["Samsung", "LG", "Sony", "TCL", "Vizio", "Hisense", "Other"], "filterable": True, "sort_order": 0},
        {"key": "screen_size", "label": "Screen Size", "field_type": "select", "options": ["32\"", "40\"", "43\"", "50\"", "55\"", "65\"", "75\"", "85\""], "filterable": True, "sort_order": 1},
        {"key": "resolution",  "label": "Resolution",  "field_type": "select", "options": ["HD", "Full HD", "4K", "8K"], "filterable": True, "sort_order": 2},
        {"key": "display_type","label": "Display",     "field_type": "select", "options": ["LED", "OLED", "QLED", "Mini LED"], "filterable": True, "sort_order": 3},
    ],
    "electronics-audio": [
        {"key": "brand",    "label": "Brand",    "field_type": "select", "options": ["Sony", "Bose", "Sennheiser", "JBL", "Apple", "Samsung", "Boat", "Other"], "filterable": True, "sort_order": 0},
        {"key": "wireless", "label": "Wireless", "field_type": "boolean","options": None, "filterable": True, "sort_order": 1},
        {"key": "color",    "label": "Color",    "field_type": "select", "options": ["Black", "White", "Silver", "Red", "Blue"], "filterable": True, "sort_order": 2},
    ],
    "electronics-camera": [
        {"key": "brand",       "label": "Brand",       "field_type": "select", "options": ["Canon", "Nikon", "Sony", "Fujifilm", "GoPro", "Panasonic", "Other"], "filterable": True, "sort_order": 0},
        {"key": "megapixels",  "label": "Megapixels",  "field_type": "select", "options": ["12 MP", "20 MP", "24 MP", "32 MP", "48 MP", "60 MP+"], "filterable": True, "sort_order": 1},
    ],
    "electronics-wearables": [
        {"key": "brand",         "label": "Brand",         "field_type": "select", "options": ["Apple", "Samsung", "Fitbit", "Garmin", "Xiaomi", "OnePlus", "Other"], "filterable": True, "sort_order": 0},
        {"key": "color",         "label": "Color",         "field_type": "select", "options": ["Black", "White", "Silver", "Gold", "Rose Gold"], "filterable": True, "sort_order": 1},
        {"key": "compatibility", "label": "Compatibility", "field_type": "select", "options": ["iOS", "Android", "Both"], "filterable": True, "sort_order": 2},
    ],
    "electronics-gaming": [
        {"key": "brand",    "label": "Brand",    "field_type": "select", "options": ["Sony", "Microsoft", "Nintendo", "Razer", "Logitech", "Other"], "filterable": True, "sort_order": 0},
        {"key": "platform", "label": "Platform", "field_type": "select", "options": ["PlayStation", "Xbox", "Nintendo Switch", "PC", "Mobile"], "filterable": True, "sort_order": 1},
    ],
    "electronics-accessories": [
        {"key": "type",  "label": "Type",  "field_type": "select", "options": ["Cable", "Charger", "Case", "Bag", "Hub", "Adapter", "Stand", "Other"], "filterable": True, "sort_order": 0},
        {"key": "color", "label": "Color", "field_type": "select", "options": ["Black", "White", "Silver", "Other"], "filterable": True, "sort_order": 1},
    ],
}


def rebuild_electronics(db):
    electronics = db.query(Category).filter(Category.slug == "electronics").first()
    if not electronics:
        print("  [SKIP] electronics not found")
        return

    # Wipe existing L2s and all their descendants
    old_l2s = db.query(Category).filter(Category.parent_id == electronics.id).all()
    print(f"  Wiping {len(old_l2s)} old L2 categor(ies) and their descendants")
    delete_categories_safely(db, old_l2s, electronics.id)

    # Build new tree
    print("  Building new clean tree")
    for (name, slug), products in NEW_ELECTRONICS_TREE.items():
        l2 = Category(name=name, slug=slug, parent_id=electronics.id)
        db.add(l2)
        db.flush()
        print(f"    [+] {name}")
        for pname in products:
            db.add(Category(name=pname, slug=slugify(slug, pname), parent_id=l2.id))
        # seed attribute definitions for this L2
        for d in NEW_L2_ATTRS.get(slug, []):
            db.add(CategoryAttributeDefinition(category_id=l2.id, **d))


# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Toys fixes — flatten sub-types into real products
# ─────────────────────────────────────────────────────────────────────────────
TOYS_REBUILD = {
    "toys-figures":     ["Action Figure", "Toy Car", "Doll", "Plush Toy"],
    "toys-board":       ["Board Game", "Card Game", "Puzzle Game", "Dice Game"],
    "toys-videogames":  ["Gaming Console", "Video Game", "Game Controller", "Gaming Accessory"],
}


def fix_toys(db):
    for parent_slug, new_products in TOYS_REBUILD.items():
        parent = db.query(Category).filter(Category.slug == parent_slug).first()
        if not parent:
            continue
        old_l3s = db.query(Category).filter(Category.parent_id == parent.id).all()
        if old_l3s:
            delete_categories_safely(db, old_l3s, parent.id)
        for pname in new_products:
            db.add(Category(name=pname, slug=slugify(parent_slug, pname), parent_id=parent.id))
        print(f"  [Rebuilt] {parent.name}: {', '.join(new_products)}")


def run():
    db = SessionLocal()
    try:
        print("\n1. Kids cleanup")
        fix_kids(db)

        print("\n2. Sports cleanup")
        fix_sports(db)

        print("\n3. Electronics full restructure")
        rebuild_electronics(db)

        print("\n4. Toys — flatten sub-types into real products")
        fix_toys(db)

        db.commit()
        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
