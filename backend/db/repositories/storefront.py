# db/repositories/storefront.py
"""Web Storefront (migration 0051): a public marketplace website (/order), a second ordering
channel alongside the WhatsApp bot, feeding the exact same food_orders/menu_items data. Four things
live here: the per-restaurant storefront profile, the public marketplace reads (deliberately never
serializing a private/staff column -- every public dict below is built explicitly, field by field),
the mock-SMS OTP customer login, and the mock payment gateway's own status transition."""
import hashlib
import hmac
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.connection import get_session
from db.orm_models import CustomerOtp, FoodOrder, HospitalRow
from db.repositories.food_orders import STATUS_PAID, STATUS_PENDING_PAYMENT, advance_order_status, get_food_order
from portal.attendance_rules import WEEKDAYS, to_minutes, tz

_OTP_TTL_MINUTES = 10
_OTP_MAX_ATTEMPTS = 5
_OTP_LENGTH = 6

_SLUG_FIELDS = (
    "web_ordering_enabled", "storefront_slug", "cuisine_tags", "tagline", "address_line", "city",
    "logo_url", "cover_image_url", "min_order_paise", "avg_prep_minutes",
)


class StorefrontError(ValueError):
    """A storefront profile update that can't be applied -- shown to restaurant staff as-is
    (a bad slug, one already taken, or a negative amount)."""


def slugify(name: str) -> str:
    out = []
    prev_dash = False
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    slug = "".join(out).strip("-")
    return slug or "restaurant"


