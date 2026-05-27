import uuid
from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.session import Base
import enum
from datetime import datetime, UTC

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    PAYMENT_FAILED = "payment_failed"
    RETURN_REQUESTED = "return_requested"
    RETURN_APPROVED = "return_approved"
    RETURN_REJECTED = "return_rejected"
    RETURNED = "returned"
    REFUNDED = "refunded"
    CLOSED = "closed"

class OrderActor(str, enum.Enum):
    SYSTEM = "system"
    USER = "user"
    SELLER = "seller"
    ADMIN = "admin"

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    total_amount = Column(Float, nullable=False)

    # Money breakdown of total_amount — set at order creation so admin / seller
    # can each attribute the customer's payment to the right place:
    #   shipping_amount  → seller (covers fulfilment)
    #   tax_amount       → govt (passthrough; admin only holds it briefly)
    #   platform_fee     → admin (flat $0.30 + 2% of order — Stripe-style)
    #   discount_amount  → platform absorbs (marketing spend)
    shipping_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    platform_fee = Column(Float, nullable=False, default=0.0)
    discount_amount = Column(Float, nullable=False, default=0.0)

    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    shipping_address = Column(String, nullable=False)
    billing_address = Column(String, nullable=True)
    payment_method_id = Column(UUID(as_uuid=True), ForeignKey("payment_methods.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    user = relationship("User", backref="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    events = relationship("OrderEvent", back_populates="order", cascade="all, delete-orphan")
    shipments = relationship("Shipment", back_populates="order", cascade="all, delete-orphan")
    returns = relationship("Return", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False) # Price at time of purchase

    # Snapshot of product info
    product_title = Column(String, nullable=True)
    product_image = Column(String, nullable=True)

    # Commission snapshot — the rate at order time and the absolute amount the
    # platform earns on this line (price * qty * rate). Frozen here so later
    # rate changes on the store don't retroactively rewrite history.
    commission_rate = Column(Float, nullable=False, default=0.0)
    commission_amount = Column(Float, nullable=False, default=0.0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

class OrderEvent(Base):
    __tablename__ = "order_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    from_status = Column(Enum(OrderStatus), nullable=True)
    to_status = Column(Enum(OrderStatus), nullable=False)
    actor = Column(Enum(OrderActor), nullable=False)
    reason = Column(String, nullable=True)
    metadata_json = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    order = relationship("Order", back_populates="events")

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    carrier = Column(String, nullable=False) # e.g., "FedEx", "UPS", "DHL"
    tracking_number = Column(String, nullable=False)
    tracking_url = Column(String, nullable=True)
    status = Column(String, nullable=False) # Raw status from carrier
    estimated_delivery = Column(DateTime, nullable=True)
    last_location = Column(String, nullable=True)
    history = Column(JSONB, nullable=False, default=[]) # List of tracking events
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    order = relationship("Order", back_populates="shipments")

class Return(Base):
    __tablename__ = "returns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    status = Column(String, nullable=False, default="requested") # requested, approved, in_transit, received, refunded, rejected
    reason = Column(String, nullable=False)
    refund_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    order = relationship("Order", back_populates="returns")
    items = relationship("ReturnItem", back_populates="return_request", cascade="all, delete-orphan")

class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    return_id = Column(UUID(as_uuid=True), ForeignKey("returns.id"), nullable=False)
    order_item_id = Column(UUID(as_uuid=True), ForeignKey("order_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    condition = Column(String, nullable=True)

    return_request = relationship("Return", back_populates="items")
    order_item = relationship("OrderItem")

class Outbox(Base):
    __tablename__ = "outbox"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False)
    available_at = Column(DateTime, default=lambda: datetime.now(UTC))
    attempts = Column(Integer, default=0)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
