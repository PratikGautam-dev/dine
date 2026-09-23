"""tables gain a real floor-map position, shape, notes, and a 'blocked' status

Revision ID: 0042
Revises: 0041
Create Date: 2026-09-23

Tables page follow-up: pos_x/pos_y (percent of the floor canvas, NULL until a table is ever
dragged -- the frontend falls back to an auto-computed grid position for anything unset), shape
(staff-set 'rect'/'round', not inferred), notes (free text). tables.status never had a CHECK
constraint before this migration -- adding one now (free/occupied/needs_cleaning/blocked) closes
that gap while extending the value set, matching the appointments.status precedent."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tables", sa.Column("pos_x", sa.Float(), nullable=True))
    op.add_column("tables", sa.Column("pos_y", sa.Float(), nullable=True))
    op.add_column("tables", sa.Column("shape", sa.Text(), nullable=False, server_default="rect"))
    op.add_column("tables", sa.Column("notes", sa.Text(), nullable=True))
    op.create_check_constraint(
        "tables_status_check", "tables",
        "status IN ('free', 'occupied', 'needs_cleaning', 'blocked')",
    )


def downgrade() -> None:
    op.drop_constraint("tables_status_check", "tables", type_="check")
    op.drop_column("tables", "notes")
    op.drop_column("tables", "shape")
    op.drop_column("tables", "pos_y")
    op.drop_column("tables", "pos_x")
