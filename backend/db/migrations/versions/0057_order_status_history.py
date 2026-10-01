"""order_status_history -- an audit trail of food_orders status transitions

Revision ID: 0057
Revises: 0056
Create Date: 2026-10-01

advance_order_status() (db/repositories/food_orders.py) already runs a guarded
UPDATE ... WHERE status = <expected_status> inside one autocommit connection; this
adds one INSERT right alongside it, in the same connection, so every transition it
makes (portal actions, the Razorpay webhook, mock-pay) is recorded. No backfill --
orders that transitioned before this migration simply have no history rows, same
"no backfill of historical orders" choice migration 0056 made for payments."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0057"
down_revision: Union[str, None] = "0056"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "order_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("food_orders.id"), nullable=False),
        sa.Column("from_status", sa.Text(), nullable=False),
        sa.Column("to_status", sa.Text(), nullable=False),
        sa.Column("changed_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_order_status_history_order", "order_status_history", ["order_id"])


def downgrade() -> None:
    op.drop_index("idx_order_status_history_order", table_name="order_status_history")
    op.drop_table("order_status_history")
