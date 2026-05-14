import pytest
from app.modules.product import services, schemas
from app.modules.user.models import User
from uuid import uuid4

@pytest.fixture
def test_category(db_session):
    cat_in = schemas.CategoryCreate(name="Electronics", description="Gadgets and stuff")
    return services.create_category(db_session, cat_in)

@pytest.fixture
def test_seller(db_session):
    user = User(
        id=uuid4(),
        email=f"seller_{uuid4().hex[:6]}@example.com",
        password_hash="hashed",
        full_name="Test Seller",
        role="SELLER"
    )
    db_session.add(user)
    db_session.commit()
    return user

def test_create_product_success(db_session, test_category, test_seller):
    product_in = schemas.ProductCreate(
        title="Test Phone",
        description="A great phone",
        price=999.99,
        stock=10,
        category_id=test_category.id,
        images=["http://example.com/phone.jpg"],
        options=[
            schemas.OptionCreate(name="Color", values=["Black", "White"])
        ],
        variants=[
            schemas.VariantCreate(sku="PHONE-BLK", price=999.99, stock=5, option_values=["Black"])
        ]
    )
    
    product = services.create_product(db_session, product_in, test_seller.id)
    
    assert product.title == "Test Phone"
    assert product.slug == "test-phone"
    assert len(product.options) == 1
    assert len(product.variants) == 1
    assert product.variants[0].sku == "PHONE-BLK"

def test_get_products_filtering(db_session, test_category, test_seller):
    # Create a normal product
    p1_in = schemas.ProductCreate(
        title="Normal Product", price=100.0, stock=10, category_id=test_category.id
    )
    services.create_product(db_session, p1_in, test_seller.id)
    
    # Create a deal product
    p2_in = schemas.ProductCreate(
        title="Deal Product", price=50.0, original_price=100.0, stock=10, category_id=test_category.id
    )
    services.create_product(db_session, p2_in, test_seller.id)
    
    all_prods = services.get_products(db_session)
    assert len(all_prods) >= 2
    
    deal_prods = services.get_products(db_session, deal_only=True)
    assert any(p.title == "Deal Product" for p in deal_prods)
    assert all(p.original_price > p.price for p in deal_prods)

def test_wishlist_operations(db_session, test_category, test_seller):
    p_in = schemas.ProductCreate(
        title="Wishlist Item", price=10.0, stock=5, category_id=test_category.id
    )
    product = services.create_product(db_session, p_in, test_seller.id)
    
    user_id = uuid4() # Dummy user
    
    # Add to wishlist
    services.add_to_wishlist(db_session, user_id, product.id)
    wishlist = services.get_wishlist(db_session, user_id)
    assert len(wishlist) == 1
    assert wishlist[0].product_id == product.id
    
    # Remove from wishlist
    services.remove_from_wishlist(db_session, user_id, product.id)
    wishlist = services.get_wishlist(db_session, user_id)
    assert len(wishlist) == 0
