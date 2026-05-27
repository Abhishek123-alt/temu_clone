"""add name column to addresses

Revision ID: 9a1288c30979
Revises: c1e8d3a4f2b9
Create Date: 2026-05-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9a1288c30979'
down_revision: Union[str, Sequence[str], None] = 'c1e8d3a4f2b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('addresses', sa.Column('name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('addresses', 'name')
