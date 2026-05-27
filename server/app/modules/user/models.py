from sqlalchemy import Column, String, DateTime, Enum, Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, UTC
import enum
from app.db.session import Base

class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    SELLER = "SELLER"
    SELLER_PENDING = "SELLER_PENDING"
    ADMIN = "ADMIN"

class AuthProvider(str, enum.Enum):
    """Where this account was originally authenticated.

    Stored on User so we can tell at a glance whether an account has a usable
    password (LOCAL) or was created via a social provider (GOOGLE/etc., where
    `password_hash` is just a random unguessable value). Add new social
    providers here as they're implemented (FACEBOOK, APPLE, GITHUB...).
    """
    LOCAL = "LOCAL"
    GOOGLE = "GOOGLE"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)
    is_active = Column(Boolean, default=True)
    spins_left = Column(Integer, default=3)
    referral_code = Column(String, unique=True, index=True)
    referred_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    provider = Column(
        Enum(AuthProvider, name="authprovider"),
        default=AuthProvider.LOCAL,
        nullable=False,
        server_default=AuthProvider.LOCAL.value,
    )
    provider_subject = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    rewards = relationship("Reward", back_populates="user", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")
    referrer = relationship("User", remote_side=[id], backref="referrals")

class Address(Base):
    __tablename__ = "addresses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=True)
    street = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    zip = Column(String, nullable=False)
    country = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)

    user = relationship("User", back_populates="addresses")

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    brand = Column(String, nullable=False) # Visa, Mastercard, etc.
    last4 = Column(String, nullable=False)
    exp_month = Column(Integer, nullable=False)
    exp_year = Column(Integer, nullable=False)
    is_default = Column(Boolean, default=False)
    provider_id = Column(String, nullable=True) # Token or Customer ID from provider

    user = relationship("User", back_populates="payment_methods")

class Reward(Base):
    __tablename__ = "rewards"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reward_type = Column(String)  # 'coupon', 'credit', 'freeship'
    value = Column(String)         # "10% OFF", "$5", etc.
    code = Column(String, unique=True)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    user = relationship("User", back_populates="rewards")
