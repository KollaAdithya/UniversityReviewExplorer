"""add auth users

Revision ID: 003
Revises: 002
Create Date: 2026-05-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("firebase_uid", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_app_user_firebase_uid", "app_user", ["firebase_uid"], unique=True)

    op.add_column("review", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_review_user_id", "review", "app_user", ["user_id"], ["user_id"])


def downgrade() -> None:
    op.drop_constraint("fk_review_user_id", "review", type_="foreignkey")
    op.drop_column("review", "user_id")
    op.drop_index("ix_app_user_firebase_uid", table_name="app_user")
    op.drop_table("app_user")
