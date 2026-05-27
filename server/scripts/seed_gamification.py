import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base, SessionLocal

# Database connection (adjust if needed, but usually matches SessionLocal)
db = SessionLocal()

def seed_quests():
    print("🌱 Seeding Quests...")
    from app.modules.user.models import User
    from app.modules.quest.models import Quest
    
    quests_data = [
        # Customer Quests
        {
            "title": "Product Explorer", 
            "description": "Discover new items! View 5 different products.", 
            "requirement_type": "PRODUCT_VIEW", 
            "requirement_value": 5, 
            "reward_value": "10",
            "reward_type": "credit",
            "target_user_role": "CUSTOMER",
            "is_active": True
        },
        {
            "title": "Cart Builder",
            "description": "Found something you like? Add 3 items to your cart.",
            "requirement_type": "ADD_TO_CART",
            "requirement_value": 3,
            "reward_value": "5%",
            "reward_type": "coupon",
            "target_user_role": "CUSTOMER",
            "is_active": True
        },
        {
            "title": "Deal Hunter",
            "description": "Love savings? View 10 products from the Flash Sale section.",
            "requirement_type": "FLASH_SALE_VIEW",
            "requirement_value": 10,
            "reward_value": "20",
            "reward_type": "credit",
            "target_user_role": "CUSTOMER",
            "is_active": True
        },
        # Seller Quests
        {
            "title": "Rising Star Seller",
            "description": "Get your shop noticed! Upload 5 new products.",
            "requirement_type": "PRODUCT_UPLOAD",
            "requirement_value": 5,
            "reward_value": "PRO-BADGE",
            "reward_type": "badge",
            "target_user_role": "SELLER",
            "is_active": True
        },
        {
            "title": "Customer Favorite",
            "description": "Complete 10 successful deliveries to earn a bonus.",
            "requirement_type": "ORDER_COMPLETED",
            "requirement_value": 10,
            "reward_value": "COMMISSION-DROP",
            "reward_type": "bonus",
            "target_user_role": "SELLER",
            "is_active": True
        },
        # Universal Quests
        {
            "title": "Daily Login", 
            "description": "Stay connected! Log in 3 days in a row.", 
            "requirement_type": "DAILY_LOGIN", 
            "requirement_value": 3, 
            "reward_value": "5",
            "reward_type": "credit",
            "target_user_role": "All",
            "is_active": True
        },
    ]
    
    for q in quests_data:
        # Check if exists
        quest = db.query(Quest).filter(Quest.title == q["title"]).first()
        if not quest:
            quest = Quest(**q)
            db.add(quest)
        else:
            # Update existing quest fields
            for key, value in q.items():
                setattr(quest, key, value)
    
    db.commit()
    print("✅ Quests seeded and updated!")

def seed_flash_sales():
    print("🌱 Seeding Flash Sales...")
    from app.modules.flash_sale.models import FlashSale, FlashSaleProduct
    from app.modules.product.models import Product
    
    # Create a flash sale
    sale = FlashSale(
        name="⚡ Midnight Madness",
        description="Insane discounts for a very limited time!",
        start_time=datetime.now(),
        end_time=datetime.now() + timedelta(days=3),
        is_active=True
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    
    # Get some active products to put in the sale
    products = db.query(Product).filter(Product.is_active == True).limit(10).all()
    
    for p in products:
        # Set discounted price to 50% of original or a random lower price
        price = p.price * 0.6
        sale_prod = FlashSaleProduct(
            flash_sale_id=sale.id,
            product_id=p.id,
            discounted_price=price
        )
        db.add(sale_prod)
    
    db.commit()
    print(f"✅ Flash Sale seeded with {len(products)} products!")

if __name__ == "__main__":
    try:
        seed_quests()
        seed_flash_sales()
    except Exception as e:
        print(f"❌ Error seeding: {e}")
    finally:
        db.close()
