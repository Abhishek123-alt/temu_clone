"""add_reviews_table

Revision ID: 9facd1ece47e
Revises: 355bcdb58274
Create Date: 2026-05-12 19:13:35.977923

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9facd1ece47e'
down_revision: Union[str, Sequence[str], None] = '355bcdb58274'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint('user_id', 'product_id', name='uq_user_product_review'),
    )
    op.create_index('ix_reviews_product_id', 'reviews', ['product_id'])
    op.create_index('ix_reviews_user_id', 'reviews', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_reviews_user_id', table_name='reviews')
    op.drop_index('ix_reviews_product_id', table_name='reviews')
    op.drop_table('reviews')
