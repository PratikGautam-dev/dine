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
    Branch.service_charge_pct, Branch.delivery_radius_km, Branch.min_order_paise,
    Branch.accepts_online, Branch.accepts_whatsapp,
    Branch.tables_enabled, Branch.is_open_override, Branch.avg_prep_time_min, Branch.delivery_fee_paise,
)


def _default_branch_id(hospital_id: int) -> str:
    """Matches migration 0053's own backfill convention exactly -- the one default branch every
    hospital gets at creation time is always this id, never a random uuid."""
    return f"h{hospital_id}_default"


def _row_to_dict(row) -> dict:
    """service_charge_pct/delivery_radius_km are NUMERIC columns -- SQLAlchemy hands those back
    as Decimal, which Starlette's JSONResponse can't serialize (TypeError, a 500 with no CORS
    headers on it, which the browser reports as a bare "network error" with no useful detail).
    Cast to float here, the one place every read of this table funnels through."""
    d = dict(row._mapping)
    for key in ("service_charge_pct", "delivery_radius_km"):
        if d.get(key) is not None:
            d[key] = float(d[key])
    return d


def list_branches(hospital_id: int, active_only: bool = True) -> list[dict]:
    session = get_session()
    stmt = select(*_COLUMNS).where(Branch.hospital_id == hospital_id)
    if active_only:
        stmt = stmt.where(Branch.is_active.is_(True))
    rows = session.execute(stmt.order_by(Branch.is_default.desc(), Branch.name)).all()
    return [_row_to_dict(r) for r in rows]


