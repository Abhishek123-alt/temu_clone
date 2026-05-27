from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.user.router import router as user_router
from app.modules.product.router import router as product_router
from app.modules.admin.router import router as admin_router
from app.modules.cart.router import router as cart_router
from app.modules.order.router import router as order_router
from app.modules.flash_sale.router import router as flash_sale_router
from app.modules.quest.router import router as quest_router
from app.modules.review.router import router as review_router
from app.modules.store.router import router as store_router
from app.modules.support.router import router as support_router
from app.modules.gamification.router import router as gamification_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(user_router, prefix="/user", tags=["user"])
api_router.include_router(product_router, prefix="/products", tags=["products"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(cart_router, prefix="/cart", tags=["cart"])
api_router.include_router(order_router, prefix="/orders", tags=["orders"])
api_router.include_router(flash_sale_router, prefix="/flash-sales", tags=["flash sales"])
api_router.include_router(quest_router, prefix="/quests", tags=["quests"])
api_router.include_router(review_router, prefix="/reviews", tags=["reviews"])
api_router.include_router(store_router, prefix="/store", tags=["store"])
api_router.include_router(support_router, prefix="/support", tags=["support"])
api_router.include_router(gamification_router, prefix="/gamification", tags=["gamification"])
