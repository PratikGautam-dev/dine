"""payments + refunds -- a real, structured payment record per order

Revision ID: 0056
Revises: 0055
Create Date: 2026-10-01

Deliberately ADDITIVE, not a replacement: food_orders.razorpay_order_id/razorpay_payment_id/
razorpay_payment_link_url/mock_payment_ref stay exactly as they are (this is a live payment
system against real production orders -- dropping columns mid-flight is a separate, much more
careful pass, not something to bundle into the same migration that adds the new table). Every
write path (create_razorpay_payment, mark_order_paid_mock, handle_razorpay_webhook) now ALSO
writes a structured `payments` row, giving real support for "one order, one payment record,
queryable/extensible on its own" going forward, without touching anything that already works.

No backfill of historical orders into `payments` -- their payment facts still live on their own
food_orders row exactly as before; only new activity gets a payments row."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0056"
down_revision: Union[str, None] = "0055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("branch_id", sa.Text(), sa.ForeignKey("branches.id"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("food_orders.id"), nullable=False),
        sa.Column("method", sa.Text(), nullable=False),  # 'razorpay' | 'mock'
        sa.Column("provider", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),  # pending | paid | failed
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("provider_payment_id", sa.Text(), nullable=True),
        sa.Column("provider_order_id", sa.Text(), nullable=True),
        sa.Column("payment_link_url", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_payments_hospital", "payments", ["hospital_id"])
    op.create_index("idx_payments_order", "payments", ["order_id"])
    op.create_unique_constraint("uq_payments_idempotency_key", "payments", ["hospital_id", "idempotency_key"])

    op.create_table(
        "refunds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id"), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("provider_refund_id", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_refunds_payment", "refunds", ["payment_id"])


def downgrade() -> None:
    op.drop_index("idx_refunds_payment", table_name="refunds")
    op.drop_table("refunds")
    op.drop_constraint("uq_payments_idempotency_key", "payments", type_="unique")
    op.drop_index("idx_payments_order", table_name="payments")
    op.drop_index("idx_payments_hospital", table_name="payments")
    op.drop_table("payments")
