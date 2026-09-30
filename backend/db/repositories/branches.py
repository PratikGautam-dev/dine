# db/repositories/branches.py
"""Multi-branch support (migration 0053) -- CRUD for a restaurant's physical locations.
Every hospital has exactly one branch (is_default=True) from the moment it's created, even
with hospitals.multi_branch_enabled off -- see that migration's own docstring for why every
branch-scoped write always has a real branch_id, never NULL. get_default_branch() is the one
function the rest of the codebase leans on to keep working unchanged: every branch-unaware
call site simply doesn't pass branch_id, and it resolves to this."""
import uuid
from datetime import datetime

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import Branch, HospitalRow

_COLUMNS = (
    Branch.id, Branch.hospital_id, Branch.name, Branch.address_line, Branch.city, Branch.phone,
    Branch.operating_days, Branch.operating_hours, Branch.turnover_minutes, Branch.booking_interval_minutes,
    Branch.is_default, Branch.is_active, Branch.created_at,
)


def _default_branch_id(hospital_id: int) -> str:
    """Matches migration 0053's own backfill convention exactly -- the one default branch every
    hospital gets at creation time is always this id, never a random uuid."""
    return f"h{hospital_id}_default"


def list_branches(hospital_id: int, active_only: bool = True) -> list[dict]:
    session = get_session()
    stmt = select(*_COLUMNS).where(Branch.hospital_id == hospital_id)
    if active_only:
        stmt = stmt.where(Branch.is_active.is_(True))
    rows = session.execute(stmt.order_by(Branch.is_default.desc(), Branch.name)).all()
    return [dict(r._mapping) for r in rows]


def get_branch(hospital_id: int, branch_id: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_COLUMNS).where(Branch.hospital_id == hospital_id, Branch.id == branch_id)
    ).first()
    return dict(row._mapping) if row else None


def get_default_branch(hospital_id: int) -> dict:
    """The fallback every branch-unaware creation function resolves branch_id to. Raises if
    called for a hospital with no branches -- every hospital gets one at create_hospital() time,
    so this only fires for a hospital created before migration 0053's backfill ran, which the
    migration itself already covers; a caller hitting this is a real bug, not a case to paper
    over with a silent None."""
    branch = get_branch(hospital_id, _default_branch_id(hospital_id))
    if branch is None:
        raise ValueError(f"hospital {hospital_id} has no default branch")
    return branch


def get_multi_branch_enabled(hospital_id: int) -> bool:
    session = get_session()
    value = session.execute(
        select(HospitalRow.multi_branch_enabled).where(HospitalRow.id == hospital_id)
    ).scalar_one()
    return bool(value)


def set_multi_branch_enabled(hospital_id: int, enabled: bool) -> bool:
    session = get_session()
    session.execute(
        HospitalRow.__table__.update().where(HospitalRow.id == hospital_id).values(multi_branch_enabled=bool(enabled))
    )
    session.commit()
    return bool(enabled)


def create_branch(
    hospital_id: int,
    name: str,
    address_line: str | None = None,
    city: str | None = None,
    phone: str | None = None,
    operating_days: str | None = None,
    operating_hours: str | None = None,
    turnover_minutes: int | None = None,
    booking_interval_minutes: int | None = None,
    is_default: bool = False,
) -> dict:
    """is_default is only ever True from create_hospital()'s own call, to seed the one
    auto-created default branch -- every other caller (the portal's "Add branch" form) leaves it
    False, since a hospital's default branch is fixed at creation and never reassigned here."""
    branch_id = _default_branch_id(hospital_id) if is_default else f"h{hospital_id}_{uuid.uuid4().hex[:8]}"
    session = get_session()
    session.execute(
        Branch.__table__.insert().values(
            id=branch_id, hospital_id=hospital_id, name=name, address_line=address_line, city=city,
            phone=phone, operating_days=operating_days, operating_hours=operating_hours,
            turnover_minutes=turnover_minutes, booking_interval_minutes=booking_interval_minutes,
            is_default=is_default, is_active=True, created_at=datetime.now().isoformat(),
        )
    )
    session.commit()
    created = get_branch(hospital_id, branch_id)
    assert created is not None
    return created


def update_branch(
    hospital_id: int,
    branch_id: str,
    name: str | None = None,
    address_line: str | None = None,
    city: str | None = None,
    phone: str | None = None,
    operating_days: str | None = None,
    operating_hours: str | None = None,
    turnover_minutes: int | None = None,
    booking_interval_minutes: int | None = None,
) -> dict | None:
    """Every field left as None keeps its current value -- same partial-update convention
    portal/routes/tables.py's own update endpoint already uses, not "None clears the field"."""
    session = get_session()
    existing = get_branch(hospital_id, branch_id)
    if existing is None:
        return None
    values = {
        "name": name if name is not None else existing["name"],
        "address_line": address_line if address_line is not None else existing["address_line"],
        "city": city if city is not None else existing["city"],
        "phone": phone if phone is not None else existing["phone"],
        "operating_days": operating_days if operating_days is not None else existing["operating_days"],
        "operating_hours": operating_hours if operating_hours is not None else existing["operating_hours"],
        "turnover_minutes": turnover_minutes if turnover_minutes is not None else existing["turnover_minutes"],
        "booking_interval_minutes": (
            booking_interval_minutes if booking_interval_minutes is not None else existing["booking_interval_minutes"]
        ),
    }
    session.execute(
        Branch.__table__.update().where(Branch.hospital_id == hospital_id, Branch.id == branch_id).values(**values)
    )
    session.commit()
    return get_branch(hospital_id, branch_id)


def set_branch_active(hospital_id: int, branch_id: str, is_active: bool) -> dict | None:
    """The default branch can never be deactivated -- it's the fallback every branch-unaware
    write resolves to, so deactivating it would silently start rejecting those writes."""
    branch = get_branch(hospital_id, branch_id)
    if branch is None:
        return None
    if branch["is_default"] and not is_active:
        raise ValueError("the default branch cannot be deactivated")
    session = get_session()
    session.execute(
        Branch.__table__.update().where(Branch.hospital_id == hospital_id, Branch.id == branch_id).values(is_active=is_active)
    )
    session.commit()
    return get_branch(hospital_id, branch_id)
