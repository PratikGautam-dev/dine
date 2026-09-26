# db/repositories/role_permissions.py
"""Per-(hospital, role, page) permission grid (docs/rbac-redis-plan.md) --
one row per cell, not a JSON blob, since portal/permissions.py's
get_permission_matrix() reads this on every permission check (Redis-cached
by portal/permission_cache.py, so the row-per-cell shape isn't a per-request
cost in practice) and the Roles & Permissions admin UI edits it cell-by-cell
via PUT /api/portal/roles/permissions."""
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.connection import get_session
from db.orm_models import RolePermission

_PERMISSION_COLUMNS = (
    RolePermission.role, RolePermission.page_key,
    RolePermission.can_view, RolePermission.can_write, RolePermission.can_delete,
)


def get_role_permissions(hospital_id: int) -> list[dict]:
    """Every row this hospital has, across every role -- callers
    (portal/permissions.py's get_permission_matrix(), the roles route's GET)
    group by role themselves; an empty list means this hospital has never
    had its defaults seeded (a hospital that predates this feature), which
    the caller falls back to DEFAULT_PERMISSIONS_BY_ROLE for, not an error."""
    session = get_session()
    rows = session.execute(
        select(*_PERMISSION_COLUMNS).where(RolePermission.hospital_id == hospital_id)
    ).all()
    return [dict(r._mapping) for r in rows]


def seed_default_role_permissions(hospital_id: int, rows: list[dict]) -> None:
    """Onboarding's explicit-write step (submit_onboarding() calls this right
    after db.create_hospital()) -- `rows` is a flat list of
    {role, page_key, can_view, can_write, can_delete} dicts, built by the
    caller from portal.permissions.DEFAULT_PERMISSIONS_BY_ROLE via
    resolve_default_permissions() for each role, same "write it now, don't
    rely on a runtime fallback" discipline resolve_default_capabilities()
    already established for admin_capabilities. ON CONFLICT DO NOTHING makes
    this safe to call at most once per hospital without double-seeding if a
    caller ever retries; a brand-new hospital_id can never already have rows,
    so there's nothing to overwrite."""
    if not rows:
        return
    session = get_session()
    session.execute(
        insert(RolePermission).values([{**row, "hospital_id": hospital_id} for row in rows])
    )
    session.commit()


def create_role(hospital_id: int, role_key: str, page_keys: list[str]) -> None:
    """Staff & Access's "Add Role" -- seeds a full, real all-False permission grid (one row per
    page) for a brand-new custom role, same shape seed_default_role_permissions() gives the 3
    built-in roles at onboarding, just triggered by an admin instead of the onboarding wizard.
    Once these rows exist, portal.permissions.get_permission_matrix() picks the role up
    automatically (it groups by whatever `role` values it finds, not a fixed list) -- there's
    nothing else to "register" a role. ON CONFLICT DO NOTHING makes a duplicate call (a retried
    request) a safe no-op; the caller (the roles route) already checks for a name collision
    up front and returns a clear 409 before ever reaching here."""
    if not page_keys:
        return
    session = get_session()
    stmt = pg_insert(RolePermission).values([
        {"hospital_id": hospital_id, "role": role_key, "page_key": page, "can_view": False, "can_write": False, "can_delete": False}
        for page in page_keys
    ])
    stmt = stmt.on_conflict_do_nothing(index_elements=[RolePermission.hospital_id, RolePermission.role, RolePermission.page_key])
    session.execute(stmt)
    session.commit()


def upsert_role_permissions(hospital_id: int, updates: list[dict]) -> None:
    """PUT /api/portal/roles/permissions's write path -- `updates` is a list
    of {role, page_key, can_view, can_write, can_delete} dicts for the cells
    an admin just changed (not necessarily the full matrix). One
    INSERT ... ON CONFLICT (hospital_id, role, page_key) DO UPDATE per call
    (a single multi-row statement, not one round-trip per cell) covers both
    "this hospital already has a row for this cell" (the normal case, since
    onboarding seeds every cell) and "this hospital predates seeding and has
    no row yet" (first edit for that cell creates it) without the caller
    needing to know which case applies."""
    if not updates:
        return
    session = get_session()
    stmt = pg_insert(RolePermission).values(
        [{**row, "hospital_id": hospital_id} for row in updates]
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[RolePermission.hospital_id, RolePermission.role, RolePermission.page_key],
        set_={
            "can_view": stmt.excluded.can_view,
            "can_write": stmt.excluded.can_write,
            "can_delete": stmt.excluded.can_delete,
        },
    )
    session.execute(stmt)
    session.commit()
