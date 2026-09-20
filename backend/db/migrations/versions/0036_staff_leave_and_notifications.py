"""staff leave requests, in-portal notifications, HR settings (yearly leave allowance)

Revision ID: 0036
Revises: 0035
Create Date: 2026-09-20

Staff HR leave (a person asks, a Manager approves/rejects, a yearly balance is tracked) and the
in-portal notifications that tell people about it. Dates are ISO text like the rest of the schema.
`days` is stored (calendar days, inclusive; 0.5 for a half-day) so a balance is a plain sum.
staff_hr_settings is one row per restaurant (attendance columns are added by 0037)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_leave_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("identities.id"), nullable=False),
        sa.Column("leave_type", sa.Text(), nullable=False),
        sa.Column("from_date", sa.Text(), nullable=False),
        sa.Column("to_date", sa.Text(), nullable=False),
        sa.Column("is_half_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("days", sa.Numeric(5, 1), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("identities.id"), nullable=True),
        sa.Column("decided_at", sa.Text(), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("(now()::text)")),
        sa.CheckConstraint("leave_type IN ('casual', 'sick', 'annual', 'unpaid', 'personal')", name="ck_staff_leave_type"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected', 'cancelled')", name="ck_staff_leave_status"),
        sa.CheckConstraint("to_date >= from_date", name="ck_staff_leave_dates"),
        sa.CheckConstraint("NOT is_half_day OR from_date = to_date", name="ck_staff_leave_half_day"),
    )
    op.create_index("ix_staff_leave_hospital_status", "staff_leave_requests", ["hospital_id", "status"])
    op.create_index("ix_staff_leave_staff_from", "staff_leave_requests", ["staff_id", "from_date"])

    op.create_table(
        "staff_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("identities.id"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("(now()::text)")),
    )
    op.create_index("ix_staff_notifications_staff_read", "staff_notifications", ["staff_id", "is_read"])

    op.create_table(
        "staff_hr_settings",
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), primary_key=True),
        sa.Column("annual_leave_days", sa.Integer(), nullable=False, server_default="20"),
        sa.CheckConstraint("annual_leave_days BETWEEN 0 AND 366", name="ck_staff_hr_leave_days"),
    )


def downgrade() -> None:
    op.drop_table("staff_hr_settings")
    op.drop_index("ix_staff_notifications_staff_read", table_name="staff_notifications")
    op.drop_table("staff_notifications")
    op.drop_index("ix_staff_leave_staff_from", table_name="staff_leave_requests")
    op.drop_index("ix_staff_leave_hospital_status", table_name="staff_leave_requests")
    op.drop_table("staff_leave_requests")
