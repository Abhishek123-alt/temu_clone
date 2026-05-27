"""add per-order shipping/tax/platform_fee/discount breakdown

These columns let the dashboards attribute each customer payment correctly:
  shipping_amount  -> seller
  tax_amount       -> govt (passthrough, shown for transparency)
  platform_fee     -> admin (flat $0.30 + 2%)
  discount_amount  -> platform absorbs

Existing rows keep 0 in these columns; compute_seller_share falls back to the
old proration formula for those orders so historical numbers don't lurch.

Revision ID: aa31de4b9c7f
Revises: f5b2c1a4d7e9
Create Date: 2026-05-24 19:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'aa31de4b9c7f'
down_revision: Union[str, Sequence[str], None] = 'f5b2c1a4d7e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('shipping_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('platform_fee', sa.Float(), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('orders', 'discount_amount')
    op.drop_column('orders', 'platform_fee')
    op.drop_column('orders', 'tax_amount')
    op.drop_column('orders', 'shipping_amount')
