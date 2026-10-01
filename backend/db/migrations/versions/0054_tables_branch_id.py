"""tables.branch_id -- the one branch-scoped table migration 0053 missed

Revision ID: 0054
Revises: 0053
Create Date: 2026-10-01

`tables` was added in migration 0030, before `branches` existed (0053) -- it was scoped only
transitively, through `department_id` -> `departments.branch_id`. Every genuine read/write path
already resolves a table's branch correctly via that join (portal/routes/tables.py's own
branch_id filter, db/repositories/live_operations.py's table filter), but several call sites do
that join manually today. Adding branch_id directly here removes the need for it, and matches
every other branch-scoped table's own direct-column shape. Same "branch_id always exists, backfilled
from the obvious source" discipline 0053 established -- here backfilled from each table's own
department's branch_id, not re-derived from scratch."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0054"
down_revision: Union[str, None] = "0053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tables", sa.Column("branch_id", sa.Text(), nullable=True))

    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE tables t SET branch_id = d.branch_id "
        "FROM departments d WHERE d.id = t.department_id AND t.branch_id IS NULL"
    ))
    op.alter_column("tables", "branch_id", nullable=False)
    op.create_foreign_key("fk_tables_branch_id", "tables", "branches", ["branch_id"], ["id"])
    op.create_index("idx_tables_branch_id", "tables", ["branch_id"])

    # Same safety-net trigger 0053 added for its own 7 tables, mirrored here: until
    # create_table() is updated to pass branch_id explicitly, any INSERT that doesn't set it
    # falls back to the table's own department's branch -- harmless to keep afterward too.
    conn.execute(sa.text(
        "CREATE OR REPLACE FUNCTION set_default_table_branch_id() RETURNS trigger AS $$ "
        "BEGIN IF NEW.branch_id IS NULL THEN "
        "NEW.branch_id := (SELECT branch_id FROM departments WHERE id = NEW.department_id); "
        "END IF; RETURN NEW; END; "
        "$$ LANGUAGE plpgsql"
    ))
    conn.execute(sa.text("DROP TRIGGER IF EXISTS trg_tables_default_branch ON tables"))
    conn.execute(sa.text(
        "CREATE TRIGGER trg_tables_default_branch BEFORE INSERT ON tables "
        "FOR EACH ROW EXECUTE FUNCTION set_default_table_branch_id()"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_tables_default_branch ON tables"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS set_default_table_branch_id()"))
    op.drop_index("idx_tables_branch_id", table_name="tables")
    op.drop_constraint("fk_tables_branch_id", "tables", type_="foreignkey")
    op.drop_column("tables", "branch_id")