def normalize_customer_phone(raw: str) -> str | None:
    """Digits-only with country code, same convention every WhatsApp-sourced phone in this app
    already uses (e.g. "919812345601"). A bare 10-digit Indian number gets "91" prefixed; anything
    else must already be 11-15 digits. None means "not a phone number", not an exception -- callers
    turn that into a 400."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    if 11 <= len(digits) <= 15:
        return digits
    return None


# ---------------------------------------------------------------- profile

def get_storefront(hospital_id: int) -> dict:
    session = get_session()
    row = session.execute(
        select(
            HospitalRow.id, HospitalRow.name, HospitalRow.web_ordering_enabled, HospitalRow.storefront_slug,
            HospitalRow.cuisine_tags, HospitalRow.tagline, HospitalRow.address_line, HospitalRow.city,
            HospitalRow.logo_url, HospitalRow.cover_image_url, HospitalRow.min_order_paise, HospitalRow.avg_prep_minutes,
        ).where(HospitalRow.id == hospital_id)
    ).one()
    return {
        "hospital_id": row.id, "name": row.name, "web_ordering_enabled": row.web_ordering_enabled,
        "slug": row.storefront_slug,
        "cuisines": [c.strip() for c in (row.cuisine_tags or "").split(",") if c.strip()],
        "tagline": row.tagline, "address_line": row.address_line, "city": row.city,
        "logo_url": row.logo_url, "cover_image_url": row.cover_image_url,
        "min_order_paise": row.min_order_paise, "avg_prep_minutes": row.avg_prep_minutes,
    }


def _free_slug(session, hospital_id: int, base: str) -> str:
    candidate = base
    n = 2
    while session.execute(
        select(HospitalRow.id).where(HospitalRow.storefront_slug == candidate, HospitalRow.id != hospital_id)
    ).first() is not None:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def update_storefront(hospital_id: int, fields: dict) -> dict:
    """Only `_SLUG_FIELDS` are ever written, whatever else `fields` contains. Enabling with no slug
    set (yet, or ever) auto-generates a free one from the restaurant's name -- a listed restaurant
    must always have a URL. Blank strings clear a field to NULL; integers must be >= 0."""
    session = get_session()
    values: dict = {}

    if "web_ordering_enabled" in fields:
        values["web_ordering_enabled"] = bool(fields["web_ordering_enabled"])

    if "storefront_slug" in fields:
        raw = (fields["storefront_slug"] or "").strip().lower()
        if raw:
            import re
            if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", raw) or len(raw) > 60:
                raise StorefrontError("Store link can only have lowercase letters, numbers and single dashes.")
            taken = session.execute(
                select(HospitalRow.id).where(HospitalRow.storefront_slug == raw, HospitalRow.id != hospital_id)
            ).first()
            if taken is not None:
                raise StorefrontError(f'"{raw}" is already taken -- choose another.')
            values["storefront_slug"] = raw
        else:
            values["storefront_slug"] = None

    for key in ("cuisine_tags", "tagline", "address_line", "city", "logo_url", "cover_image_url"):
        if key in fields:
            v = (fields[key] or "").strip()
            values[key] = v or None

    for key in ("min_order_paise", "avg_prep_minutes"):
        if key in fields and fields[key] is not None:
            n = int(fields[key])
            if n < 0:
                raise StorefrontError(f"{key.replace('_', ' ')} can't be negative.")
            values[key] = n

    # A listed restaurant must always have a URL -- enabling with no slug (given or already set)
    # generates one from the name, rather than silently listing an unreachable storefront.
    enabling = values.get("web_ordering_enabled") is True
    if enabling and values.get("storefront_slug") is None:
        current = session.execute(select(HospitalRow.storefront_slug, HospitalRow.name).where(HospitalRow.id == hospital_id)).one()
        if current.storefront_slug is None and "storefront_slug" not in fields:
            values["storefront_slug"] = _free_slug(session, hospital_id, slugify(current.name))

    if values:
        session.execute(update(HospitalRow).where(HospitalRow.id == hospital_id).values(**values))
        session.commit()
    return get_storefront(hospital_id)


# ---------------------------------------------------------------- marketplace reads

def is_open_now(hospital_id: int, tz_name: str, operating_days: list[str], operating_hours: list[str], now: datetime | None = None) -> bool:
    """No hours configured at all => treated as open (a restaurant that hasn't set hours yet
    shouldn't look permanently closed on its own storefront). Handles a single overnight range
    (e.g. "18:00-02:00") the same way portal/attendance_rules' own HH:MM handling does."""
    if not operating_days or not operating_hours:
        return True
    local = (now or datetime.now(timezone.utc)).astimezone(tz(tz_name))
    if WEEKDAYS[local.weekday()] not in operating_days:
        return False
    now_minutes = local.hour * 60 + local.minute
    for rng in operating_hours:
        if "-" not in rng:
            continue
        start_s, end_s = rng.split("-", 1)
        try:
            start, end = to_minutes(start_s.strip()), to_minutes(end_s.strip())
        except (ValueError, IndexError):
            continue
        if start <= end:
            if start <= now_minutes < end:
                return True
        elif now_minutes >= start or now_minutes < end:  # crosses midnight
            return True
    return False


_CARD_COLUMNS = (
    HospitalRow.id, HospitalRow.name, HospitalRow.storefront_slug, HospitalRow.cuisine_tags,
    HospitalRow.tagline, HospitalRow.address_line, HospitalRow.city, HospitalRow.logo_url,
    HospitalRow.cover_image_url, HospitalRow.min_order_paise, HospitalRow.avg_prep_minutes,
    HospitalRow.timezone,
)


def _card(row) -> dict:
    from db.repositories.hospital_settings import get_hospital_settings
    settings = get_hospital_settings(row.id)
    return {
        "hospital_id": row.id, "name": row.name, "slug": row.storefront_slug,
        "cuisines": [c.strip() for c in (row.cuisine_tags or "").split(",") if c.strip()],
        "tagline": row.tagline, "address_line": row.address_line, "city": row.city,
        "logo_url": row.logo_url, "cover_image_url": row.cover_image_url,
        "min_order_paise": row.min_order_paise, "avg_prep_minutes": row.avg_prep_minutes,
        "is_open": is_open_now(row.id, row.timezone, settings["operating_days"], settings["operating_hours"]),
    }


def list_public_restaurants(search: str | None = None, city: str | None = None, cuisine: str | None = None) -> list[dict]:
    session = get_session()
    stmt = select(*_CARD_COLUMNS).where(
        HospitalRow.web_ordering_enabled.is_(True), HospitalRow.is_active == 1, HospitalRow.storefront_slug.is_not(None),
    )
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(HospitalRow.name.ilike(like), HospitalRow.cuisine_tags.ilike(like), HospitalRow.tagline.ilike(like)))
    if city:
        stmt = stmt.where(func.lower(HospitalRow.city) == city.strip().lower())
    rows = session.execute(stmt.order_by(HospitalRow.name)).all()
    cards = [_card(r) for r in rows]
    if cuisine:
        needle = cuisine.strip().lower()
        cards = [c for c in cards if any(needle == cu.lower() for cu in c["cuisines"])]
    cards.sort(key=lambda c: (not c["is_open"], c["name"]))
    return cards


def get_public_restaurant(slug: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_CARD_COLUMNS).where(
            HospitalRow.storefront_slug == slug, HospitalRow.web_ordering_enabled.is_(True), HospitalRow.is_active == 1,
        )
    ).first()
    return _card(row) if row else None


def list_public_cities() -> list[str]:
    session = get_session()
    rows = session.execute(
        select(HospitalRow.city).where(
            HospitalRow.web_ordering_enabled.is_(True), HospitalRow.is_active == 1,
            HospitalRow.storefront_slug.is_not(None), HospitalRow.city.is_not(None),
        ).distinct()
    ).all()
    return sorted({r[0] for r in rows if r[0]})


# ---------------------------------------------------------------- OTP (mock delivery, real verification)

def _hash_code(phone: str, code: str) -> str:
    return hashlib.sha256(f"{phone}:{code}".encode()).hexdigest()


