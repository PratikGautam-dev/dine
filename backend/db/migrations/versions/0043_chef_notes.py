"""chef_notes -- the Kitchen Orders page's real notes board

Revision ID: 0043
Revises: 0042
Create Date: 2026-09-23

Kitchen Orders (KDS) follow-up: a small, real shared notes board for kitchen staff ("prep more
marinade for the dinner rush") -- attributed to whoever actually posted it (the logged-in staff
member's own name), not an invented persona."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chef_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_by_name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_chef_notes_hospital", "chef_notes", ["hospital_id", "created_at"])


def downgrade() -> None:
    op.drop_table("chef_notes")
