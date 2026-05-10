from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.user.router import router as user_router
from app.modules.product.router import router as product_router
from app.modules.admin.router import router as admin_router
from app.modules.cart.router import router as cart_router
from app.modules.order.router import router as order_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(user_router, prefix="/user", tags=["user"])
api_router.include_router(product_router, prefix="/products", tags=["products"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(cart_router, prefix="/cart", tags=["cart"])
api_router.include_router(order_router, prefix="/orders", tags=["orders"])
