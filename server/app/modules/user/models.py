from sqlalchemy import Column, String, DateTime, Enum, Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import datetime
import enum
from app.db.session import Base

class UserRole(str, enum.Enum):
    CUSTOMER = "Customer"
    SELLER = "Seller"
    ADMIN = "Admin"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)
    spins_left = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    rewards = relationship("Reward", back_populates="user", cascade="all, delete-orphan")

class Address(Base):
    __tablename__ = "addresses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    street = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)
    zip = Column(String, nullable=False)
    country = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)

    user = relationship("User", back_populates="addresses")

class Reward(Base):
    __tablename__ = "rewards"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reward_type = Column(String)  # 'coupon', 'credit', 'freeship'
    value = Column(String)         # "10% OFF", "$5", etc.
    code = Column(String, unique=True)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="rewards")
