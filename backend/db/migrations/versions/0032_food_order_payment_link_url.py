"""food_orders gains razorpay_payment_link_url

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-16

Food ordering plan, Sub-stage 3 (WhatsApp flow states) -- a small, real gap
found while wiring the flow, not planned in Sub-stage 1: Sub-stage 2's
Razorpay integration was corrected from the Orders API (client-side
Checkout.js, no standalone URL) to the Payment Links API (a hosted page URL,
the actual right fit for a WhatsApp-text delivery mechanism) -- see
modules/payments/razorpay_client.py's create_payment_link() docstring for
the full reasoning. create_razorpay_payment() is idempotent (a second call
for the same order returns the EXISTING link rather than minting a second
one), which means the link itself needs to be persisted, not just the
Razorpay-side id -- otherwise a retried WhatsApp send (e.g. after a
transient failure) would have no way to resend the same link without an
extra Razorpay API round-trip. Same "small addition surfaced by real
integration work, added at the point of need" precedent
appointments.updated_at's own migration note gives (Section 12.7/12.8's
dashboard activity feed)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("food_orders", sa.Column("razorpay_payment_link_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("food_orders", "razorpay_payment_link_url")
