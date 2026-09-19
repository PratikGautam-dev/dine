"""menu_items.image_url; food_orders.payment_method + the 'placed' status

Revision ID: 0033
Revises: 0032
Create Date: 2026-09-19

Food-ordering redesign (approved by the user after a read-only report):

- menu_items.image_url: a merchant-pasted link to a dish photo (no upload/
  storage -- deliberately out of scope until there is a real need). Shown as
  the header image of the guest's item card in WhatsApp; NULL = text-only.
- food_orders.payment_method: how the guest settles the order.
  'pay_at_restaurant' (guest confirms, pays in person -- no card details, no
  payment processing) or 'online' (the existing Razorpay Payment Link path).
  Existing rows are all online orders, hence the DEFAULT.
- food_orders.status gains 'placed': a confirmed pay-at-restaurant order that
  is waiting for the kitchen to accept it. It plays the role 'paid' plays for
  an online order (placed -> accepted -> preparing -> ...), and can be
  cancelled from there."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_STATUS_CHECK = (
    "status IN ('cart', 'pending_payment', 'paid', 'accepted', 'preparing', "
    "'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')"
)
_NEW_STATUS_CHECK = (
    "status IN ('cart', 'pending_payment', 'placed', 'paid', 'accepted', 'preparing', "
    "'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled')"
)
_PAYMENT_METHOD_CHECK = "payment_method IN ('pay_at_restaurant', 'online')"


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column(
        "food_orders",
        sa.Column("payment_method", sa.Text(), nullable=False, server_default="online"),
    )
    op.create_check_constraint("food_orders_payment_method_check", "food_orders", _PAYMENT_METHOD_CHECK)
    op.drop_constraint("food_orders_status_check", "food_orders", type_="check")
    op.create_check_constraint("food_orders_status_check", "food_orders", _NEW_STATUS_CHECK)


def downgrade() -> None:
    op.execute("UPDATE food_orders SET status = 'paid' WHERE status = 'placed'")
    op.drop_constraint("food_orders_status_check", "food_orders", type_="check")
    op.create_check_constraint("food_orders_status_check", "food_orders", _OLD_STATUS_CHECK)
    op.drop_constraint("food_orders_payment_method_check", "food_orders", type_="check")
    op.drop_column("food_orders", "payment_method")
    op.drop_column("menu_items", "image_url")
