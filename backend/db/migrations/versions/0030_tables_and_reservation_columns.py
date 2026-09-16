"""tables + table_leave, restaurant operating-hours/turnover settings, appointments gains table_id/party_size/turnover_minutes

Revision ID: 0030
Revises: 0029
Create Date: 2026-09-15

Stage 4 (table-availability logic, ARCHITECTURE_REFERENCE_FOR_FORKING.md
Section 4/7) -- Stage 1 of 4: data model + migration only, no availability
logic or WhatsApp flow yet (those are Stage 2/3, confirmed with the user
before starting).

`tables` is a single-pool resource, unlike `procedure_resources`' multi-type
pool -- a table reservation only ever needs ONE free table, not several
resource TYPES simultaneously. Deliberately no per-table working_days/
working_hours/slot_duration_minutes columns (unlike doctors/
procedure_resources): confirmed with the user that restaurant operating
hours are shared across every table, not scheduled per-table, so they live
once on `hospital_settings` (default_turnover_minutes/booking_interval_minutes/
operating_days/operating_hours) instead of being duplicated onto every table
row. Per-table exceptions (closed for maintenance, reserved for a private
buyout) are still real, so `table_leave` mirrors `procedure_resource_leave`
for that one-off case. No `max_bookings_per_slot` column either -- a table
holds exactly one party at a time, unlike a doctor/procedure resource that
can optionally see >1 concurrent booking.

Availability is computed on the fly (confirmed with the user), not via a
pre-generated grid table like `procedure_resource_slots` -- procedure
resources need that because each one's schedule varies independently and
needs its own leave-day exclusion baked into which grid rows exist; table
hours are shared and simple, so candidate start-times are derived directly
from hospital_settings.operating_hours/operating_days at read time, with no
staleness/regeneration concern and no per-table grid storage.

appointments.table_id/party_size/turnover_minutes are nullable, same
"only one of doctor_id/resource_id/procedure_id/table_id is ever set"
discipline the existing doctor_or_resource_or_procedure check constraint
already enforces -- extended here to include table_id. turnover_minutes is
stamped onto the row AT BOOKING TIME (not dynamically read from
hospital_settings.default_turnover_minutes on every read), so a later change
to the restaurant's default doesn't retroactively reinterpret an
already-booked reservation's duration -- same precedent
procedure_estimated_price_min/max already set on this same table.

Also deactivates every appointment_types row except 'new' (Table
Reservation) for every hospital -- a real, live gap found while building
this: `_backfill_appointment_types()` is purely additive (INSERT ... WHERE
NOT EXISTS), so it never deactivates a type that's since been dropped from
the catalog, or one whose DEFAULT_ACTIVE_TYPES_BY_TENANT_TYPE default later
changed. Confirmed against actual local Postgres data:
`second_opinion`/`daycare`/`diagnostic`/`lab`/`tele` were all still
`is_active = true` from before the Stage 1 fork cleanup deleted their flow
code entirely. `followup` and `procedure` are also deactivated here (no
restaurant-tenant equivalent to a medical follow-up visit; procedure has no
real Dine Connect content yet, kept only as flows/booking/types/
procedure.py's resource-pool CODE TEMPLATE) per the same Stage 4 design
discussion -- rows are kept, not deleted, preserving FK
integrity for any historical appointment still referencing that type id."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tables",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("department_id", sa.Text(), sa.ForeignKey("departments.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_check_constraint("tables_capacity_check", "tables", "capacity > 0")

    op.create_table(
        "table_leave",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("table_id", sa.Text(), sa.ForeignKey("tables.id"), nullable=False),
        sa.Column("date", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.UniqueConstraint("table_id", "date"),
    )

    op.add_column("hospital_settings", sa.Column("operating_days", sa.Text(), nullable=True))
    op.add_column("hospital_settings", sa.Column("operating_hours", sa.Text(), nullable=True))
    op.add_column(
        "hospital_settings",
        sa.Column("default_turnover_minutes", sa.Integer(), nullable=False, server_default="90"),
    )
    op.add_column(
        "hospital_settings",
        sa.Column("booking_interval_minutes", sa.Integer(), nullable=False, server_default="30"),
    )
    op.create_check_constraint(
        "hospital_settings_default_turnover_minutes_check", "hospital_settings", "default_turnover_minutes > 0",
    )
    op.create_check_constraint(
        "hospital_settings_booking_interval_minutes_check", "hospital_settings", "booking_interval_minutes > 0",
    )

    op.add_column("appointments", sa.Column("table_id", sa.Text(), sa.ForeignKey("tables.id"), nullable=True))
    op.add_column("appointments", sa.Column("party_size", sa.Integer(), nullable=True))
    op.add_column("appointments", sa.Column("turnover_minutes", sa.Integer(), nullable=True))

    op.drop_constraint("appointments_doctor_or_resource_or_procedure_chk", "appointments", type_="check")
    op.create_check_constraint(
        "appointments_doctor_or_resource_or_procedure_or_table_chk", "appointments",
        "doctor_id IS NOT NULL OR resource_id IS NOT NULL OR procedure_id IS NOT NULL OR table_id IS NOT NULL",
    )

    op.execute("UPDATE appointment_types SET is_active = FALSE WHERE id <> 'new'")


def downgrade() -> None:
    # The appointment_types is_active data change is deliberately NOT
    # reversed -- same "data cleanup, not tracked for rollback" precedent as
    # every other DML-only line in this migration history; the schema
    # changes below are fully reversible, the stale-type deactivation is not
    # worth re-activating on a downgrade.
    op.drop_constraint("appointments_doctor_or_resource_or_procedure_or_table_chk", "appointments", type_="check")
    op.create_check_constraint(
        "appointments_doctor_or_resource_or_procedure_chk", "appointments",
        "doctor_id IS NOT NULL OR resource_id IS NOT NULL OR procedure_id IS NOT NULL",
    )

    op.drop_column("appointments", "turnover_minutes")
    op.drop_column("appointments", "party_size")
    op.drop_column("appointments", "table_id")

    op.drop_constraint("hospital_settings_booking_interval_minutes_check", "hospital_settings", type_="check")
    op.drop_constraint("hospital_settings_default_turnover_minutes_check", "hospital_settings", type_="check")
    op.drop_column("hospital_settings", "booking_interval_minutes")
    op.drop_column("hospital_settings", "default_turnover_minutes")
    op.drop_column("hospital_settings", "operating_hours")
    op.drop_column("hospital_settings", "operating_days")

    op.drop_table("table_leave")

    op.drop_constraint("tables_capacity_check", "tables", type_="check")
    op.drop_table("tables")
