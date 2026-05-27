"""
Seed attribute definitions for common categories.
Run with: python -m scripts.seed_category_attributes
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
import app.modules.user.models  # noqa: F401 — ensure User is registered before Product resolves relationships
from app.modules.product.models import Category, CategoryAttributeDefinition

ATTRIBUTE_DEFINITIONS = {
    "electronics-laptops": [
        {"key": "brand",     "label": "Brand",      "field_type": "select",  "options": ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "MSI"], "filterable": True,  "sort_order": 0},
        {"key": "ram",       "label": "RAM",         "field_type": "select",  "options": ["4GB", "8GB", "16GB", "32GB", "64GB"],                    "filterable": True,  "sort_order": 1},
        {"key": "storage",   "label": "Storage",     "field_type": "select",  "options": ["128GB", "256GB", "512GB", "1TB", "2TB"],                 "filterable": True,  "sort_order": 2},
        {"key": "processor", "label": "Processor",   "field_type": "select",  "options": ["Intel i3", "Intel i5", "Intel i7", "Intel i9", "AMD Ryzen 5", "AMD Ryzen 7", "Apple M1", "Apple M2", "Apple M3"], "filterable": True, "sort_order": 3},
        {"key": "screen_size","label": "Screen Size","field_type": "select",  "options": ["13\"", "14\"", "15.6\"", "16\"", "17\""],                "filterable": True,  "sort_order": 4},
        {"key": "gpu",       "label": "GPU",         "field_type": "text",    "options": None,                                                       "filterable": False, "sort_order": 5},
        {"key": "os",        "label": "OS",          "field_type": "select",  "options": ["Windows 11", "macOS", "Linux", "Chrome OS"],             "filterable": True,  "sort_order": 6},
    ],
    "smartphones": [
        {"key": "brand",     "label": "Brand",       "field_type": "select",  "options": ["Apple", "Samsung", "OnePlus", "Xiaomi", "Google", "Oppo"], "filterable": True, "sort_order": 0},
        {"key": "ram",       "label": "RAM",          "field_type": "select",  "options": ["4GB", "6GB", "8GB", "12GB", "16GB"],                      "filterable": True, "sort_order": 1},
        {"key": "storage",   "label": "Storage",      "field_type": "select",  "options": ["64GB", "128GB", "256GB", "512GB", "1TB"],                 "filterable": True, "sort_order": 2},
        {"key": "color",     "label": "Color",        "field_type": "select",  "options": ["Black", "White", "Blue", "Gold", "Silver", "Purple"],     "filterable": True, "sort_order": 3},
        {"key": "battery",   "label": "Battery (mAh)","field_type": "select",  "options": ["3000", "4000", "5000", "6000"],                           "filterable": False, "sort_order": 4},
        {"key": "os",        "label": "OS",           "field_type": "select",  "options": ["iOS", "Android"],                                          "filterable": True, "sort_order": 5},
    ],
    "fashion": [
        {"key": "brand",    "label": "Brand",   "field_type": "text",    "options": None,                                                     "filterable": False, "sort_order": 0},
        {"key": "size",     "label": "Size",    "field_type": "select",  "options": ["XS", "S", "M", "L", "XL", "XXL", "3XL"],              "filterable": True,  "sort_order": 1},
        {"key": "color",    "label": "Color",   "field_type": "select",  "options": ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Grey", "Brown", "Navy"], "filterable": True, "sort_order": 2},
        {"key": "material", "label": "Material","field_type": "select",  "options": ["Cotton", "Polyester", "Wool", "Silk", "Linen", "Denim", "Leather"], "filterable": True, "sort_order": 3},
        {"key": "gender",   "label": "Gender",  "field_type": "select",  "options": ["Men", "Women", "Unisex", "Kids"],                      "filterable": True,  "sort_order": 4},
    ],
    "fashion-men": [
        {"key": "size",     "label": "Size",    "field_type": "select",  "options": ["XS", "S", "M", "L", "XL", "XXL"],            "filterable": True, "sort_order": 0},
        {"key": "color",    "label": "Color",   "field_type": "select",  "options": ["Black", "White", "Blue", "Grey", "Brown"],   "filterable": True, "sort_order": 1},
        {"key": "material", "label": "Material","field_type": "select",  "options": ["Cotton", "Polyester", "Denim", "Wool"],      "filterable": True, "sort_order": 2},
    ],
    "fashion-women": [
        {"key": "size",     "label": "Size",    "field_type": "select",  "options": ["XS", "S", "M", "L", "XL"],                          "filterable": True, "sort_order": 0},
        {"key": "color",    "label": "Color",   "field_type": "select",  "options": ["Black", "White", "Red", "Pink", "Blue", "Green"],   "filterable": True, "sort_order": 1},
        {"key": "material", "label": "Material","field_type": "select",  "options": ["Cotton", "Silk", "Polyester", "Linen"],             "filterable": True, "sort_order": 2},
    ],
    "fashion-kids": [
        {"key": "age_group","label": "Age Group","field_type": "select", "options": ["0-2", "3-5", "6-8", "9-12"],            "filterable": True, "sort_order": 0},
        {"key": "size",     "label": "Size",    "field_type": "select",  "options": ["XS", "S", "M", "L"],                    "filterable": True, "sort_order": 1},
        {"key": "color",    "label": "Color",   "field_type": "select",  "options": ["Red", "Blue", "Yellow", "Green", "Pink"], "filterable": True, "sort_order": 2},
    ],
    "electronics-accessories": [
        {"key": "type",       "label": "Type",       "field_type": "select", "options": ["Charger", "Cable", "Headphones", "Case", "Stand", "Adapter"], "filterable": True, "sort_order": 0},
        {"key": "compatible_with","label": "Compatible With","field_type": "text", "options": None,                                                       "filterable": False,"sort_order": 1},
        {"key": "color",      "label": "Color",      "field_type": "select", "options": ["Black", "White", "Silver"],                                     "filterable": True, "sort_order": 2},
    ],
    "home-kitchen-cookware": [
        {"key": "material",  "label": "Material", "field_type": "select",  "options": ["Stainless Steel", "Non-stick", "Cast Iron", "Ceramic", "Aluminum"], "filterable": True, "sort_order": 0},
        {"key": "size",      "label": "Size",     "field_type": "select",  "options": ["Small", "Medium", "Large", "Family Size"],                          "filterable": True, "sort_order": 1},
        {"key": "color",     "label": "Color",    "field_type": "select",  "options": ["Black", "Silver", "Red", "White"],                                  "filterable": True, "sort_order": 2},
    ],
    "home-kitchen-decor": [
        {"key": "style",  "label": "Style", "field_type": "select", "options": ["Modern", "Vintage", "Minimalist", "Rustic", "Boho"], "filterable": True, "sort_order": 0},
        {"key": "color",  "label": "Color", "field_type": "select", "options": ["Black", "White", "Gold", "Beige", "Multi"],           "filterable": True, "sort_order": 1},
        {"key": "room",   "label": "Room",  "field_type": "select", "options": ["Living Room", "Bedroom", "Kitchen", "Bathroom"],      "filterable": True, "sort_order": 2},
    ],
    "home-kitchen-appliances": [
        {"key": "brand",       "label": "Brand",      "field_type": "text",    "options": None,                                "filterable": False, "sort_order": 0},
        {"key": "power",       "label": "Power (W)",  "field_type": "number",  "options": None,                                "filterable": False, "sort_order": 1},
        {"key": "voltage",     "label": "Voltage",    "field_type": "select",  "options": ["110V", "220V", "Universal"],       "filterable": True,  "sort_order": 2},
        {"key": "color",       "label": "Color",      "field_type": "select",  "options": ["White", "Black", "Silver", "Grey"],"filterable": True,  "sort_order": 3},
    ],
    "shoes": [
        {"key": "brand",       "label": "Brand",      "field_type": "text",    "options": None,                                                        "filterable": False, "sort_order": 0},
        {"key": "size",        "label": "Shoe Size",  "field_type": "select",  "options": ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],"filterable": True,  "sort_order": 1},
        {"key": "color",       "label": "Color",      "field_type": "select",  "options": ["Black", "White", "Brown", "Grey", "Blue", "Red"],           "filterable": True,  "sort_order": 2},
        {"key": "gender",      "label": "Gender",     "field_type": "select",  "options": ["Men", "Women", "Unisex", "Kids"],                          "filterable": True,  "sort_order": 3},
        {"key": "closure_type","label": "Closure",    "field_type": "select",  "options": ["Lace-up", "Slip-on", "Velcro", "Buckle"],                  "filterable": False, "sort_order": 4},
    ],
    "home-appliances": [
        {"key": "brand",       "label": "Brand",      "field_type": "text",    "options": None,                               "filterable": False, "sort_order": 0},
        {"key": "power",       "label": "Power (W)",  "field_type": "number",  "options": None,                               "filterable": False, "sort_order": 1},
        {"key": "voltage",     "label": "Voltage",    "field_type": "select",  "options": ["110V", "220V", "Universal"],      "filterable": True,  "sort_order": 2},
        {"key": "color",       "label": "Color",      "field_type": "select",  "options": ["White", "Black", "Silver", "Grey"],"filterable": True, "sort_order": 3},
        {"key": "warranty",    "label": "Warranty",   "field_type": "select",  "options": ["6 months", "1 year", "2 years", "3 years"], "filterable": False, "sort_order": 4},
    ],
    "beauty": [
        {"key": "brand",      "label": "Brand",       "field_type": "text",    "options": None,                                                      "filterable": False, "sort_order": 0},
        {"key": "skin_type",  "label": "Skin Type",   "field_type": "select",  "options": ["All", "Oily", "Dry", "Combination", "Sensitive"],        "filterable": True,  "sort_order": 1},
        {"key": "shade",      "label": "Shade",       "field_type": "text",    "options": None,                                                      "filterable": False, "sort_order": 2},
        {"key": "volume",     "label": "Volume (ml)", "field_type": "number",  "options": None,                                                      "filterable": False, "sort_order": 3},
        {"key": "cruelty_free","label": "Cruelty Free","field_type": "boolean","options": None,                                                      "filterable": True,  "sort_order": 4},
    ],
    "sports": [
        {"key": "brand",       "label": "Brand",     "field_type": "text",    "options": None,                                          "filterable": False, "sort_order": 0},
        {"key": "sport_type",  "label": "Sport",     "field_type": "select",  "options": ["Gym", "Running", "Cycling", "Swimming", "Football", "Basketball", "Yoga", "Tennis"], "filterable": True, "sort_order": 1},
        {"key": "gender",      "label": "Gender",    "field_type": "select",  "options": ["Men", "Women", "Unisex"],                   "filterable": True,  "sort_order": 2},
        {"key": "color",       "label": "Color",     "field_type": "select",  "options": ["Black", "White", "Red", "Blue", "Green"],   "filterable": True,  "sort_order": 3},
        {"key": "material",    "label": "Material",  "field_type": "text",    "options": None,                                          "filterable": False, "sort_order": 4},
    ],
}


def seed():
    db = SessionLocal()
    try:
        seeded = 0
        skipped = 0
        for slug, definitions in ATTRIBUTE_DEFINITIONS.items():
            category = db.query(Category).filter(Category.slug == slug).first()
            if not category:
                print(f"  [SKIP] Category '{slug}' not found in DB — create it first")
                skipped += 1
                continue

            existing_keys = {d.key for d in db.query(CategoryAttributeDefinition).filter(
                CategoryAttributeDefinition.category_id == category.id
            ).all()}

            for defn in definitions:
                if defn["key"] in existing_keys:
                    continue
                db.add(CategoryAttributeDefinition(category_id=category.id, **defn))
                seeded += 1

        db.commit()
        print(f"Done — seeded {seeded} attribute definitions, skipped {skipped} categories.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
