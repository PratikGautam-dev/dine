"""feedback -- minimal WhatsApp guest feedback (star rating, optional comment)

Revision ID: 0045
Revises: 0044
Create Date: 2026-09-25

A guest can tap "Rate & Give Feedback" from the WhatsApp main menu and pick 1-5 stars
(flows/router.py's give_feedback dispatch) -- this is the one real source of rows here today.
No sentiment analysis, NPS, or complaint-category system exists; the Feedback portal page reads
this table as-is, nothing more."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0045"
down_revision: Union[str, None] = "0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=True),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False, server_default="whatsapp"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="feedback_rating_range_chk"),
    )
    op.create_index("idx_feedback_hospital", "feedback", ["hospital_id", "created_at"])


def downgrade() -> None:
    op.drop_table("feedback")
