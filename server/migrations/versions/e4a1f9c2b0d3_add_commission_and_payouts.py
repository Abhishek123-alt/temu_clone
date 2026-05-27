"""add commission rate and payouts table

Revision ID: e4a1f9c2b0d3
Revises: b58e2d7c9a01
Create Date: 2026-05-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e4a1f9c2b0d3'
down_revision: Union[str, Sequence[str], None] = 'b58e2d7c9a01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'stores',
        sa.Column('commission_rate', sa.Float(), nullable=False, server_default='0.10'),
    )

    op.create_table(
        'payouts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('seller_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('gross_items', sa.Float(), nullable=False, server_default='0'),
        sa.Column('commission', sa.Float(), nullable=False, server_default='0'),
        sa.Column('refunds', sa.Float(), nullable=False, server_default='0'),
        sa.Column('refunded_commission', sa.Float(), nullable=False, server_default='0'),
        sa.Column('net_payout', sa.Float(), nullable=False, server_default='0'),
        # Project convention: store the Python Enum NAME (uppercase) in Postgres.
        # SQLAlchemy's Enum(PayoutStatus) sends e.g. "PENDING", not "pending".
        sa.Column(
            'status',
            sa.Enum('PENDING', 'PAID', 'FAILED', name='payoutstatus'),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('reference', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_payouts_seller_id', 'payouts', ['seller_id'])

    op.add_column(
        'order_items',
        sa.Column('commission_rate', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'order_items',
        sa.Column('commission_amount', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'order_items',
        sa.Column(
            'payout_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('payouts.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index('ix_order_items_payout_id', 'order_items', ['payout_id'])


def downgrade() -> None:
    op.drop_index('ix_order_items_payout_id', table_name='order_items')
    op.drop_column('order_items', 'payout_id')
    op.drop_column('order_items', 'commission_amount')
    op.drop_column('order_items', 'commission_rate')

    op.drop_index('ix_payouts_seller_id', table_name='payouts')
    op.drop_table('payouts')
    sa.Enum(name='payoutstatus').drop(op.get_bind(), checkfirst=False)

    op.drop_column('stores', 'commission_rate')
