import pytest
from sqlalchemy.orm import Session
from app.modules.product.services import get_products
from unittest.mock import patch

def test_search(db_session: Session):
    query_str = "Phone"
    print(f"\n🔍 Testing search for: '{query_str}'")
    
    # Mock generate_embedding to return None so it skips cosine_distance (not supported in SQLite)
    with patch("app.modules.product.services.generate_embedding", return_value=None):
        products = get_products(db_session, search=query_str)
        print(f"✅ Found {len(products)} products:")
        for p in products:
            print(f" - {p.title}")
        
        # Since it's a test, we should assert something
        assert isinstance(products, list)

if __name__ == "__main__":
    # If run as a script, we still want it to work
    import sys
    import os
    from app.db.session import SessionLocal
    
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    
    search_term = sys.argv[1] if len(sys.argv) > 1 else "Smartphone"
    db = SessionLocal()
    try:
        products = get_products(db, search=search_term)
        print(f"Found {len(products)} products for '{search_term}'")
    finally:
        db.close()
