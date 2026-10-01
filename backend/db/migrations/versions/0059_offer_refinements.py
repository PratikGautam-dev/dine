"""offers.branch_id + offers.per_customer_limit

Revision ID: 0059
Revises: 0058
Create Date: 2026-10-01

Both nullable, both additive, both preserve today's default behavior when unset:
- branch_id NULL (the default, unchanged by this migration for every existing offer) means
  "all branches" -- offers.py's own confirmed-scope docstring already says offers are shared
  across branches by default; this only adds the OPTION to restrict one to a single branch.
- per_customer_limit NULL means "no per-customer cap" (today's behavior, unchanged) --
  max_redemptions already caps total usage across all guests; this adds an orthogonal
  per-phone-number cap on top of it."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0059"
down_revision: Union[str, None] = "0058"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("offers", sa.Column("branch_id", sa.Text(), sa.ForeignKey("branches.id"), nullable=True))
    op.add_column("offers", sa.Column("per_customer_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("offers", "per_customer_limit")
    op.drop_column("offers", "branch_id")
