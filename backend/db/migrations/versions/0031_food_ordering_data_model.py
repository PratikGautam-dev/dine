"""food ordering: menu_items, food_orders, food_order_items, hospitals gains razorpay credential columns, reference_id_counters gains a prefix dimension

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-16

Food ordering plan (reported to and approved by the user before this was
written) -- Sub-stage 1 of 4: data model + migration only, no order/cart
logic, WhatsApp flow, or portal UI yet (those are Sub-stages 2/3/4).

reference_id_counters widened from (hospital_id, day) to (hospital_id, day,
prefix): food_orders needs its OWN daily per-hospital sequence (ORD-<DDMMYY>-
<NNN>), completely independent of appointments' APT-<DDMMYY>-<NNN> sequence
-- confirmed with the user that a reservation confirmation number and a food
order confirmation number must never collide or be confusable. Reusing the
existing table (same atomic INSERT ... ON CONFLICT DO UPDATE counter
mechanism db/display_ids.py's _next_daily_reference_sequence() already
establishes) rather than adding a second counters table, since the only
thing that actually needs to change is which axis the counter is keyed on.
Existing APT rows are backfilled with prefix='APT' so the existing
appointment numbering continues exactly where it left off, under its own
now-explicit key.

menu_items/food_orders/food_order_items are new tables, not a repurposing of
appointments -- a food order isn't a resource-pool booking (no doctor/table/
procedure slot is being reserved), so it doesn't belong in the
doctor_or_resource_or_procedure_or_table_chk family at all. menu_items.id
follows the same "h{hospital_id}_{uuid8}" opaque TEXT id convention
create_table()/create_department() already use (db/repositories/tables.py);
food_orders/food_order_items use SERIAL ids like appointments, since a food
order is a real transactional row created once and never re-keyed, same as
an appointment.

food_order_items snapshots item_name/unit_price_paise at order time (not a
live FK-only read of menu_items) so editing a menu item's name/price later
never retroactively changes what an already-placed order shows or was
charged -- same "don't reinterpret a historical booking" precedent
appointments.turnover_minutes established in migration 0030 for
hospital_settings.default_turnover_minutes.

food_orders.status is a plain TEXT + CHECK constraint enum (cart ->
pending_payment -> paid -> accepted -> preparing -> ready_for_pickup |
out_for_delivery -> completed, or cancelled from cart/pending_payment/
accepted/preparing) -- kitchen-facing states beyond the reference
architecture doc's browsing/pending_payment/paid/fulfilled, confirmed with
the user. Every transition (Sub-stage 2) will use a guarded
UPDATE ... WHERE status = '<required-prior-state>' (rowcount-checked), not
this repo's existing advisory-lock pattern -- there's no shared resource
pool being contended over here (stock is a per-row atomic decrement, not a
scarce time-slot), so the lock pattern doesn't apply. Flagged in Spec.md as
a pattern worth eventually retrofitting onto cancel_appointment() and
similar for consistency, not done now.

razorpay_key_id/razorpay_key_secret_ref/razorpay_webhook_secret_ref on
hospitals extend the exact same per-tenant credential-storage shape
whatsapp_phone_number_id/meta_access_token_ref/app_secret_ref already use --
"_ref" suffix on the two secret-bearing columns is deliberate, matching
meta_access_token_ref/app_secret_ref's own naming (a reference/secret-store
key, not the raw secret, per this repo's existing convention)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STATUS_CHECK = (
    "status IN ('cart', 'pending_payment', 'paid', 'accepted', 'preparing', "
    "'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')"
)
_FULFILLMENT_CHECK = "fulfillment_type IN ('pickup', 'delivery')"


def upgrade() -> None:
    # --- reference_id_counters: add the prefix dimension ---
    op.add_column("reference_id_counters", sa.Column("prefix", sa.Text(), nullable=True))
    op.execute("UPDATE reference_id_counters SET prefix = 'APT' WHERE prefix IS NULL")
    op.alter_column("reference_id_counters", "prefix", nullable=False)
    op.drop_constraint("reference_id_counters_pkey", "reference_id_counters", type_="primary")
    op.create_primary_key(
        "reference_id_counters_pkey", "reference_id_counters", ["hospital_id", "day", "prefix"],
    )

    # --- hospitals: Razorpay per-tenant credentials ---
    op.add_column("hospitals", sa.Column("razorpay_key_id", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("razorpay_key_secret_ref", sa.Text(), nullable=True))
    op.add_column("hospitals", sa.Column("razorpay_webhook_secret_ref", sa.Text(), nullable=True))

    # --- menu_items ---
    op.create_table(
        "menu_items",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_paise", sa.Integer(), nullable=False),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("stock_count", sa.Integer(), nullable=True),
        # TEXT (ISO-8601), same DEFAULT (now()::text) shape every other
        # table's own created_at/updated_at column already uses
        # (db/migrations/versions/0001_baseline_schema.py) -- matches
        # db/orm_models.py's own header comment: "schema is stored as
        # ISO-8601 TEXT." A real DateTime(timezone=True) column here was an
        # oversight (caught via a live 500 -- json.dumps() can't serialize a
        # raw datetime object -- while visually verifying Sub-stage 4's
        # portal pages), corrected before this migration ever shipped.
        sa.Column("created_at", sa.Text(), server_default=sa.text("(now()::text)"), nullable=False),
        sa.Column("updated_at", sa.Text(), server_default=sa.text("(now()::text)"), nullable=False),
    )
    op.create_check_constraint("menu_items_price_paise_check", "menu_items", "price_paise >= 0")
    op.create_check_constraint(
        "menu_items_stock_count_check", "menu_items", "stock_count IS NULL OR stock_count >= 0",
    )

    # --- food_orders ---
    op.create_table(
        "food_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=True),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="cart"),
        sa.Column("fulfillment_type", sa.Text(), nullable=True),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("subtotal_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivery_fee_paise", sa.Integer(), nullable=True),
        sa.Column("total_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("razorpay_order_id", sa.Text(), nullable=True),
        sa.Column("razorpay_payment_id", sa.Text(), nullable=True),
        sa.Column("reference_id", sa.Text(), nullable=True),
        # TEXT (ISO-8601), same correction as menu_items' own created_at/
        # updated_at above -- see that column's comment for why.
        sa.Column("created_at", sa.Text(), server_default=sa.text("(now()::text)"), nullable=False),
        sa.Column("updated_at", sa.Text(), server_default=sa.text("(now()::text)"), nullable=False),
    )
    op.create_check_constraint("food_orders_status_check", "food_orders", _STATUS_CHECK)
    op.create_check_constraint("food_orders_fulfillment_type_check", "food_orders", _FULFILLMENT_CHECK)

    # --- food_order_items ---
    op.create_table(
        "food_order_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("food_orders.id"), nullable=False),
        sa.Column("menu_item_id", sa.Text(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("item_name_snapshot", sa.Text(), nullable=False),
        sa.Column("unit_price_paise_snapshot", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
    )
    op.create_check_constraint("food_order_items_quantity_check", "food_order_items", "quantity > 0")


def downgrade() -> None:
    op.drop_constraint("food_order_items_quantity_check", "food_order_items", type_="check")
    op.drop_table("food_order_items")

    op.drop_constraint("food_orders_fulfillment_type_check", "food_orders", type_="check")
    op.drop_constraint("food_orders_status_check", "food_orders", type_="check")
    op.drop_table("food_orders")

    op.drop_constraint("menu_items_stock_count_check", "menu_items", type_="check")
    op.drop_constraint("menu_items_price_paise_check", "menu_items", type_="check")
    op.drop_table("menu_items")

    op.drop_column("hospitals", "razorpay_webhook_secret_ref")
    op.drop_column("hospitals", "razorpay_key_secret_ref")
    op.drop_column("hospitals", "razorpay_key_id")

    op.drop_constraint("reference_id_counters_pkey", "reference_id_counters", type_="primary")
    op.create_primary_key("reference_id_counters_pkey", "reference_id_counters", ["hospital_id", "day"])
    op.drop_column("reference_id_counters", "prefix")
