"""branches: operational settings overrides (service charge, delivery radius, per-branch minimum
order, per-channel accept flags)

Revision ID: 0055
Revises: 0054
Create Date: 2026-10-01

All nullable -- NULL means "inherit the hospital-wide default", same override convention
operating_days/operating_hours/turnover_minutes/booking_interval_minutes already established on
this table (migration 0053). No backfill needed: every existing branch simply inherits today's
behavior (no service charge, no delivery radius limit, no per-branch minimum, both channels
accepted) until a restaurant explicitly sets an override on a specific branch."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0055"
down_revision: Union[str, None] = "0054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("branches", sa.Column("service_charge_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("branches", sa.Column("delivery_radius_km", sa.Numeric(6, 2), nullable=True))
    op.add_column("branches", sa.Column("min_order_paise", sa.Integer(), nullable=True))
    op.add_column("branches", sa.Column("accepts_online", sa.Boolean(), nullable=True))
    op.add_column("branches", sa.Column("accepts_whatsapp", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("branches", "accepts_whatsapp")
    op.drop_column("branches", "accepts_online")
    op.drop_column("branches", "min_order_paise")
    op.drop_column("branches", "delivery_radius_km")
    op.drop_column("branches", "service_charge_pct")
