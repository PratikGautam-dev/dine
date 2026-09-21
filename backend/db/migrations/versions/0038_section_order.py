"""departments (restaurant sections) gain a display order

Revision ID: 0038
Revises: 0037
Create Date: 2026-09-21

Sections are now a managed list: named, ordered, renamed and removed from the Tables page. sort_order starts at 1
(0 means "unset"), backfilled per restaurant in the alphabetical order the sections were already shown in, so nothing
moves on deploy."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.execute(
        "UPDATE departments d SET sort_order = n.rn FROM (SELECT id, row_number() OVER (PARTITION BY hospital_id ORDER BY name, id) AS rn "
        "FROM departments) n WHERE n.id = d.id"
    )


def downgrade() -> None:
    op.drop_column("departments", "sort_order")
