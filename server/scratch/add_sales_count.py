from sqlalchemy import text
from app.db.session import SessionLocal

def add_column():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0"))
        db.commit()
        print("Successfully added sales_count column to products table.")
    except Exception as e:
        print(f"Error adding column: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_column()
