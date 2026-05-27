"""
Seed level-3 categories (e.g. Fashion → Men → Shirts).
Run with: python3 -m scripts.seed_subcategories
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401
from app.modules.product.models import Category

# parent_slug → list of (name, slug) sub-sub-categories
LEVEL_3 = {
    "fashion-men": [
        ("Shirts",     "fashion-men-shirts"),
        ("T-Shirts",   "fashion-men-tshirts"),
        ("Pants",      "fashion-men-pants"),
        ("Jeans",      "fashion-men-jeans"),
        ("Shorts",     "fashion-men-shorts"),
        ("Jackets",    "fashion-men-jackets"),
        ("Suits",      "fashion-men-suits"),
        ("Watches",    "fashion-men-watches"),
        ("Sunglasses", "fashion-men-sunglasses"),
        ("Belts",      "fashion-men-belts"),
        ("Shoes",      "fashion-men-shoes"),
    ],
    "fashion-women": [
        ("Tops",       "fashion-women-tops"),
        ("Dresses",    "fashion-women-dresses"),
        ("Jeans",      "fashion-women-jeans"),
        ("Skirts",     "fashion-women-skirts"),
        ("Sarees",     "fashion-women-sarees"),
        ("Kurtis",     "fashion-women-kurtis"),
        ("Jewelry",    "fashion-women-jewelry"),
        ("Handbags",   "fashion-women-handbags"),
        ("Heels",      "fashion-women-heels"),
        ("Watches",    "fashion-women-watches"),
    ],
    "fashion-kids": [
        ("Boys Clothing",  "fashion-kids-boys"),
        ("Girls Clothing", "fashion-kids-girls"),
        ("Baby Clothing",  "fashion-kids-baby"),
        ("Toys",           "fashion-kids-toys"),
        ("Kids Shoes",     "fashion-kids-shoes"),
    ],
    "electronics-laptops": [
        ("Gaming Laptops",   "electronics-laptops-gaming"),
        ("Business Laptops", "electronics-laptops-business"),
        ("MacBooks",         "electronics-laptops-macbooks"),
        ("2-in-1 Laptops",   "electronics-laptops-2in1"),
        ("Chromebooks",      "electronics-laptops-chromebooks"),
    ],
    "electronics-smartphones": [
        ("Android Phones",  "electronics-smartphones-android"),
        ("iPhones",         "electronics-smartphones-iphone"),
        ("Feature Phones",  "electronics-smartphones-feature"),
        ("Refurbished",     "electronics-smartphones-refurbished"),
    ],
    "electronics-accessories": [
        ("Cables",       "electronics-accessories-cables"),
        ("Chargers",     "electronics-accessories-chargers"),
        ("Headphones",   "electronics-accessories-headphones"),
        ("Earbuds",      "electronics-accessories-earbuds"),
        ("Speakers",     "electronics-accessories-speakers"),
        ("Power Banks",  "electronics-accessories-powerbanks"),
        ("Smart Watches","electronics-accessories-smartwatches"),
    ],
    "home-kitchen-cookware": [
        ("Pots & Pans",     "home-kitchen-cookware-pots"),
        ("Knives",          "home-kitchen-cookware-knives"),
        ("Bakeware",        "home-kitchen-cookware-bakeware"),
        ("Cutlery",         "home-kitchen-cookware-cutlery"),
        ("Cutting Boards",  "home-kitchen-cookware-cutting"),
    ],
    "home-kitchen-decor": [
        ("Wall Art",  "home-kitchen-decor-wallart"),
        ("Mirrors",   "home-kitchen-decor-mirrors"),
        ("Vases",     "home-kitchen-decor-vases"),
        ("Curtains",  "home-kitchen-decor-curtains"),
        ("Rugs",      "home-kitchen-decor-rugs"),
        ("Cushions",  "home-kitchen-decor-cushions"),
    ],
    "home-kitchen-appliances": [
        ("Microwaves",      "home-kitchen-appliances-microwaves"),
        ("Blenders",        "home-kitchen-appliances-blenders"),
        ("Air Fryers",      "home-kitchen-appliances-airfryers"),
        ("Vacuum Cleaners", "home-kitchen-appliances-vacuums"),
        ("Coffee Makers",   "home-kitchen-appliances-coffee"),
        ("Toasters",        "home-kitchen-appliances-toasters"),
    ],
}


def seed():
    db = SessionLocal()
    try:
        inserted, skipped = 0, 0
        for parent_slug, leaves in LEVEL_3.items():
            parent = db.query(Category).filter(Category.slug == parent_slug).first()
            if not parent:
                print(f"  [SKIP] parent '{parent_slug}' not found")
                continue
            for name, slug in leaves:
                exists = db.query(Category).filter(Category.slug == slug).first()
                if exists:
                    skipped += 1
                    continue
                db.add(Category(name=name, slug=slug, parent_id=parent.id))
                inserted += 1
                print(f"  [Inserted] {parent.name} → {name}")
        db.commit()
        print(f"\nDone — inserted {inserted}, skipped {skipped} (already existed).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
