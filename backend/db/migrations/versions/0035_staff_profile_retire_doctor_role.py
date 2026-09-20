"""staff profile fields + employee ids; retire the legacy 'doctor' login role

Revision ID: 0035
Revises: 0034
Create Date: 2026-09-20

Staff management page: staff_details gains phone, address, department_id (the section a person
works), reports_to_id and a per-restaurant employee_id (EMP-ST-00001, backfilled in creation
order).

The legacy 'doctor' role (a login linked to a bookable table manager) is retired for restaurants:
any such login becomes Front of House, its sessions are revoked (token_version bump), its
permission rows are deleted and the role CHECKs no longer accept it. doctor_id stays as an unused
column."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW = "role IN ('admin', 'receptionist', 'kitchen')"
_OLD = "role IN ('admin', 'receptionist', 'kitchen', 'doctor')"


def upgrade() -> None:
    op.add_column("staff_details", sa.Column("phone", sa.Text(), nullable=True))
    op.add_column("staff_details", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("staff_details", sa.Column("department_id", sa.Text(), sa.ForeignKey("departments.id"), nullable=True))
    op.add_column("staff_details", sa.Column("reports_to_id", sa.Integer(), sa.ForeignKey("identities.id"), nullable=True))
    op.add_column("staff_details", sa.Column("employee_id", sa.Text(), nullable=True))
    op.execute(
        "UPDATE staff_details s SET employee_id = 'EMP-ST-' || lpad(n.rn::text, 5, '0') "
        "FROM (SELECT identity_id, row_number() OVER (PARTITION BY hospital_id ORDER BY identity_id) AS rn "
        "FROM staff_details) n WHERE n.identity_id = s.identity_id"
    )
    op.execute(
        "CREATE UNIQUE INDEX ux_staff_details_employee_id ON staff_details(hospital_id, employee_id) "
        "WHERE employee_id IS NOT NULL"
    )

    op.execute("UPDATE identities SET token_version = token_version + 1 WHERE id IN (SELECT identity_id FROM staff_details WHERE role = 'doctor')")
    op.execute("UPDATE staff_details SET role = 'receptionist', doctor_id = NULL WHERE role = 'doctor'")
    op.execute("DELETE FROM role_permissions WHERE role = 'doctor'")
    op.drop_constraint("ck_staff_details_role", "staff_details", type_="check")
    op.create_check_constraint("ck_staff_details_role", "staff_details", _NEW)
    op.drop_constraint("ck_role_permissions_role", "role_permissions", type_="check")
    op.create_check_constraint("ck_role_permissions_role", "role_permissions", _NEW)


def downgrade() -> None:
    op.drop_constraint("ck_role_permissions_role", "role_permissions", type_="check")
    op.create_check_constraint("ck_role_permissions_role", "role_permissions", _OLD)
    op.drop_constraint("ck_staff_details_role", "staff_details", type_="check")
    op.create_check_constraint("ck_staff_details_role", "staff_details", _OLD)
    op.execute("DROP INDEX IF EXISTS ux_staff_details_employee_id")
    for col in ("employee_id", "reports_to_id", "department_id", "address", "phone"):
        op.drop_column("staff_details", col)
