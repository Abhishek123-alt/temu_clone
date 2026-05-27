import pytest
from sqlalchemy import create_engine, TypeDecorator, JSON, Text
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from sqlalchemy.dialects.postgresql import JSONB

# Patch JSONB for SQLite compatibility
class SQLiteJSONB(TypeDecorator):
    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return value

    def process_result_value(self, value, dialect):
        return value

# Patch pgvector Vector for SQLite compatibility
class SQLiteVector(TypeDecorator):
    impl = JSON # Store vectors as JSON lists in SQLite
    cache_ok = True

    def __init__(self, dim=None):
        super().__init__()

    def process_bind_param(self, value, dialect):
        return value

    def process_result_value(self, value, dialect):
        return value

# Monkeypatch the JSONB and Vector types
import sqlalchemy.dialects.postgresql
sqlalchemy.dialects.postgresql.JSONB = SQLiteJSONB

# Handle pgvector if it's installed/used
try:
    import pgvector.sqlalchemy
    pgvector.sqlalchemy.Vector = SQLiteVector
except ImportError:
    pass

# Import all models to ensure they are registered with Base.metadata
from app.modules.user.models import User, Address, PaymentMethod, Reward
from app.modules.store.models import Store
from app.modules.product.models import Category, Product, ProductImage, ProductOption, ProductOptionValue, ProductVariant, WishlistItem, RecentlyViewed
from app.modules.order.models import Order, OrderItem, OrderEvent, Shipment, Return, ReturnItem, Outbox
from app.modules.cart.models import Cart, CartItem
from app.modules.flash_sale.models import FlashSale, FlashSaleProduct
from app.modules.quest.models import Quest, UserQuestProgress
from app.modules.support.models import SupportTicket
from app.modules.gamification.models import MiniGameState

# Use an in-memory SQLite database for tests
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create all tables once for the entire test session, ensuring a clean start."""
    # Vanish and recreate tables at the very start of the test session
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup after session ends
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    """Provides a clean database session for each test using transactions."""
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


