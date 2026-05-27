"""
1. Reassign any products under 'New Arrivals' to 'Electronics' and delete the category.
2. Add new top-level categories with sub-categories and product types.
3. Seed level-1 attribute definitions for the new categories
   (descendants inherit via the merged-definitions service).

Run with: python3 -m scripts.expand_catalog
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import update
from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category, CategoryAttributeDefinition, Product


# ─────────────────────────────────────────────────────────────────────────────
# Catalog tree definition: {top-level: {sub-cat: [product type names]}}
# ─────────────────────────────────────────────────────────────────────────────
NEW_TREE = {
    ("Beauty & Personal Care", "beauty"): {
        ("Skincare",        "beauty-skincare"):       ["Moisturizers", "Sunscreen", "Face Wash", "Serums", "Toners", "Face Masks"],
        ("Makeup",          "beauty-makeup"):         ["Lipstick", "Foundation", "Mascara", "Eyeshadow", "Blush", "Nail Polish"],
        ("Hair Care",       "beauty-haircare"):       ["Shampoo", "Conditioner", "Hair Oil", "Hair Color", "Hair Tools"],
        ("Fragrances",      "beauty-fragrances"):     ["Perfumes", "Deodorants", "Body Sprays"],
        ("Men's Grooming",  "beauty-grooming"):       ["Razors", "Shaving Cream", "Beard Care", "Aftershave"],
    },
    ("Sports & Outdoors", "sports"): {
        ("Fitness",     "sports-fitness"):    ["Yoga Mats", "Dumbbells", "Resistance Bands", "Treadmills", "Exercise Bikes"],
        ("Outdoor",     "sports-outdoor"):    ["Tents", "Backpacks", "Sleeping Bags", "Hiking Gear", "Camping Stoves"],
        ("Team Sports", "sports-team"):       ["Footballs", "Basketballs", "Cricket Gear", "Tennis Rackets", "Badminton"],
        ("Cycling",     "sports-cycling"):    ["Bicycles", "Helmets", "Cycling Apparel", "Bike Accessories"],
        ("Swimming",    "sports-swimming"):   ["Swimsuits", "Goggles", "Pool Floats", "Swim Caps"],
    },
    ("Books & Stationery", "books"): {
        ("Books",            "books-reading"):     ["Fiction", "Non-Fiction", "Children's Books", "Academic", "Comics", "Biographies"],
        ("Stationery",       "books-stationery"):  ["Notebooks", "Pens", "Pencils", "Art Supplies", "Calculators", "Markers"],
        ("Office Supplies",  "books-office"):      ["Files & Folders", "Desk Accessories", "Whiteboards", "Printers"],
    },
    ("Toys & Games", "toys"): {
        ("Action Figures",   "toys-figures"):     ["Superheroes", "Toy Cars", "Dolls", "Dinosaurs"],
        ("Educational Toys", "toys-educational"): ["STEM Kits", "Puzzles", "Learning Tablets", "Building Blocks"],
        ("Board Games",      "toys-board"):       ["Strategy Games", "Family Games", "Card Games", "Trivia"],
        ("Outdoor Toys",     "toys-outdoor"):     ["Kids Bikes", "Skateboards", "Scooters", "Sports Toys"],
        ("Video Games",      "toys-videogames"):  ["PlayStation", "Xbox", "Nintendo", "PC Games"],
    },
    ("Health & Wellness", "health"): {
        ("Vitamins",      "health-vitamins"):   ["Multivitamins", "Vitamin C", "Vitamin D", "Omega-3", "Protein"],
        ("Medical",       "health-medical"):    ["First Aid", "Pain Relief", "Thermometers", "Blood Pressure Monitors"],
        ("Wellness",      "health-wellness"):   ["Massage Tools", "Diffusers", "Heating Pads", "Sleep Aids"],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Attribute definitions seeded at LEVEL 1 (inherited by all descendants)
# ─────────────────────────────────────────────────────────────────────────────
L1_ATTRIBUTES = {
    "beauty": [
        {"key": "brand",       "label": "Brand",       "field_type": "select",  "options": ["L'Oréal", "Maybelline", "MAC", "Estée Lauder", "Nivea", "Dove", "Olay", "Neutrogena", "Lakme", "Other"], "filterable": True, "sort_order": 0},
        {"key": "skin_type",   "label": "Skin Type",   "field_type": "select",  "options": ["All", "Oily", "Dry", "Combination", "Sensitive", "Normal"], "filterable": True, "sort_order": 1},
        {"key": "volume",      "label": "Volume (ml)", "field_type": "number",  "options": None, "filterable": False, "sort_order": 2},
        {"key": "gender",      "label": "Gender",      "field_type": "select",  "options": ["Unisex", "Women", "Men"], "filterable": True, "sort_order": 3},
        {"key": "cruelty_free","label": "Cruelty Free","field_type": "boolean", "options": None, "filterable": True, "sort_order": 4},
    ],
    "sports": [
        {"key": "brand",  "label": "Brand",   "field_type": "select", "options": ["Nike", "Adidas", "Puma", "Reebok", "Under Armour", "Wilson", "Yonex", "Decathlon", "Other"], "filterable": True, "sort_order": 0},
        {"key": "gender", "label": "Gender",  "field_type": "select", "options": ["Men", "Women", "Unisex", "Kids"], "filterable": True, "sort_order": 1},
        {"key": "color",  "label": "Color",   "field_type": "select", "options": ["Black", "White", "Red", "Blue", "Green", "Grey"], "filterable": True, "sort_order": 2},
        {"key": "size",   "label": "Size",    "field_type": "select", "options": ["XS", "S", "M", "L", "XL", "XXL"], "filterable": True, "sort_order": 3},
    ],
    "books": [
        {"key": "author",    "label": "Author",    "field_type": "text",   "options": None, "filterable": False, "sort_order": 0},
        {"key": "language",  "label": "Language",  "field_type": "select", "options": ["English", "Hindi", "Spanish", "French", "Other"], "filterable": True, "sort_order": 1},
        {"key": "format",    "label": "Format",    "field_type": "select", "options": ["Paperback", "Hardcover", "eBook", "Audiobook"], "filterable": True, "sort_order": 2},
        {"key": "publisher", "label": "Publisher", "field_type": "text",   "options": None, "filterable": False, "sort_order": 3},
    ],
    "toys": [
        {"key": "age_group", "label": "Age Group", "field_type": "select", "options": ["0-2 years", "3-5 years", "6-8 years", "9-12 years", "13+ years"], "filterable": True, "sort_order": 0},
        {"key": "brand",     "label": "Brand",     "field_type": "select", "options": ["Lego", "Mattel", "Hasbro", "Nintendo", "Sony", "Microsoft", "Other"], "filterable": True, "sort_order": 1},
        {"key": "material",  "label": "Material",  "field_type": "select", "options": ["Plastic", "Wood", "Metal", "Plush", "Mixed"], "filterable": True, "sort_order": 2},
        {"key": "gender",    "label": "For",       "field_type": "select", "options": ["Boys", "Girls", "Unisex"], "filterable": True, "sort_order": 3},
    ],
    "health": [
        {"key": "brand",    "label": "Brand",    "field_type": "text",   "options": None, "filterable": False, "sort_order": 0},
        {"key": "form",     "label": "Form",     "field_type": "select", "options": ["Tablet", "Capsule", "Liquid", "Powder", "Gummy", "Cream"], "filterable": True, "sort_order": 1},
        {"key": "quantity", "label": "Quantity", "field_type": "number", "options": None, "filterable": False, "sort_order": 2},
    ],
}


def slugify_child(parent_slug: str, name: str) -> str:
    import re
    leaf = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{parent_slug}-{leaf}"


def remove_new_arrivals(db):
    """Reassign products from 'new-arrivals' to 'electronics' and delete the category."""
    na = db.query(Category).filter(Category.slug == "new-arrivals").first()
    if not na:
        print("  [SKIP] 'new-arrivals' not present")
        return

    fallback = db.query(Category).filter(Category.slug == "electronics").first()
    if not fallback:
        print("  [SKIP] fallback 'electronics' not found — keeping new-arrivals")
        return

    # Use raw UPDATE to bypass the ORM relationship cascade (which would null the FK
    # when the parent Category is deleted, overwriting our reassignment).
    result = db.execute(
        update(Product).where(Product.category_id == na.id).values(category_id=fallback.id)
    )
    db.expire_all()  # clear stale collections so .delete() doesn't try to re-null FKs
    print(f"  [Moved] {result.rowcount} product(s) from 'New Arrivals' → 'Electronics'")

    na = db.query(Category).filter(Category.slug == "new-arrivals").first()
    db.delete(na)
    db.flush()
    print(f"  [Deleted] 'New Arrivals' category")


def add_tree(db):
    inserted = 0
    skipped = 0
    for (l1_name, l1_slug), l2_map in NEW_TREE.items():
        l1 = db.query(Category).filter(Category.slug == l1_slug).first()
        if not l1:
            l1 = Category(name=l1_name, slug=l1_slug)
            db.add(l1)
            db.flush()
            inserted += 1
            print(f"  [Inserted L1] {l1_name}")
        else:
            skipped += 1

        for (l2_name, l2_slug), l3_names in l2_map.items():
            l2 = db.query(Category).filter(Category.slug == l2_slug).first()
            if not l2:
                l2 = Category(name=l2_name, slug=l2_slug, parent_id=l1.id)
                db.add(l2)
                db.flush()
                inserted += 1
                print(f"  [Inserted L2] {l1_name} → {l2_name}")
            else:
                skipped += 1

            for l3_name in l3_names:
                l3_slug = slugify_child(l2_slug, l3_name)
                l3 = db.query(Category).filter(Category.slug == l3_slug).first()
                if not l3:
                    db.add(Category(name=l3_name, slug=l3_slug, parent_id=l2.id))
                    inserted += 1
                else:
                    skipped += 1
    print(f"  Tree: inserted {inserted}, skipped {skipped} (already existed)")


def seed_attributes(db):
    for slug, defs in L1_ATTRIBUTES.items():
        cat = db.query(Category).filter(Category.slug == slug).first()
        if not cat:
            print(f"  [SKIP] '{slug}' missing")
            continue
        existing_keys = {d.key for d in db.query(CategoryAttributeDefinition).filter(
            CategoryAttributeDefinition.category_id == cat.id
        ).all()}
        added = 0
        for d in defs:
            if d["key"] in existing_keys:
                continue
            db.add(CategoryAttributeDefinition(category_id=cat.id, **d))
            added += 1
        print(f"  [Attrs] '{slug}': +{added} new definitions")


def run():
    db = SessionLocal()
    try:
        print("\n1. Removing 'New Arrivals' (not a real category)")
        remove_new_arrivals(db)

        print("\n2. Adding new categories with sub-categories and product types")
        add_tree(db)

        print("\n3. Seeding level-1 attribute definitions (descendants inherit)")
        seed_attributes(db)

        db.commit()
        print("\nDone.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
