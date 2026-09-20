"""staff role 'kitchen' (Kitchen Staff)

Revision ID: 0034
Revises: 0033
Create Date: 2026-09-20

Role-based access for restaurants: Owner/Manager (admin), Front of House (receptionist) and
Kitchen Staff (kitchen). 'doctor' stays a valid stored value so any existing row still
resolves, but it is no longer offered."""
from typing import Sequence, Union

from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW = "role IN ('admin', 'receptionist', 'kitchen', 'doctor')"
_OLD = "role IN ('admin', 'receptionist', 'doctor')"


def upgrade() -> None:
    op.drop_constraint("ck_staff_details_role", "staff_details", type_="check")
    op.create_check_constraint("ck_staff_details_role", "staff_details", _NEW)
    op.drop_constraint("ck_role_permissions_role", "role_permissions", type_="check")
    op.create_check_constraint("ck_role_permissions_role", "role_permissions", _NEW)


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions WHERE role = 'kitchen'")
    op.execute("UPDATE staff_details SET role = 'receptionist' WHERE role = 'kitchen'")
    op.drop_constraint("ck_role_permissions_role", "role_permissions", type_="check")
    op.create_check_constraint("ck_role_permissions_role", "role_permissions", _OLD)
    op.drop_constraint("ck_staff_details_role", "staff_details", type_="check")
    op.create_check_constraint("ck_staff_details_role", "staff_details", _OLD)
