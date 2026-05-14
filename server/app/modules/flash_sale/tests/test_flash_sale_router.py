import pytest
from app.modules.flash_sale import router, models, schemas
from uuid import uuid4
from datetime import datetime, UTC, timedelta

def test_create_flash_sale(db_session):
    sale_in = schemas.FlashSaleCreate(
        name="Summer Blast",
        description="Big summer discounts",
        start_time=datetime.now(UTC) + timedelta(hours=1),
        end_time=datetime.now(UTC) + timedelta(days=1),
        is_active=True,
        products=[]
    )
    
    sale = router.create_flash_sale(sale_in, db_session)
    assert sale.name == "Summer Blast"
    assert sale.is_active is True

def test_get_active_flash_sales(db_session):
    # Create one active sale
    s1 = models.FlashSale(
        name="Active", 
        start_time=datetime.now(UTC) - timedelta(hours=1),
        end_time=datetime.now(UTC) + timedelta(hours=1),
        is_active=True
    )
    # Create one inactive sale
    s2 = models.FlashSale(
        name="Inactive", 
        start_time=datetime.now(UTC) - timedelta(hours=2),
        end_time=datetime.now(UTC) - timedelta(hours=1),
        is_active=True
    )
    db_session.add_all([s1, s2])
    db_session.commit()
    
    active_sales = router.get_active_flash_sales(db_session)
    assert len(active_sales) == 1
    assert active_sales[0].name == "Active"
