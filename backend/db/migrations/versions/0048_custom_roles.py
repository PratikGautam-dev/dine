"""custom_roles -- drop the fixed-role CHECK constraints, Staff & Access's "Add Role"

Revision ID: 0048
Revises: 0047
Create Date: 2026-09-27

Roles are no longer a fixed 3-value enum: an Owner/Manager can now create a hospital-scoped
custom role (Staff & Access's "Add Role") with its own permission grid, seeded all-False and
edited from the same matrix the 3 built-in roles use (db/repositories/role_permissions.py's
create_role()). portal.permissions.get_permission_matrix() already grouped by whatever `role`
values it found in role_permissions -- it was never hardcoded to the 3 built-ins -- so the only
things actually stopping a custom role from working were these two CHECK constraints.

Deliberate, documented exception to this file's no-destructive-migrations convention (same
precedent 0034/0035 already set for these exact two constraints, each time to widen the same
fixed list) -- this time DROPPED with no replacement, since the whole point is that the set of
valid roles is no longer something a migration can enumerate."""
from typing import Sequence, Union

from alembic import op

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_ROLE_PERMISSIONS = "role IN ('admin', 'receptionist', 'kitchen')"
_OLD_STAFF_DETAILS = "role IN ('admin', 'receptionist', 'kitchen')"


def upgrade() -> None:
    op.drop_constraint("ck_role_permissions_role", "role_permissions", type_="check")
    op.drop_constraint("ck_staff_details_role", "staff_details", type_="check")


def downgrade() -> None:
    # Only restorable if every row already satisfies the old fixed list -- a hospital that added
    # a real custom role after this migration ran can't cleanly downgrade; that's expected, same
    # as any other "the data itself has moved past what the old schema allowed" migration.
    op.create_check_constraint("ck_role_permissions_role", "role_permissions", _OLD_ROLE_PERMISSIONS)
    op.create_check_constraint("ck_staff_details_role", "staff_details", _OLD_STAFF_DETAILS)
