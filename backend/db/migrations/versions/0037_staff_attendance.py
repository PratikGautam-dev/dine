"""staff attendance (clock in/out), working pattern, attendance settings

Revision ID: 0037
Revises: 0036
Create Date: 2026-09-20

staff_attendance: one row per person per WORK DATE (the restaurant's own local date, so a night owl
near midnight lands on the right day), UNIQUE(staff_id, work_date). Times are UTC ISO text. Absent
and on-leave are never stored -- they are computed from the working pattern, approved leave and the
presence of a row.

staff_details gains a weekly working pattern (working_days, shift_start, shift_end); a person with
none falls back to the restaurant's default shift. staff_hr_settings gains the shift window, the
late grace period and the optional location rule (GPS point + radius and/or allowed IPs)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("identities.id"), nullable=False),
        sa.Column("work_date", sa.Text(), nullable=False),
        sa.Column("check_in_at", sa.Text(), nullable=False),
        sa.Column("check_in_lat", sa.Float(), nullable=True),
        sa.Column("check_in_lng", sa.Float(), nullable=True),
        sa.Column("check_in_ip", sa.Text(), nullable=True),
        sa.Column("check_in_method", sa.Text(), nullable=False),
        sa.Column("check_out_at", sa.Text(), nullable=True),
        sa.Column("check_out_lat", sa.Float(), nullable=True),
        sa.Column("check_out_lng", sa.Float(), nullable=True),
        sa.Column("check_out_ip", sa.Text(), nullable=True),
        sa.Column("break_started_at", sa.Text(), nullable=True),
        sa.Column("break_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("late_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("working_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overtime_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("corrected_by", sa.Integer(), sa.ForeignKey("identities.id"), nullable=True),
        sa.Column("correction_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False, server_default=sa.text("(now()::text)")),
        sa.CheckConstraint("status IN ('on_time', 'late')", name="ck_staff_attendance_status"),
        sa.CheckConstraint("check_in_method IN ('gps', 'ip', 'unrestricted')", name="ck_staff_attendance_method"),
        sa.UniqueConstraint("staff_id", "work_date", name="ux_staff_attendance_staff_date"),
    )
    op.create_index("ix_staff_attendance_hospital_date", "staff_attendance", ["hospital_id", "work_date"])

    op.add_column("staff_details", sa.Column("working_days", sa.Text(), nullable=True))
    op.add_column("staff_details", sa.Column("shift_start", sa.Text(), nullable=True))
    op.add_column("staff_details", sa.Column("shift_end", sa.Text(), nullable=True))

    op.add_column("staff_hr_settings", sa.Column("shift_start", sa.Text(), nullable=True))
    op.add_column("staff_hr_settings", sa.Column("shift_end", sa.Text(), nullable=True))
    op.add_column("staff_hr_settings", sa.Column("late_grace_minutes", sa.Integer(), nullable=False, server_default="10"))
    op.add_column("staff_hr_settings", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("staff_hr_settings", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("staff_hr_settings", sa.Column("radius_meters", sa.Integer(), nullable=True))
    op.add_column("staff_hr_settings", sa.Column("allowed_ips", sa.Text(), nullable=True))
    op.create_check_constraint("ck_staff_hr_grace", "staff_hr_settings", "late_grace_minutes BETWEEN 0 AND 240")


def downgrade() -> None:
    op.drop_constraint("ck_staff_hr_grace", "staff_hr_settings", type_="check")
    for col in ("allowed_ips", "radius_meters", "longitude", "latitude", "late_grace_minutes", "shift_end", "shift_start"):
        op.drop_column("staff_hr_settings", col)
    for col in ("shift_end", "shift_start", "working_days"):
        op.drop_column("staff_details", col)
    op.drop_index("ix_staff_attendance_hospital_date", table_name="staff_attendance")
    op.drop_table("staff_attendance")
