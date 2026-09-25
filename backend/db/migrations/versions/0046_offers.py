"""offers -- real coupon codes redeemable at WhatsApp food-order checkout

Revision ID: 0046
Revises: 0045
Create Date: 2026-09-25

A guest can type a coupon code at the order-review step of the WhatsApp food-ordering flow
(flows/food_ordering/dispatch.py); if valid, the discount is applied and the order records
which offer it used. No Swiggy/Zomato/Dine-in channel restriction exists (only real fulfillment
types -- an offer can optionally be scoped to pickup/delivery, or apply to both)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "offers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("discount_type", sa.Text(), nullable=False),
        sa.Column("discount_value", sa.Integer(), nullable=False),
        sa.Column("coupon_code", sa.Text(), nullable=False),
        sa.Column("valid_from", sa.Text(), nullable=False),
        sa.Column("valid_to", sa.Text(), nullable=False),
        sa.Column("min_order_value_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_redemptions", sa.Integer(), nullable=True),
        sa.Column("fulfillment_type", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.CheckConstraint("discount_type IN ('percentage', 'flat')", name="offers_discount_type_chk"),
        sa.CheckConstraint("fulfillment_type IS NULL OR fulfillment_type IN ('pickup', 'delivery')", name="offers_fulfillment_type_chk"),
    )
    op.create_index("idx_offers_hospital", "offers", ["hospital_id"])
    op.create_index("ux_offers_hospital_code", "offers", ["hospital_id", "coupon_code"], unique=True)

    op.add_column("food_orders", sa.Column("offer_id", sa.Integer(), sa.ForeignKey("offers.id"), nullable=True))
    op.add_column("food_orders", sa.Column("discount_paise", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("food_orders", "discount_paise")
    op.drop_column("food_orders", "offer_id")
    op.drop_table("offers")
