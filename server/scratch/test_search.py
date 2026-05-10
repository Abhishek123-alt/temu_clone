import sys
import os
from sqlalchemy.orm import Session

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.modules.user.models import User
from app.modules.product.models import Product
from app.modules.product.services import get_products
from app.core.embeddings import generate_embedding

def test_search(query_str):
    db: Session = SessionLocal()
    try:
        print(f"🔍 Testing search for: '{query_str}'")
        products = get_products(db, search=query_str)
        print(f"✅ Found {len(products)} products:")
        for p in products:
            print(f" - {p.title}")
    finally:
        db.close()

if __name__ == "__main__":
    search_term = sys.argv[1] if len(sys.argv) > 1 else "Smartphone"
    test_search(search_term)
