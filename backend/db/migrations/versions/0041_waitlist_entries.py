"""waitlist_entries -- the walk-in/waitlist queue (Table Bookings follow-up)

Revision ID: 0041
Revises: 0040
Create Date: 2026-09-23

A walk-in party waiting for a table -- deliberately NOT an appointments row (no future scheduled_at,
no reservation): "assign" seats a real table (tables.status -> 'occupied', db/repositories/tables.py's
set_table_status()) and closes the entry, it never creates a booking."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("guest_name", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="waiting"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("assigned_table_id", sa.Text(), sa.ForeignKey("tables.id"), nullable=True),
        sa.Column("assigned_at", sa.Text(), nullable=True),
        sa.Column("assigned_by", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "waitlist_entries_status_check", "waitlist_entries",
        "status IN ('waiting', 'assigned', 'cancelled')",
    )
    op.create_index("idx_waitlist_entries_hospital_status", "waitlist_entries", ["hospital_id", "status"])


def downgrade() -> None:
    op.drop_table("waitlist_entries")
