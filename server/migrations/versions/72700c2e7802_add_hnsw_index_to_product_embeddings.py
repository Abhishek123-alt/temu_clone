"""add_hnsw_index_to_product_embeddings

Revision ID: 72700c2e7802
Revises: d117696debf6
Create Date: 2026-05-11 23:05:51.153577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72700c2e7802'
down_revision: Union[str, Sequence[str], None] = 'd117696debf6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE INDEX ON products USING hnsw (embedding vector_cosine_ops)")

def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS products_embedding_idx")
    # Note: Alembic usually generates a name, but since we did a manual CREATE INDEX,
    # pgvector/postgres might name it differently. Using a standard naming pattern here.
    # In a production environment, we would name the index explicitly:
    # CREATE INDEX idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);
