"""team_access_merge -- drop the retired ck_staff_details_doctor_role_pairing constraint

Revision ID: 0050
Revises: 0049
Create Date: 2026-09-27

staff_details.doctor_id is being repurposed (Team & Access merge): it now optionally links ANY
staff login to the `doctors`/roster row it was granted portal access from, not just a (long-retired)
role='doctor' login. The CHECK this migration drops -- `(role = 'doctor') = (doctor_id IS NOT
NULL)`, added in migration 0016 -- made that impossible: 'doctor' hasn't been a valid `role` value
since migration 0035 retired it, so the constraint pinned doctor_id permanently NULL. Dropped
outright, no replacement -- same "the old fixed rule no longer reflects reality" precedent 0034/
0035/0048 already set. ux_staff_details_doctor_id (the partial unique index -- one login per roster
row) is untouched and still exactly what the new feature wants."""
from typing import Sequence, Union

from alembic import op

revision: str = "0050"
down_revision: Union[str, None] = "0049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_staff_details_doctor_role_pairing", "staff_details", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "ck_staff_details_doctor_role_pairing", "staff_details", "(role = 'doctor') = (doctor_id IS NOT NULL)",
    )
