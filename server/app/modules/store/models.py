from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime, UTC
from app.db.session import Base

class StoreStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"

class Store(Base):
    __tablename__ = "stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    store_name = Column(String, nullable=False)
    description = Column(String)
    logo_url = Column(String)
    banner_url = Column(String)
    tax_id = Column(String, nullable=False)
    business_type = Column(String) # e.g., Sole Proprietorship, LLC
    category = Column(String)
    warehouse_address = Column(String, nullable=False)
    status = Column(Enum(StoreStatus), default=StoreStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    user = relationship("User", backref="store")
