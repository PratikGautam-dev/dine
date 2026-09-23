"""customer_profile_fields -- Customers page (mockup-driven) demo profile fields

Revision ID: 0044
Revises: 0043
Create Date: 2026-09-23

Adds the extra guest-profile fields the redesigned Customers page shows (email, loyalty tier/points,
dietary preference, allergies, favorite item, notes, lifetime order/spend totals). These are seeded
with demo data for every guest except the one real phone number already in the database -- the app
itself never writes loyalty_tier/loyalty_points/total_orders/total_spend_paise/favorite_item (no
loyalty program or spend tracking exists yet); notes/dietary_preference/allergies/email are staff-
editable free text, same pattern as the existing address/gender/date_of_birth fields."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("email", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("dietary_preference", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("allergies", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("favorite_item", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("loyalty_tier", sa.Text(), nullable=True))
    op.add_column("patients", sa.Column("loyalty_points", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("patients", sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("patients", sa.Column("total_spend_paise", sa.BigInteger(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("patients", "total_spend_paise")
    op.drop_column("patients", "total_orders")
    op.drop_column("patients", "loyalty_points")
    op.drop_column("patients", "loyalty_tier")
    op.drop_column("patients", "favorite_item")
    op.drop_column("patients", "notes")
    op.drop_column("patients", "allergies")
    op.drop_column("patients", "dietary_preference")
    op.drop_column("patients", "email")
