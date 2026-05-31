"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course",
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_code", sa.String(length=20), nullable=False),
        sa.Column("course_name", sa.String(length=100), nullable=False),
        sa.Column("department", sa.String(length=50), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("course_id"),
    )
    op.create_index("ix_course_course_code", "course", ["course_code"], unique=False)

    op.create_table(
        "professor",
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("professor_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("professor_id"),
    )

    op.create_table(
        "course_offering",
        sa.Column("offering_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("semester", sa.String(length=20), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["course.course_id"]),
        sa.ForeignKeyConstraint(["professor_id"], ["professor.professor_id"]),
        sa.PrimaryKeyConstraint("offering_id"),
    )

    op.create_table(
        "review",
        sa.Column("review_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("offering_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_text", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["offering_id"], ["course_offering.offering_id"]),
        sa.PrimaryKeyConstraint("review_id"),
    )

    op.create_table(
        "sentiment_analysis",
        sa.Column("review_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sentiment", sa.String(length=20), nullable=False),
        sa.Column("confidence_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["review.review_id"]),
        sa.PrimaryKeyConstraint("review_id"),
    )

    op.create_table(
        "topic_analysis",
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("review_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic_name", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["review.review_id"]),
        sa.PrimaryKeyConstraint("topic_id"),
    )

    op.create_table(
        "course_summary",
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("positive_reviews", sa.Integer(), nullable=False),
        sa.Column("neutral_reviews", sa.Integer(), nullable=False),
        sa.Column("negative_reviews", sa.Integer(), nullable=False),
        sa.Column("overall_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("generated_summary", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["course.course_id"]),
        sa.PrimaryKeyConstraint("course_id"),
    )


def downgrade() -> None:
    op.drop_table("course_summary")
    op.drop_table("topic_analysis")
    op.drop_table("sentiment_analysis")
    op.drop_table("review")
    op.drop_table("course_offering")
    op.drop_table("professor")
    op.drop_index("ix_course_course_code", table_name="course")
    op.drop_table("course")
