# db/repositories/staff_users.py
"""Unified per-person staff login -- Owner/Manager, Front of House, Kitchen Staff; one login
per human being (docs/rbac-redis-plan.md). Split out as its own repository
file, following the doctors.py/hospitals.py precedent, rather than folded
into either -- this table is read by the auth layer (portal/deps.py) on
every authenticated request, not just doctor- or hospital-management routes.

Migration 0016: reads/writes db.orm_models.Identity + StaffDetail now, not
the historical StaffUser table (kept, untouched, as a backup -- see that
migration's own docstring). Every function here keeps the exact same name
and dict shape ({id, hospital_id, role, email, password_hash, name,
doctor_id, is_active, token_version}) callers already expect -- only the
underlying tables changed. "id" here is identities.id."""
from typing import cast

import sqlalchemy.exc
from sqlalchemy import Integer, func, insert, or_, select, text, update
from sqlalchemy import cast as sql_cast
from sqlalchemy.orm import aliased
from sqlalchemy.engine import CursorResult

from db.connection import get_session, reraise_as_driver_integrity_error
from db.orm_models import Department, DoctorRow, HospitalRow, Identity, StaffDetail

_STAFF_COLUMNS = (
    Identity.id, StaffDetail.hospital_id, StaffDetail.role, Identity.email, Identity.password_hash,
    Identity.name, StaffDetail.doctor_id, Identity.is_active, Identity.token_version,
    StaffDetail.phone, StaffDetail.address, StaffDetail.department_id, StaffDetail.reports_to_id,
    StaffDetail.employee_id,
)

_EMPLOYEE_ID_PREFIX = "EMP-ST-"
_EMPLOYEE_ID_LOCK_NAMESPACE = 4711  # pg_advisory_xact_lock(namespace, hospital_id)


def _next_employee_id(session, hospital_id: int) -> str:
    """EMP-ST-00001, 00002, ... per restaurant. Taken under a per-restaurant advisory lock (held
    until the surrounding transaction commits) so two staff created at once can't get the same
    number; the unique index is the backstop."""
    session.execute(text("SELECT pg_advisory_xact_lock(:ns, :hid)"), {"ns": _EMPLOYEE_ID_LOCK_NAMESPACE, "hid": hospital_id})
    highest = session.execute(
        select(func.coalesce(func.max(sql_cast(func.substr(StaffDetail.employee_id, len(_EMPLOYEE_ID_PREFIX) + 1), Integer)), 0))
        .where(StaffDetail.hospital_id == hospital_id, StaffDetail.employee_id.like(f"{_EMPLOYEE_ID_PREFIX}%"))
    ).scalar_one()
    return f"{_EMPLOYEE_ID_PREFIX}{highest + 1:05d}"


def create_staff_user(
    hospital_id: int, role: str, email: str, password_hash: str, name: str, doctor_id: str | None = None,
    phone: str | None = None, address: str | None = None, department_id: str | None = None,
    reports_to_id: int | None = None,
) -> dict:
    """Raises db.connection.IntegrityError (via reraise_as_driver_integrity_error) if email is
    already taken by ANY identity (ux_identities_email is global -- shared across restaurant
    staff, OAuth owners and super admins, per the "no hospital selector at login" decision).
    Two inserts in one transaction: the Identity row (the credential), then the StaffDetail row
    (restaurant, role and profile) that actually makes it a staff login; the new person is given
    the restaurant's next employee id (EMP-ST-00001...). `doctor_id` is legacy and ignored by the
    portal now (the linked-doctor login role is retired). The CALLER is responsible for checking
    that department_id / reports_to_id belong to this restaurant."""
    session = get_session()
    try:
        new_id = session.execute(
            insert(Identity).values(email=email, password_hash=password_hash, name=name).returning(Identity.id)
        ).scalar_one()
        session.execute(
            insert(StaffDetail).values(
                identity_id=new_id, hospital_id=hospital_id, role=role, doctor_id=doctor_id, phone=phone,
                address=address, department_id=department_id, reports_to_id=reports_to_id,
                employee_id=_next_employee_id(session, hospital_id),
            )
        )
        session.commit()
    except sqlalchemy.exc.IntegrityError as e:
        session.rollback()
        reraise_as_driver_integrity_error(e)
    return get_staff_user_by_id(new_id)  # type: ignore[return-value]


def get_staff_user_by_email(email: str) -> dict | None:
    """Login lookup -- email is matched case-insensitively via lower(email)
    (an exact match against ux_identities_email's own index expression, not
    ilike -- ilike would treat stray '%'/'_' characters in a submitted email
    as wildcards) since staff will type it with whatever casing they happen
    to use. Returns an inactive staff row too (unlike doctors.py's
    find_doctor_by_email(), which excludes inactive doctors at the query
    level) -- the caller (staff login route) needs to distinguish "wrong
    password" from "account deactivated" for a clearer error, not have both
    collapse into the same generic lookup-failed 401. The JOIN to
    StaffDetail is what makes this "get a staff login by email" rather than
    "get any identity by email" -- an OAuth hospital owner or super admin
    sharing that email (see migration 0016's merge-by-email note) never
    matches here."""
    session = get_session()
    row = session.execute(
        select(*_STAFF_COLUMNS)
        .join(StaffDetail, StaffDetail.identity_id == Identity.id)
        .where(func.lower(Identity.email) == email.lower())
    ).first()
    return dict(row._mapping) if row is not None else None


