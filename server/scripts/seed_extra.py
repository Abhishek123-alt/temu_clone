import uuid
from app.db.session import SessionLocal
from app.modules.user.models import User, Reward
from app.modules.product.models import Product, Category, ProductImage
from app.modules.quest.models import Quest, UserQuestProgress
from app.modules.flash_sale.models import FlashSale, FlashSaleProduct
from datetime import datetime, timedelta, UTC

def seed_extra_data():
    db = SessionLocal()
    try:
        # 1. Ensure all users have a referral code
        users = db.query(User).all()
        from app.modules.user.services import generate_referral_code
        for user in users:
            if not user.referral_code:
                user.referral_code = generate_referral_code()
        db.commit()
        print(f"Verified referral codes for {len(users)} users.")

        # 2. Add Rewards for all users
        for user in users:
            # Check if user already has rewards to avoid duplicates
            existing_rewards = db.query(Reward).filter(Reward.user_id == user.id).count()
            if existing_rewards < 2:
                rewards = [
                    Reward(
                        user_id=user.id,
                        reward_type="coupon",
                        value="20% OFF Summer Sale",
                        code=f"SUMMER-{uuid.uuid4().hex[:6].upper()}"
                    ),
                    Reward(
                        user_id=user.id,
                        reward_type="credit",
                        value="$10 Store Credit",
                        code=f"CREDIT-{uuid.uuid4().hex[:6].upper()}"
                    )
                ]
                db.add_all(rewards)
        db.commit()
        print("Added sample rewards for users.")

        # 3. Create "New Arrivals" Category and Products
        new_arrival_cat = db.query(Category).filter(Category.name == "New Arrivals").first()
        if not new_arrival_cat:
            new_arrival_cat = Category(
                name="New Arrivals",
                slug="new-arrivals",
                description="The latest trends and fresh styles."
            )
            db.add(new_arrival_cat)
            db.flush()

        # Add products to New Arrivals
        seller = db.query(User).filter(User.role == "Seller").first()
        if not seller:
            seller = db.query(User).first()

        new_products = [
            ("Wireless Pro Buds", "High-fidelity audio with noise cancellation.", 129.99, "https://images.unsplash.com/photo-1590658268037-6bf12165a8df"),
            ("Smart Watch Elite", "Track your health and stay connected.", 199.99, "https://images.unsplash.com/photo-1544117519-31a4b719223d"),
            ("Canvas Day Pack", "Durable and stylish for everyday use.", 45.00, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62"),
            ("Ergonomic Keyboard", "Comfortable typing for long work sessions.", 89.00, "https://images.unsplash.com/photo-1587829741301-dc798b83bac1")
        ]

        for title, desc, price, img_url in new_products:
            slug = title.lower().replace(" ", "-")
            existing = db.query(Product).filter(Product.slug == slug).first()
            if not existing:
                p = Product(
                    title=title,
                    slug=slug,
                    description=desc,
                    price=price,
                    original_price=price * 1.2,
                    stock=50,
                    category_id=new_arrival_cat.id,
                    seller_id=seller.id,
                    rating=4.5,
                    review_count=12
                )
                db.add(p)
                db.flush()
                db.add(ProductImage(product_id=p.id, url=img_url, is_main=True))
        
        db.commit()
        print("Seeded New Arrivals category and products.")

        # 4. Ensure Quests have progress for users
        quests = db.query(Quest).all()
        for user in users:
            for quest in quests:
                existing_progress = db.query(UserQuestProgress).filter(
                    UserQuestProgress.user_id == user.id,
                    UserQuestProgress.quest_id == quest.id
                ).first()
                if not existing_progress:
                    progress = UserQuestProgress(
                        user_id=user.id,
                        quest_id=quest.id,
                        current_progress=quest.requirement_value // 2, # Start half way
                        is_completed=False
                    )
                    db.add(progress)
        db.commit()
        print("Seeded quest progress for users.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_extra_data()
