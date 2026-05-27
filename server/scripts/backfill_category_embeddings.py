"""Backfill Category.embedding for any categories created before the column
existed. Safe to re-run — only updates rows where embedding IS NULL.

Run:  python -m scripts.backfill_category_embeddings
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app  # noqa: F401 — registers all SQLAlchemy mappers
from app.db.session import SessionLocal
from app.modules.product.models import Category
from app.core.embeddings import generate_embedding


def main():
    db = SessionLocal()
    try:
        rows = db.query(Category).filter(Category.embedding.is_(None)).all()
        print(f"Backfilling {len(rows)} categories…")
        for cat in rows:
            text = f"{cat.name or ''} {cat.description or ''}".strip()
            cat.embedding = generate_embedding(text)
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
