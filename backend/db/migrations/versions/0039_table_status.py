"""tables gain a real-time status (free / occupied / needs_cleaning)

Revision ID: 0039
Revises: 0038
Create Date: 2026-09-23

Live Operations follow-up: explicit, staff-driven table occupancy -- a table only becomes 'occupied' via a real
Seat action and only clears via a real Clear action, never inferred from a reservation's turnover_minutes guess.
Every existing table defaults to 'free' (nothing was mid-seating before this column existed)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tables", sa.Column("status", sa.String(length=20), nullable=False, server_default="free"))


def downgrade() -> None:
    op.drop_column("tables", "status")