def get_staff_user_by_id(staff_id: int) -> dict | None:
    """The re-check portal/deps.py's get_current_staff() does on every
    request (token_version/is_active can't be trusted from the JWT claims
    alone -- both can change after the token was issued)."""
    session = get_session()
    row = session.execute(
        select(*_STAFF_COLUMNS)
        .join(StaffDetail, StaffDetail.identity_id == Identity.id)
        .where(Identity.id == staff_id)
    ).first()
    return dict(row._mapping) if row is not None else None


def list_staff_users_for_hospital(hospital_id: int) -> list[dict]:
    """Staff management page's list view, scoped to one restaurant, with the section name and the
    name of the person each one reports to."""
    session = get_session()
    manager = aliased(Identity)
    rows = session.execute(
        select(*_STAFF_COLUMNS, Department.name.label("department_name"), manager.name.label("reports_to_name"))
        .join(StaffDetail, StaffDetail.identity_id == Identity.id)
        .outerjoin(Department, Department.id == StaffDetail.department_id)
        .outerjoin(manager, manager.id == StaffDetail.reports_to_id)
        .where(StaffDetail.hospital_id == hospital_id)
        .order_by(Identity.name)
    ).all()
    return [dict(r._mapping) for r in rows]


def update_staff_profile(hospital_id: int, staff_id: int, fields: dict) -> bool:
    """Sets any of name / phone / address / department_id / reports_to_id for one staff member OF
    THIS RESTAURANT (the WHERE requires the matching hospital_id, so a caller can never edit another
    restaurant's staff even with a wrong id). Only the keys present in `fields` are written, so a
    key mapped to None clears that value. Returns False when there is no such staff member here."""
    session = get_session()
    detail_values = {k: v for k, v in fields.items() if k in ("phone", "address", "department_id", "reports_to_id")}
    exists = session.execute(
        select(StaffDetail.identity_id).where(StaffDetail.identity_id == staff_id, StaffDetail.hospital_id == hospital_id)
    ).first()
    if exists is None:
        return False
    if detail_values:
        session.execute(
            update(StaffDetail).where(StaffDetail.identity_id == staff_id, StaffDetail.hospital_id == hospital_id).values(**detail_values)
        )
    if "name" in fields:
        session.execute(update(Identity).where(Identity.id == staff_id).values(name=fields["name"]))
    session.commit()
    return True


def count_active_admins(hospital_id: int) -> int:
    session = get_session()
    return session.execute(
        select(func.count()).select_from(StaffDetail)
        .join(Identity, Identity.id == StaffDetail.identity_id)
        .where(StaffDetail.hospital_id == hospital_id, StaffDetail.role == "admin", Identity.is_active.is_(True))
    ).scalar_one()


def list_all_staff_users(
    hospital_id: int | None = None, role: str | None = None, is_active: bool | None = None,
    search: str | None = None,
) -> list[dict]:
    """Cross-tenant staff view for the platform admin's /admin/users page --
    list_staff_users_for_hospital() above is scoped to one tenant (the
    hospital's own Staff page); this is the super-admin equivalent, joined
    with hospitals.name since that page has no other way to label which
    hospital each row belongs to. All filters optional/combinable. search is
    a case-insensitive partial match on name OR email, same ILIKE pattern
    db/repositories/patients.py's search_patients() uses."""
    session = get_session()
    query = (
        select(*_STAFF_COLUMNS, HospitalRow.name.label("hospital_name"))
        .join(StaffDetail, StaffDetail.identity_id == Identity.id)
        .join(HospitalRow, HospitalRow.id == StaffDetail.hospital_id)
    )
    if hospital_id is not None:
        query = query.where(StaffDetail.hospital_id == hospital_id)
    if role is not None:
        query = query.where(StaffDetail.role == role)
    if is_active is not None:
        query = query.where(Identity.is_active == is_active)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(or_(Identity.name.ilike(like), Identity.email.ilike(like)))
    query = query.order_by(HospitalRow.name, Identity.name)
    rows = session.execute(query).all()
    return [dict(r._mapping) for r in rows]


