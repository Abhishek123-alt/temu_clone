import uuid
import enum
from datetime import datetime, UTC
from sqlalchemy import Column, String, Float, Integer, ForeignKey, Boolean, Text, Enum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.db.session import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    parent = relationship("Category", remote_side=[id], backref="subcategories")
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False) # Keep for "starting from" price and compatibility
    original_price = Column(Float, nullable=True)
    stock = Column(Integer, default=0) # Keep for total stock sum or compatibility
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    embedding = Column(Vector(384)) # Dimension for all-MiniLM-L6-v2
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    category = relationship("Category", back_populates="products")
    seller = relationship("User") # Link to the User who is the seller
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    wishlist_items = relationship("WishlistItem", back_populates="product", cascade="all, delete-orphan")
    recently_viewed_items = relationship("RecentlyViewed", back_populates="product", cascade="all, delete-orphan")
    options = relationship("ProductOption", back_populates="product", cascade="all, delete-orphan")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

class ProductOption(Base):
    __tablename__ = "product_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    name = Column(String, nullable=False) # e.g., "Color", "Size"
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    product = relationship("Product", back_populates="options")
    values = relationship("ProductOptionValue", back_populates="option", cascade="all, delete-orphan")

class ProductOptionValue(Base):
    __tablename__ = "product_option_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    option_id = Column(UUID(as_uuid=True), ForeignKey("product_options.id"), nullable=False)
    value = Column(String, nullable=False) # e.g., "Red", "XL"
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    option = relationship("ProductOption", back_populates="values")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    sku = Column(String, unique=True, nullable=False)
    price = Column(Float, nullable=False)
    original_price = Column(Float, nullable=True)
    stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    product = relationship("Product", back_populates="variants")
    option_values = relationship("ProductOptionValue", secondary="variant_option_values")

class VariantOptionValue(Base):
    __tablename__ = "variant_option_values"

    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id"), primary_key=True)
    option_value_id = Column(UUID(as_uuid=True), ForeignKey("product_option_values.id"), primary_key=True)

    option_value = relationship("ProductOptionValue")


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    url = Column(String, nullable=False)
    is_main = Column(Boolean, default=False)

    product = relationship("Product", back_populates="images")

class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    user = relationship("User", backref="wishlist")
    product = relationship("Product", back_populates="wishlist_items")

class RecentlyViewed(Base):
    __tablename__ = "recently_viewed"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    viewed_at = Column(DateTime, default=lambda: datetime.now(UTC))

    user = relationship("User", backref="recently_viewed")
    product = relationship("Product", back_populates="recently_viewed_items")
