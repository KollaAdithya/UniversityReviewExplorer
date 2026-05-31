"""add university dimension

Revision ID: 002
Revises: 001
Create Date: 2026-05-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "university",
        sa.Column("university_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("country", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("university_id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_university_name", "university", ["name"], unique=False)
    op.create_index("ix_university_slug", "university", ["slug"], unique=False)

    op.add_column("course", sa.Column("university_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("professor", sa.Column("university_id", postgresql.UUID(as_uuid=True), nullable=True))

    bind = op.get_bind()
    demo_id = bind.execute(
        sa.text(
            "INSERT INTO university (university_id, name, slug, country) "
            "VALUES (gen_random_uuid(), 'Demo Campus', 'demo-campus', 'USA') RETURNING university_id"
        )
    ).scalar_one()
    bind.execute(sa.text("UPDATE course SET university_id = :uid"), {"uid": demo_id})
    bind.execute(sa.text("UPDATE professor SET university_id = :uid"), {"uid": demo_id})

    op.alter_column("course", "university_id", nullable=False)
    op.alter_column("professor", "university_id", nullable=False)
    op.create_foreign_key("fk_course_university", "course", "university", ["university_id"], ["university_id"])
    op.create_foreign_key("fk_professor_university", "professor", "university", ["university_id"], ["university_id"])
    op.create_unique_constraint("uq_course_university_code", "course", ["university_id", "course_code"])
    op.create_unique_constraint("uq_professor_university_name", "professor", ["university_id", "professor_name"])


def downgrade() -> None:
    op.drop_constraint("uq_professor_university_name", "professor", type_="unique")
    op.drop_constraint("uq_course_university_code", "course", type_="unique")
    op.drop_constraint("fk_professor_university", "professor", type_="foreignkey")
    op.drop_constraint("fk_course_university", "course", type_="foreignkey")
    op.drop_column("professor", "university_id")
    op.drop_column("course", "university_id")
    op.drop_index("ix_university_slug", table_name="university")
    op.drop_index("ix_university_name", table_name="university")
    op.drop_table("university")