def get_staff_summary_by_hospital(search: str | None = None) -> list[dict]:
    """Card view for the platform admin's /admin/users overview -- one row
    per hospital with a per-role headcount (admin/receptionist/kitchen),
    computed in a single grouped query rather than fetching every staff row
    and counting in Python. LEFT JOIN so a hospital with zero staff still
    gets a row (all counts 0), not silently dropped. search is a
    case-insensitive partial match on the hospital's own name."""
    session = get_session()
    admin_count = func.count(StaffDetail.identity_id).filter(StaffDetail.role == "admin")
    kitchen_count = func.count(StaffDetail.identity_id).filter(StaffDetail.role == "kitchen")
    receptionist_count = func.count(StaffDetail.identity_id).filter(StaffDetail.role == "receptionist")
    query = (
        select(
            HospitalRow.id, HospitalRow.name, HospitalRow.is_active, HospitalRow.data_tier,
            admin_count.label("admin_count"), kitchen_count.label("kitchen_count"),
            receptionist_count.label("receptionist_count"),
            func.count(StaffDetail.identity_id).label("total_count"),
        )
        .select_from(HospitalRow)
        .outerjoin(StaffDetail, StaffDetail.hospital_id == HospitalRow.id)
        .group_by(HospitalRow.id)
        .order_by(HospitalRow.name)
    )
    if search:
        query = query.where(HospitalRow.name.ilike(f"%{search.strip()}%"))
    rows = session.execute(query).all()
    return [dict(r._mapping) for r in rows]


def get_staff_user_detail(staff_id: int) -> dict | None:
    """Single-staff detail view (/admin/users/[hospitalId]/[staffId]) --
    get_staff_user_by_id() plus hospital_name/created_at and, for a
    role='doctor' row, the linked doctor's department (None for
    admin/receptionist rows, or a doctor StaffDetail whose doctor_id was
    never linked)."""
    session = get_session()
    row = session.execute(
        select(
            *_STAFF_COLUMNS, Identity.created_at, HospitalRow.name.label("hospital_name"),
            DoctorRow.name.label("doctor_name"), Department.name.label("department_name"),
        )
        .join(StaffDetail, StaffDetail.identity_id == Identity.id)
        .join(HospitalRow, HospitalRow.id == StaffDetail.hospital_id)
        .outerjoin(DoctorRow, DoctorRow.id == StaffDetail.doctor_id)
        .outerjoin(Department, Department.id == DoctorRow.department_id)
        .where(Identity.id == staff_id)
    ).first()
    return dict(row._mapping) if row is not None else None


def _bump_token_version(staff_id: int) -> None:
    """Shared by every mutation below that must invalidate outstanding JWTs
    immediately (db/schema.sql's own comment on identities.token_version) --
    a plain UPDATE ... SET token_version = token_version + 1, not a
    read-then-write, so it's correct even under concurrent calls."""
    session = get_session()
    session.execute(update(Identity).where(Identity.id == staff_id).values(token_version=Identity.token_version + 1))


def update_staff_user_role(staff_id: int, role: str, doctor_id: str | None = None, hospital_id: int | None = None) -> bool:
    """Admin-only role change (a future staff-management route) -- bumps
    token_version so a demoted/promoted staff member's ALREADY-ISSUED access
    token (which embeds the OLD role as a claim) stops verifying immediately
    rather than acting under stale permissions until it expires (up to 15
    minutes, jwt_session.py's TTL). role/doctor_id live on StaffDetail now;
    token_version lives on Identity -- two updates, one transaction."""
    session = get_session()
    where = [StaffDetail.identity_id == staff_id]
    if hospital_id is not None:
        where.append(StaffDetail.hospital_id == hospital_id)
    result = cast(CursorResult, session.execute(
        update(StaffDetail).where(*where).values(role=role, doctor_id=doctor_id)
    ))
    if result.rowcount == 0:
        session.commit()
        return False
    _bump_token_version(staff_id)
    session.commit()
    return True


def set_staff_user_active(staff_id: int, is_active: bool) -> bool:
    """Deactivation is the actual "revoke this person's access" action
    (there's no DELETE -- same "off, not gone" posture doctors.set_doctor_active()
    already established) -- bumps token_version for the same immediate-
    invalidation reason update_staff_user_role() does. is_active lives on
    Identity -- WHERE also requires a matching StaffDetail row so this can
    never accidentally deactivate a non-staff identity."""
    session = get_session()
    result = cast(CursorResult, session.execute(
        update(Identity)
        .where(Identity.id == staff_id, Identity.id.in_(select(StaffDetail.identity_id)))
        .values(is_active=is_active)
    ))
    if result.rowcount == 0:
        session.commit()
        return False
    _bump_token_version(staff_id)
    session.commit()
    return True


def update_staff_user_password(staff_id: int, password_hash: str) -> bool:
    """Admin-issued reset or self-service change (a future route) -- bumps
    token_version so every OTHER outstanding session for this staff member is
    forced to re-authenticate, the standard "changing your password logs out
    every other device" expectation. Same staff-only WHERE guard as
    set_staff_user_active()."""
    session = get_session()
    result = cast(CursorResult, session.execute(
        update(Identity)
        .where(Identity.id == staff_id, Identity.id.in_(select(StaffDetail.identity_id)))
        .values(password_hash=password_hash)
    ))
    if result.rowcount == 0:
        session.commit()
        return False
    _bump_token_version(staff_id)
    session.commit()
    return True
