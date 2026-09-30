"""branches -- multiple physical locations under one restaurant account

Revision ID: 0053
Revises: 0052
Create Date: 2026-09-30

Every hospital gets exactly one `branches` row from day one (is_default=true), even when
multi-branch is off -- see the plan's own "branch_id always exists, the toggle only controls
visibility" principle. This migration backfills one default branch per existing hospital and
points every existing row of the 7 genuinely location-tied tables (departments, doctors,
appointments, food_orders, waitlist_entries, chef_notes, feedback) at it -- everything else
(menu, offers, staff logins, automations, permissions) stays hospital-wide, per the user's own
scoping decisions. `tables`/`doctor_leave`/`doctor_slots` are scoped transitively, through
department_id/doctor_id -- no branch_id column needed on those."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BRANCH_SCOPED_TABLES = ("departments", "doctors", "appointments", "food_orders", "waitlist_entries", "chef_notes", "feedback")


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("multi_branch_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        "branches",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("address_line", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("operating_days", sa.Text(), nullable=True),
        sa.Column("operating_hours", sa.Text(), nullable=True),
        sa.Column("turnover_minutes", sa.Integer(), nullable=True),
        sa.Column("booking_interval_minutes", sa.Integer(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_branches_hospital", "branches", ["hospital_id"])

    for table in _BRANCH_SCOPED_TABLES:
        op.add_column(table, sa.Column("branch_id", sa.Text(), nullable=True))

    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO branches (id, hospital_id, name, is_default, is_active, created_at) "
        "SELECT 'h' || id || '_default', id, name, true, true, now()::text FROM hospitals"
    ))
    for table in _BRANCH_SCOPED_TABLES:
        conn.execute(sa.text(
            f"UPDATE {table} SET branch_id = 'h' || hospital_id || '_default' WHERE branch_id IS NULL"
        ))
        op.alter_column(table, "branch_id", nullable=False)
        op.create_foreign_key(f"fk_{table}_branch_id", table, "branches", ["branch_id"], ["id"])
        op.create_index(f"idx_{table}_branch_id", table, ["branch_id"])

    # Safety net for the gap between this migration landing and Phase 2 (repository layer)
    # teaching every create_*() function about branch_id: until then, any INSERT that doesn't
    # set branch_id explicitly would otherwise violate the NOT NULL constraint above. This
    # trigger defaults it to the hospital's default branch, the same value the backfill used,
    # so existing (branch-unaware) call sites keep working unchanged -- harmless to keep even
    # after Phase 2 lands, since it only ever fires when branch_id is NULL.
    conn.execute(sa.text(
        "CREATE OR REPLACE FUNCTION set_default_branch_id() RETURNS trigger AS $$ "
        "BEGIN IF NEW.branch_id IS NULL THEN "
        "NEW.branch_id := 'h' || NEW.hospital_id || '_default'; END IF; RETURN NEW; END; "
        "$$ LANGUAGE plpgsql"
    ))
    for table in _BRANCH_SCOPED_TABLES:
        conn.execute(sa.text(f"DROP TRIGGER IF EXISTS trg_{table}_default_branch ON {table}"))
        conn.execute(sa.text(
            f"CREATE TRIGGER trg_{table}_default_branch BEFORE INSERT ON {table} "
            f"FOR EACH ROW EXECUTE FUNCTION set_default_branch_id()"
        ))


def downgrade() -> None:
    for table in reversed(_BRANCH_SCOPED_TABLES):
        op.execute(sa.text(f"DROP TRIGGER IF EXISTS trg_{table}_default_branch ON {table}"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS set_default_branch_id()"))
    for table in reversed(_BRANCH_SCOPED_TABLES):
        op.drop_index(f"idx_{table}_branch_id", table_name=table)
        op.drop_constraint(f"fk_{table}_branch_id", table, type_="foreignkey")
        op.drop_column(table, "branch_id")
    op.drop_index("idx_branches_hospital", table_name="branches")
    op.drop_table("branches")
    op.drop_column("hospitals", "multi_branch_enabled")
