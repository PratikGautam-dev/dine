"""appointments gain special_request; hospitals gain an opt-in booking-confirmation setting

Revision ID: 0040
Revises: 0039
Create Date: 2026-09-23

Table Bookings follow-up. Two independent, additive changes:
  - appointments.special_request: a free-text note (e.g. "birthday", "window seat"), settable at
    booking time, NULL when the guest/staff didn't give one -- never backfilled.
  - hospital_settings.require_booking_confirmation: opt-in, default false. Off (every existing
    hospital, unless they turn it on) is byte-for-byte today's behavior -- WhatsApp bookings land
    'booked' immediately. On, a WhatsApp booking lands 'pending' until staff confirm it. The
    appointments.status CHECK constraint gains 'pending' to allow the new value at all; staff-created
    bookings never use it (see portal/routes/bookings.py)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("special_request", sa.Text(), nullable=True))
    op.add_column(
        "hospital_settings",
        sa.Column("require_booking_confirmation", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.drop_constraint("appointments_status_check", "appointments", type_="check")
    op.create_check_constraint(
        "appointments_status_check", "appointments",
        "status IN ('booked', 'cancelled', 'rescheduled', 'attended', 'no_show', 'pending')",
    )


def downgrade() -> None:
    op.drop_constraint("appointments_status_check", "appointments", type_="check")
    op.create_check_constraint(
        "appointments_status_check", "appointments",
        "status IN ('booked', 'cancelled', 'rescheduled', 'attended', 'no_show')",
    )
    op.drop_column("hospital_settings", "require_booking_confirmation")
    op.drop_column("appointments", "special_request")
