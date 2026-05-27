"""add category embedding column

Revision ID: c1e8d3a4f2b9
Revises: 46496445bbb9
Create Date: 2026-05-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector


revision: str = 'c1e8d3a4f2b9'
down_revision: Union[str, Sequence[str], None] = '46496445bbb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.add_column('categories', sa.Column('embedding', pgvector.sqlalchemy.Vector(dim=384), nullable=True))


def downgrade() -> None:
    op.drop_column('categories', 'embedding')
