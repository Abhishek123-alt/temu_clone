from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.session import Base

class FlashSale(Base):
    __tablename__ = "flash_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)

    products = relationship("FlashSaleProduct", back_populates="flash_sale", cascade="all, delete-orphan")

class FlashSaleProduct(Base):
    __tablename__ = "flash_sale_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    flash_sale_id = Column(UUID(as_uuid=True), ForeignKey("flash_sales.id"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    discounted_price = Column(Float, nullable=False)

    flash_sale = relationship("FlashSale", back_populates="products")
    product = relationship("app.modules.product.models.Product")
