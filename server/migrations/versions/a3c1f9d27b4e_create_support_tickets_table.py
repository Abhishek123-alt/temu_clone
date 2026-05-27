"""create support_tickets table

Revision ID: a3c1f9d27b4e
Revises: 311752bd299a
Create Date: 2026-05-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a3c1f9d27b4e'
down_revision: Union[str, Sequence[str], None] = '311752bd299a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'support_tickets' in inspector.get_table_names():
        return

    # Create the Postgres enum type idempotently. We then reference it on the
    # column with create_type=False so create_table doesn't try to CREATE TYPE
    # again — that would fail if a previous migration attempt left the type
    # behind without the table.
    support_ticket_status = postgresql.ENUM(
        'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED',
        name='supportticketstatus',
    )
    support_ticket_status.create(bind, checkfirst=True)

    status_col_type = postgresql.ENUM(
        'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED',
        name='supportticketstatus',
        create_type=False,
    )

    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('from_email', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('context', sa.String(), nullable=True),
        sa.Column('status', status_col_type, nullable=False, server_default='OPEN'),
        sa.Column('linked_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_support_tickets_from_email', 'support_tickets', ['from_email'])
    op.create_index('ix_support_tickets_status', 'support_tickets', ['status'])
    op.create_index('ix_support_tickets_linked_user_id', 'support_tickets', ['linked_user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_support_tickets_linked_user_id', table_name='support_tickets')
    op.drop_index('ix_support_tickets_status', table_name='support_tickets')
    op.drop_index('ix_support_tickets_from_email', table_name='support_tickets')
    op.drop_table('support_tickets')
    postgresql.ENUM(name='supportticketstatus').drop(op.get_bind(), checkfirst=True)
