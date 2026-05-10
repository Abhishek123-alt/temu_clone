import sys
import os
from sqlalchemy.orm import Session
from uuid import uuid4

# Add the project root to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal, engine
from app.modules.user.models import User, Address, UserRole
from app.modules.product.models import Category, Product, ProductImage
from app.core.security import get_password_hash
from app.core.embeddings import generate_embedding

def seed_db():
    db: Session = SessionLocal()
    try:
        print("🌱 Seeding database...")

        # 1. Create Admin
        admin_email = "admin@temuclone.com"
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                email=admin_email,
                password_hash=get_password_hash("Admin@123"),
                full_name="Temu Admin",
                role=UserRole.ADMIN
            )
            db.add(admin)
            db.flush()
            print("✅ Admin created")

        # 1b. Create Seller
        seller_email = "seller@temuclone.com"
        seller = db.query(User).filter(User.email == seller_email).first()
        if not seller:
            seller = User(
                email=seller_email,
                password_hash=get_password_hash("Seller@123"),
                full_name="Tech World Seller",
                role=UserRole.SELLER
            )
            db.add(seller)
            db.flush()
            print("✅ Seller created")

        # 2. Create Categories
        categories_data = [
            {"name": "Electronics", "slug": "electronics", "sub": ["Smartphones", "Laptops", "Accessories"]},
            {"name": "Home & Kitchen", "slug": "home-kitchen", "sub": ["Cookware", "Decor", "Appliances"]},
            {"name": "Fashion", "slug": "fashion", "sub": ["Men", "Women", "Kids"]}
        ]

        for cat_info in categories_data:
            cat = db.query(Category).filter(Category.slug == cat_info["slug"]).first()
            if not cat:
                cat = Category(name=cat_info["name"], slug=cat_info["slug"])
                db.add(cat)
                db.flush() # Get ID for children
                
                for sub_name in cat_info["sub"]:
                    sub_slug = f"{cat_info['slug']}-{sub_name.lower().replace(' ', '-')}"
                    sub_cat = Category(name=sub_name, slug=sub_slug, parent_id=cat.id)
                    db.add(sub_cat)
                print(f"✅ Category {cat_info['name']} and subcategories created")

        # 3. Create Products
        electronics_cat = db.query(Category).filter(Category.slug == "electronics-smartphones").first()
        if electronics_cat:
            products = [
                {
                    "title": "Ultra-Slim Smartphone X12",
                    "slug": "ultra-slim-smartphone-x12",
                    "description": "The latest smartphone with 120Hz display and 108MP camera.",
                    "price": 499.99,
                    "original_price": 699.99,
                    "stock": 50,
                    "rating": 4.8,
                    "images": ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800"]
                },
                {
                    "title": "Pro Noise Cancelling Headphones",
                    "slug": "pro-noise-cancelling-headphones",
                    "description": "Studio quality sound with active noise cancellation.",
                    "price": 129.99,
                    "original_price": 199.99,
                    "stock": 100,
                    "rating": 4.5,
                    "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800"]
                }
            ]

            for p_data in products:
                if not db.query(Product).filter(Product.slug == p_data["slug"]).first():
                    product = Product(
                        title=p_data["title"],
                        slug=p_data["slug"],
                        description=p_data["description"],
                        price=p_data["price"],
                        original_price=p_data["original_price"],
                        stock=p_data["stock"],
                        rating=p_data["rating"],
                        category_id=electronics_cat.id,
                        seller_id=admin.id if "Smartphone" in p_data["title"] else seller.id,
                        embedding=generate_embedding(f"{p_data['title']} {p_data['description']}")
                    )
                    db.add(product)
                    db.flush()
                    
                    for img_url in p_data["images"]:
                        db.add(ProductImage(product_id=product.id, url=img_url, is_main=True))
            print("✅ Sample products created")

        # 4. Update missing embeddings
        products_to_update = db.query(Product).filter(Product.embedding == None).all()
        if products_to_update:
            print(f"🔄 Generating embeddings for {len(products_to_update)} products...")
            for p in products_to_update:
                p.embedding = generate_embedding(f"{p.title} {p.description}")
            print("✅ Embeddings updated")

        db.commit()
        print("✨ Database seeding completed successfully!")

    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
