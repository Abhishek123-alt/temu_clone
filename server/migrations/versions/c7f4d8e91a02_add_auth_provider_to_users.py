"""add auth provider to users

Revision ID: c7f4d8e91a02
Revises: b5e3a7f1c204
Create Date: 2026-05-26 12:00:00.000000

Adds a `provider` enum column + a `provider_subject` text column to `users`
so we can tell at a glance how the account was authenticated and link a
specific social-provider identity (the Google `sub` claim) to a row.

Existing rows are backfilled to LOCAL — those accounts already have a real
bcrypt password_hash, so calling them LOCAL is correct.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7f4d8e91a02"
down_revision: Union[str, Sequence[str], None] = "b5e3a7f1c204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type explicitly first so we can reference it without
    # SQLAlchemy trying to create-or-skip on every column reference.
    auth_provider = sa.Enum("LOCAL", "GOOGLE", name="authprovider")
    auth_provider.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "provider",
            auth_provider,
            nullable=False,
            server_default="LOCAL",
        ),
    )
    op.add_column(
        "users",
        sa.Column("provider_subject", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_users_provider_subject",
        "users",
        ["provider_subject"],
    )


def downgrade() -> None:
    op.drop_index("ix_users_provider_subject", table_name="users")
    op.drop_column("users", "provider_subject")
    op.drop_column("users", "provider")
    sa.Enum(name="authprovider").drop(op.get_bind(), checkfirst=True)
