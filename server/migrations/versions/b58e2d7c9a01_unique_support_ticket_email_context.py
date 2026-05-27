"""unique support_tickets (lower(from_email), context) when context is set

Revision ID: b58e2d7c9a01
Revises: a3c1f9d27b4e
Create Date: 2026-05-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b58e2d7c9a01'
down_revision: Union[str, Sequence[str], None] = 'a3c1f9d27b4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = 'uq_support_tickets_email_context'


def upgrade() -> None:
    """Add a partial unique index so the same (email, context) pair can only
    have one ticket. Context-less tickets are still allowed to coexist
    (postgresql_where = context IS NOT NULL). Service code does an
    application-level upsert; this index is a safety net for races."""
    bind = op.get_bind()

    # Collapse any pre-existing duplicates so the unique index can be built.
    # Strategy: keep the oldest ticket per (lower(email), context) pair,
    # delete the rest. Duplicates almost certainly don't exist in dev yet
    # but this makes the migration safe to run anywhere.
    bind.execute(sa.text("""
        DELETE FROM support_tickets t
        USING (
            SELECT id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                         PARTITION BY lower(from_email), context
                         ORDER BY created_at ASC
                       ) AS rn
                FROM support_tickets
                WHERE context IS NOT NULL
            ) ranked
            WHERE rn > 1
        ) dupes
        WHERE t.id = dupes.id
    """))

    op.create_index(
        INDEX_NAME,
        'support_tickets',
        [sa.text('lower(from_email)'), 'context'],
        unique=True,
        postgresql_where=sa.text('context IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name='support_tickets')
