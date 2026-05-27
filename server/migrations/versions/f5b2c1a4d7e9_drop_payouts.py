"""drop payouts table and order_items.payout_id

Keeps stores.commission_rate and order_items.commission_rate/amount so the
simpler "platform fee deducted" model still works.

Revision ID: f5b2c1a4d7e9
Revises: e4a1f9c2b0d3
Create Date: 2026-05-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f5b2c1a4d7e9'
down_revision: Union[str, Sequence[str], None] = 'e4a1f9c2b0d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_order_items_payout_id', table_name='order_items')
    op.drop_constraint('order_items_payout_id_fkey', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'payout_id')

    op.drop_index('ix_payouts_seller_id', table_name='payouts')
    op.drop_table('payouts')
    sa.Enum(name='payoutstatus').drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # Recreating the payouts table is intentionally not supported here — the
    # earlier migration (e4a1f9c2b0d3) is the source of truth if you ever want
    # the payout flow back. Re-running it would restore the schema.
    raise NotImplementedError(
        "Downgrade unsupported. Re-run migration e4a1f9c2b0d3 to restore the payouts table."
    )