def request_otp(phone: str) -> str:
    """Invalidates any earlier unused code for this phone, creates a new 6-digit one, stores only
    its hash, and returns the PLAIN code -- the caller (the route) decides whether to show it; that
    decision is the entire "mock" in "mock OTP." Never logged, never stored in plain text."""
    session = get_session()
    now = datetime.now(timezone.utc)
    session.execute(
        update(CustomerOtp).where(CustomerOtp.phone == phone, CustomerOtp.consumed_at.is_(None))
        .values(consumed_at=now.isoformat())
    )
    code = f"{secrets.randbelow(10 ** _OTP_LENGTH):0{_OTP_LENGTH}d}"
    session.execute(
        pg_insert(CustomerOtp).values(
            phone=phone, code_hash=_hash_code(phone, code),
            expires_at=(now + timedelta(minutes=_OTP_TTL_MINUTES)).isoformat(),
            attempts=0, created_at=now.isoformat(),
        )
    )
    session.commit()
    return code


def verify_otp(phone: str, code: str) -> bool:
    """The latest unconsumed, unexpired code for this phone, under `_OTP_MAX_ATTEMPTS` guesses.
    Each code works exactly once -- a right guess consumes it immediately."""
    session = get_session()
    now = datetime.now(timezone.utc)
    row = session.execute(
        select(CustomerOtp).where(CustomerOtp.phone == phone, CustomerOtp.consumed_at.is_(None))
        .order_by(CustomerOtp.created_at.desc()).limit(1)
    ).scalar_one_or_none()
    if row is None or row.attempts >= _OTP_MAX_ATTEMPTS or datetime.fromisoformat(row.expires_at) < now:
        return False
    if not hmac.compare_digest(row.code_hash, _hash_code(phone, code)):
        session.execute(update(CustomerOtp).where(CustomerOtp.id == row.id).values(attempts=CustomerOtp.attempts + 1))
        session.commit()
        return False
    session.execute(update(CustomerOtp).where(CustomerOtp.id == row.id).values(consumed_at=now.isoformat()))
    session.commit()
    return True


# ---------------------------------------------------------------- customer order reads (cross-hospital)

def _restaurant_stub(session, hospital_id: int) -> dict | None:
    row = session.execute(select(HospitalRow.name, HospitalRow.storefront_slug).where(HospitalRow.id == hospital_id)).first()
    return {"name": row.name, "slug": row.storefront_slug} if row else None


def get_order_hospital_id(order_id: int) -> int | None:
    """A customer only ever has an order id, never a hospital_id -- this resolves which restaurant
    an order belongs to so the public API can then call the existing hospital-scoped
    get_food_order()/advance_order_status()/mark_order_paid_mock() without duplicating their logic."""
    session = get_session()
    row = session.execute(select(FoodOrder.hospital_id).where(FoodOrder.id == order_id)).first()
    return row[0] if row else None


def get_public_order(order_id: int) -> dict | None:
    hospital_id = get_order_hospital_id(order_id)
    if hospital_id is None:
        return None
    order = get_food_order(hospital_id, order_id)
    if order is None:
        return None
    order["restaurant"] = _restaurant_stub(get_session(), hospital_id)
    return order


def list_orders_for_phone(phone: str, limit: int = 50) -> list[dict]:
    """This phone's orders across every web-enabled restaurant, newest first -- deliberately not
    scoped to `web` source only: a returning WhatsApp customer who also orders on the website
    should see their whole history in one place, same "one person across channels" principle
    patients already follow when a phone number matches."""
    session = get_session()
    rows = session.execute(
        select(FoodOrder.id, FoodOrder.hospital_id).where(FoodOrder.phone == phone)
        .order_by(FoodOrder.created_at.desc()).limit(limit)
    ).all()
    orders = []
    for r in rows:
        order = get_food_order(r.hospital_id, r.id)
        if order is not None:
            order["restaurant"] = _restaurant_stub(session, r.hospital_id)
            orders.append(order)
    return orders


# ---------------------------------------------------------------- mock payment

def mark_order_paid_mock(hospital_id: int, order_id: int) -> dict | None:
    """The mock gateway's "Pay" button. Sets mock_payment_ref only where status='pending_payment',
    then transitions PAID via the exact same guarded call the real Razorpay webhook uses
    (advance_order_status(..., STATUS_PAID, expected_status=STATUS_PENDING_PAYMENT)) -- None means
    this order wasn't awaiting payment (already paid, cancelled, or pay-at-restaurant)."""
    session = get_session()
    row = session.execute(
        update(FoodOrder)
        .where(FoodOrder.hospital_id == hospital_id, FoodOrder.id == order_id, FoodOrder.status == STATUS_PENDING_PAYMENT)
        .values(mock_payment_ref="mockpay_" + secrets.token_hex(8))
        .returning(FoodOrder.id)
    ).first()
    session.commit()
    if row is None:
        return None
    return advance_order_status(hospital_id, order_id, STATUS_PAID, expected_status=STATUS_PENDING_PAYMENT)
