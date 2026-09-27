"""web_storefront -- a second ordering channel alongside the WhatsApp bot

Revision ID: 0051
Revises: 0050
Create Date: 2026-09-27

A public marketplace website (/order) is a second front door into the SAME food_orders/menu_items
data the WhatsApp bot already uses -- no parallel order/menu/customer system. This migration adds:
the per-restaurant storefront profile (hospitals), food_orders.source (which channel an order came
through) + mock_payment_ref (the mock payment gateway's own reference, standing in for a real
Razorpay one), and customer_otps (the web storefront's own mock-SMS OTP login -- a customer login
system entirely separate from staff/admin auth)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0051"
down_revision: Union[str, None] = "0050"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("web_ordering_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("hospitals", sa.Column("storefront_slug", sa.Text(), nullable=True))
    op.create_index(
        "ux_hospitals_storefront_slug", "hospitals", ["storefront_slug"], unique=True,
        postgresql_where=sa.text("storefront_slug IS NOT NULL"),
    )
    op.add_column("hospitals", sa.Column("cuisine_tags", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("tagline", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("address_line", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("city", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("logo_url", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("cover_image_url", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("min_order_paise", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("hospitals", sa.Column("avg_prep_minutes", sa.Integer(), nullable=False, server_default="30"))

    op.add_column("food_orders", sa.Column("source", sa.Text(), nullable=False, server_default="whatsapp"))
    op.create_check_constraint("food_orders_source_chk", "food_orders", "source IN ('whatsapp', 'web')")
    op.add_column("food_orders", sa.Column("mock_payment_ref", sa.Text(), nullable=True))

    op.create_table(
        "customer_otps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consumed_at", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_customer_otps_phone_created", "customer_otps", ["phone", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_customer_otps_phone_created", table_name="customer_otps")
    op.drop_table("customer_otps")
    op.drop_column("food_orders", "mock_payment_ref")
    op.drop_constraint("food_orders_source_chk", "food_orders", type_="check")
    op.drop_column("food_orders", "source")
    op.drop_column("hospitals", "avg_prep_minutes")
    op.drop_column("hospitals", "min_order_paise")
    op.drop_column("hospitals", "cover_image_url")
    op.drop_column("hospitals", "logo_url")
    op.drop_column("hospitals", "city")
    op.drop_column("hospitals", "address_line")
    op.drop_column("hospitals", "tagline")
    op.drop_column("hospitals", "cuisine_tags")
    op.drop_index("ux_hospitals_storefront_slug", table_name="hospitals")
    op.drop_column("hospitals", "storefront_slug")
    op.drop_column("hospitals", "web_ordering_enabled")
