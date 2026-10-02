"""tenant-level general settings + the remaining branch_settings fields from the reference schema

Revision ID: 0061
Revises: 0060
Create Date: 2026-10-02

Two groups, both additive with safe defaults/nulls so every real hospital/branch is unaffected:

1. hospitals gains currency/date_format/tax_inclusive_prices/default_tax_rate/branding -- the
   pasted ERP schema's `tenant_settings` table, folded directly onto `hospitals` rather than a
   separate 1:1 table (same "one row per hospital" shape `hospital_settings` already uses for a
   different slice of config -- a brand-new table here would just be another 1:1 join for no
   real benefit). timezone/language/enabled_modules are NOT duplicated -- hospitals.timezone,
   hospitals.default_language and hospitals.enabled_features/admin_capabilities already cover
   that ground.
2. branches gains the `branch_settings` fields not already covered by migration 0055
   (service_charge_pct/delivery_radius_km/min_order_paise/accepts_online/accepts_whatsapp
   already exist): tables_enabled, is_open_override, avg_prep_time_min, delivery_fee_paise. All
   nullable, same "unset = inherit the hospital-wide default" convention every other branch
   override already follows. accepts_pos/kitchen_printer/shipping_origin_pincode are deliberately
   skipped -- no POS or shipping integration exists anywhere in this app to hang them off."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0061"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("currency", sa.Text(), nullable=False, server_default="INR"))
    op.add_column("hospitals", sa.Column("date_format", sa.Text(), nullable=False, server_default="DD/MM/YYYY"))
    op.add_column("hospitals", sa.Column("tax_inclusive_prices", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("hospitals", sa.Column("default_tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0"))
    op.add_column("hospitals", sa.Column("branding", sa.Text(), nullable=False, server_default="{}"))

    op.add_column("branches", sa.Column("tables_enabled", sa.Boolean(), nullable=True))
    op.add_column("branches", sa.Column("is_open_override", sa.Boolean(), nullable=True))
    op.add_column("branches", sa.Column("avg_prep_time_min", sa.Integer(), nullable=True))
    op.add_column("branches", sa.Column("delivery_fee_paise", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("branches", "delivery_fee_paise")
    op.drop_column("branches", "avg_prep_time_min")
    op.drop_column("branches", "is_open_override")
    op.drop_column("branches", "tables_enabled")

    op.drop_column("hospitals", "branding")
    op.drop_column("hospitals", "default_tax_rate")
    op.drop_column("hospitals", "tax_inclusive_prices")
    op.drop_column("hospitals", "date_format")
    op.drop_column("hospitals", "currency")