def get_branch(hospital_id: int, branch_id: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_COLUMNS).where(Branch.hospital_id == hospital_id, Branch.id == branch_id)
    ).first()
    return _row_to_dict(row) if row else None


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
    service_charge_pct: float | None = None,
    delivery_radius_km: float | None = None,
    min_order_paise: int | None = None,
    accepts_online: bool | None = None,
    accepts_whatsapp: bool | None = None,
    tables_enabled: bool | None = None,
    is_open_override: bool | None = None,
    avg_prep_time_min: int | None = None,
    delivery_fee_paise: int | None = None,
) -> dict:
    """is_default is only ever True from create_hospital()'s own call, to seed the one
    auto-created default branch -- every other caller (the portal's "Add branch" form) leaves it
    False, since a hospital's default branch is fixed at creation and never reassigned here.

    service_charge_pct/delivery_radius_km/min_order_paise/accepts_online/accepts_whatsapp
    (migration 0055) and tables_enabled/is_open_override/avg_prep_time_min/delivery_fee_paise
    (migration 0061) all left unset (None) inherit the hospital-wide default -- same convention
    operating_days/operating_hours/turnover_minutes already follow on this table."""
    branch_id = _default_branch_id(hospital_id) if is_default else f"h{hospital_id}_{uuid.uuid4().hex[:8]}"
    session = get_session()
    session.execute(
        Branch.__table__.insert().values(
            id=branch_id, hospital_id=hospital_id, name=name, address_line=address_line, city=city,
            phone=phone, operating_days=operating_days, operating_hours=operating_hours,
            turnover_minutes=turnover_minutes, booking_interval_minutes=booking_interval_minutes,
            is_default=is_default, is_active=True, created_at=datetime.now().isoformat(),
            service_charge_pct=service_charge_pct, delivery_radius_km=delivery_radius_km,
            min_order_paise=min_order_paise, accepts_online=accepts_online, accepts_whatsapp=accepts_whatsapp,
            tables_enabled=tables_enabled, is_open_override=is_open_override,
            avg_prep_time_min=avg_prep_time_min, delivery_fee_paise=delivery_fee_paise,
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
    service_charge_pct: float | None = None,
    delivery_radius_km: float | None = None,
    min_order_paise: int | None = None,
    accepts_online: bool | None = None,
    accepts_whatsapp: bool | None = None,
    tables_enabled: bool | None = None,
    is_open_override: bool | None = None,
    avg_prep_time_min: int | None = None,
    delivery_fee_paise: int | None = None,
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
        "service_charge_pct": service_charge_pct if service_charge_pct is not None else existing["service_charge_pct"],
        "delivery_radius_km": delivery_radius_km if delivery_radius_km is not None else existing["delivery_radius_km"],
        "min_order_paise": min_order_paise if min_order_paise is not None else existing["min_order_paise"],
        "accepts_online": accepts_online if accepts_online is not None else existing["accepts_online"],
        "accepts_whatsapp": accepts_whatsapp if accepts_whatsapp is not None else existing["accepts_whatsapp"],
        "tables_enabled": tables_enabled if tables_enabled is not None else existing["tables_enabled"],
        "is_open_override": is_open_override if is_open_override is not None else existing["is_open_override"],
        "avg_prep_time_min": avg_prep_time_min if avg_prep_time_min is not None else existing["avg_prep_time_min"],
        "delivery_fee_paise": delivery_fee_paise if delivery_fee_paise is not None else existing["delivery_fee_paise"],
    }
    session.execute(
        Branch.__table__.update().where(Branch.hospital_id == hospital_id, Branch.id == branch_id).values(**values)
    )
    session.commit()
    return get_branch(hospital_id, branch_id)


def set_branch_razorpay_credentials(hospital_id: int, branch_id: str, key_id: str, key_secret: str, webhook_secret: str) -> None:
    """Same encrypted-at-rest pattern as hospitals.set_razorpay_credentials() (migration 0060) --
    a branch with its own credentials settles to its own Razorpay account instead of the
    tenant-wide one. Raises ValueError if the branch doesn't exist, matching get_branch()'s own
    "exists" contract rather than silently no-op'ing."""
    from core.config import get_settings
    from core.crypto import encrypt_secret

    if get_branch(hospital_id, branch_id) is None:
        raise ValueError(f"branch {branch_id} not found for hospital {hospital_id}")
    encryption_key = get_settings().RAZORPAY_TOKEN_ENCRYPTION_KEY
    session = get_session()
    session.execute(
        Branch.__table__.update().where(Branch.hospital_id == hospital_id, Branch.id == branch_id).values(
            razorpay_key_id=key_id,
            razorpay_key_secret_ref=encrypt_secret(key_secret, encryption_key),
            razorpay_webhook_secret_ref=encrypt_secret(webhook_secret, encryption_key),
        )
    )
    session.commit()


def clear_branch_razorpay_credentials(hospital_id: int, branch_id: str) -> None:
    """Reverts the branch to inheriting the hospital's own Razorpay credentials."""
    session = get_session()
    session.execute(
        Branch.__table__.update().where(Branch.hospital_id == hospital_id, Branch.id == branch_id).values(
            razorpay_key_id=None, razorpay_key_secret_ref=None, razorpay_webhook_secret_ref=None,
        )
    )
    session.commit()


def get_effective_razorpay_credentials(hospital_id: int, branch_id: str) -> dict | None:
    """Branch-level credentials (all 3 columns set) take priority; otherwise falls back to the
    hospital's own (hospitals.get_razorpay_credentials()). Returns None if neither is configured --
    same "unconfigured, not a crash" contract the hospital-level function already has."""
    from core.config import get_settings
    from core.crypto import decrypt_secret
    from db.repositories.hospitals import get_razorpay_credentials

    session = get_session()
    row = session.execute(
        select(Branch.razorpay_key_id, Branch.razorpay_key_secret_ref, Branch.razorpay_webhook_secret_ref)
        .where(Branch.hospital_id == hospital_id, Branch.id == branch_id)
    ).first()
    if row is not None and row.razorpay_key_id is not None and row.razorpay_key_secret_ref is not None and row.razorpay_webhook_secret_ref is not None:
        encryption_key = get_settings().RAZORPAY_TOKEN_ENCRYPTION_KEY
        return {
            "key_id": row.razorpay_key_id,
            "key_secret": decrypt_secret(row.razorpay_key_secret_ref, encryption_key),
            "webhook_secret": decrypt_secret(row.razorpay_webhook_secret_ref, encryption_key),
        }
    return get_razorpay_credentials(hospital_id)


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
