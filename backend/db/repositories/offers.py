# db/repositories/offers.py
"""Offers & Coupons (migration 0046): a real coupon code a guest can type at the WhatsApp
food-order checkout's review step (flows/food_ordering/dispatch.py) to get a discount. No
Swiggy/Zomato integration and no dine-in checkout exists, so an offer only ever applies to a
real food_orders row -- optionally restricted to pickup or delivery via `fulfillment_type`."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from db.connection import get_connection, get_session
from db.orm_models import FoodOrder, Offer, PatientRow

DISCOUNT_TYPES = ("percentage", "flat")
FULFILLMENT_SCOPES = ("pickup", "delivery")


class OfferError(ValueError):
    """A coupon code that can't be applied right now -- invalid code, wrong fulfillment type,
    outside its validity window, below the minimum order value, or already at its redemption
    cap. The message is guest-facing (shown on WhatsApp via flows/food_ordering/dispatch.py)."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_offer(
    hospital_id: int, name: str, discount_type: str, discount_value: int, coupon_code: str,
    valid_from: str, valid_to: str, min_order_value_paise: int = 0, max_redemptions: int | None = None,
    fulfillment_type: str | None = None,
) -> dict:
    if discount_type not in DISCOUNT_TYPES:
        raise ValueError(f"discount_type must be one of {DISCOUNT_TYPES}, got {discount_type!r}")
    if discount_type == "percentage" and not (1 <= discount_value <= 100):
        raise ValueError("A percentage discount must be between 1 and 100.")
    if discount_value <= 0:
        raise ValueError("Discount value must be greater than 0.")
    if fulfillment_type is not None and fulfillment_type not in FULFILLMENT_SCOPES:
        raise ValueError(f"fulfillment_type must be one of {FULFILLMENT_SCOPES} or None, got {fulfillment_type!r}")
    code = coupon_code.strip().upper()
    if not code:
        raise ValueError("Coupon code is required.")
    session = get_session()
    offer_id = session.execute(
        Offer.__table__.insert().values(
            hospital_id=hospital_id, name=name.strip(), discount_type=discount_type, discount_value=discount_value,
            coupon_code=code, valid_from=valid_from, valid_to=valid_to,
            min_order_value_paise=min_order_value_paise, max_redemptions=max_redemptions,
            fulfillment_type=fulfillment_type, is_active=True, created_at=_now_iso(),
        ).returning(Offer.id)
    ).scalar_one()
    session.commit()
    return get_offer(hospital_id, offer_id)  # type: ignore[return-value]


def get_offer(hospital_id: int, offer_id: int) -> dict | None:
    session = get_session()
    row = session.execute(select(Offer).where(Offer.hospital_id == hospital_id, Offer.id == offer_id)).scalar_one_or_none()
    return _offer_to_dict(row) if row else None


def _offer_to_dict(row: Offer) -> dict:
    return {
        "id": row.id, "name": row.name, "discount_type": row.discount_type, "discount_value": row.discount_value,
        "coupon_code": row.coupon_code, "valid_from": row.valid_from, "valid_to": row.valid_to,
        "min_order_value_paise": row.min_order_value_paise, "max_redemptions": row.max_redemptions,
        "fulfillment_type": row.fulfillment_type, "is_active": row.is_active, "created_at": row.created_at,
    }


def _status_for(offer: dict, usage_count: int, now: str) -> str:
    if not offer["is_active"]:
        return "disabled"
    if offer["max_redemptions"] is not None and usage_count >= offer["max_redemptions"]:
        return "disabled"
    if now < offer["valid_from"]:
        return "scheduled"
    if now > offer["valid_to"]:
        return "expired"
    return "active"


def list_offers(hospital_id: int) -> list[dict]:
    """Every offer plus its real, computed usage/revenue -- never stored counters, always a live
    join over food_orders so it can't drift. Cancelled orders don't count as a real redemption."""
    session = get_session()
    offers = session.execute(select(Offer).where(Offer.hospital_id == hospital_id).order_by(Offer.created_at.desc())).scalars().all()
    if not offers:
        return []
    usage_rows = session.execute(
        select(FoodOrder.offer_id, func.count(FoodOrder.id), func.sum(FoodOrder.total_paise))
        .where(FoodOrder.hospital_id == hospital_id, FoodOrder.offer_id.isnot(None), FoodOrder.status != "cancelled")
        .group_by(FoodOrder.offer_id)
    ).all()
    usage_by_offer = {offer_id: (count, revenue or 0) for offer_id, count, revenue in usage_rows}
    now = _now_iso()
    result = []
    for row in offers:
        offer = _offer_to_dict(row)
        usage_count, revenue_paise = usage_by_offer.get(row.id, (0, 0))
        result.append({
            **offer, "usage_count": usage_count, "revenue_paise": revenue_paise,
            "status": _status_for(offer, usage_count, now),
        })
    return result


def update_offer(hospital_id: int, offer_id: int, is_active: bool | None = None) -> dict | None:
    """Only toggling active/inactive today -- editing the terms of an already-live coupon isn't
    exposed yet (matches the mockup's "..." row action being a status toggle, not a full edit
    form)."""
    if is_active is None:
        return get_offer(hospital_id, offer_id)
    session = get_session()
    result = session.execute(
        Offer.__table__.update().where(Offer.hospital_id == hospital_id, Offer.id == offer_id).values(is_active=is_active)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return get_offer(hospital_id, offer_id)


def get_offers_summary(hospital_id: int) -> dict:
    offers = list_offers(hospital_id)
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(days=7)).isoformat()
    active_offers = sum(1 for o in offers if o["status"] == "active")
    scheduled = sum(1 for o in offers if o["status"] == "scheduled")
    expiring_soon = sum(1 for o in offers if o["status"] == "active" and o["valid_to"] <= soon)
    total_redemptions = sum(o["usage_count"] for o in offers)
    total_revenue = sum(o["revenue_paise"] for o in offers)

    # --- Usage + revenue trend, last 7 days. ---
    session = get_session()
    week_start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    redemption_rows = session.execute(
        select(FoodOrder.created_at, FoodOrder.total_paise)
        .where(
            FoodOrder.hospital_id == hospital_id, FoodOrder.offer_id.isnot(None), FoodOrder.status != "cancelled",
            FoodOrder.created_at >= week_start.isoformat(),
        )
    ).all()
    by_day: dict[str, dict[str, int]] = {}
    for created_at, total_paise in redemption_rows:
        day = created_at[:10]
        entry = by_day.setdefault(day, {"redemptions": 0, "revenue_paise": 0})
        entry["redemptions"] += 1
        entry["revenue_paise"] += total_paise
    trend = []
    for i in range(6, -1, -1):
        day_dt = now - timedelta(days=i)
        day = day_dt.strftime("%Y-%m-%d")
        entry = by_day.get(day, {"redemptions": 0, "revenue_paise": 0})
        trend.append({"date": day, "label": day_dt.strftime("%d %b"), **entry})

    top_redeemed = sorted(offers, key=lambda o: o["usage_count"], reverse=True)[:5]

    # --- Customer segments reached: guests who've redeemed at least one offer, bucketed by their
    # current visit_count -- same bucket boundaries the Customers page's donut already uses. ---
    redeemer_ids = session.execute(
        select(FoodOrder.patient_id.distinct())
        .where(FoodOrder.hospital_id == hospital_id, FoodOrder.offer_id.isnot(None), FoodOrder.patient_id.isnot(None))
    ).scalars().all()
    segments = {"New (1 booking)": 0, "Occasional (2-3)": 0, "Regular (4+)": 0}
    if redeemer_ids:
        visit_counts = session.execute(
            select(PatientRow.id, func.count().label("c"))
            .select_from(PatientRow)
            .where(PatientRow.id.in_(redeemer_ids))
            .group_by(PatientRow.id)
        ).all()
        # visit_count isn't on PatientRow directly (it's derived from appointments elsewhere) --
        # reuse that same derivation via the shared helper instead of duplicating the join.
        from db.repositories.patients import list_patients
        by_id = {p["id"]: p for p in list_patients(hospital_id, limit=10000)}
        for pid in redeemer_ids:
            p = by_id.get(pid)
            vc = p["visit_count"] if p else 0
            if vc <= 1:
                segments["New (1 booking)"] += 1
            elif vc <= 3:
                segments["Occasional (2-3)"] += 1
            else:
                segments["Regular (4+)"] += 1

    return {
        "kpis": {
            "active_offers": active_offers, "scheduled_campaigns": scheduled, "expiring_soon": expiring_soon,
            "coupon_redemptions": total_redemptions, "revenue_from_offers_paise": total_revenue,
        },
        "trend": trend,
        "top_redeemed": [{"name": o["name"], "usage_count": o["usage_count"], "revenue_paise": o["revenue_paise"]} for o in top_redeemed],
        "customer_segments": [{"department_name": k, "count": v} for k, v in segments.items() if v > 0],
        "offers": offers,
    }


def _validate_offer_row(row: dict, subtotal_paise: int, fulfillment_type: str, usage_count: int, now: str) -> None:
    if not row["is_active"]:
        raise OfferError("This coupon is no longer active.")
    if now < row["valid_from"]:
        raise OfferError("This coupon isn't valid yet.")
    if now > row["valid_to"]:
        raise OfferError("This coupon has expired.")
    if row["fulfillment_type"] is not None and row["fulfillment_type"] != fulfillment_type:
        raise OfferError(f"This coupon only applies to {row['fulfillment_type']} orders.")
    if subtotal_paise < row["min_order_value_paise"]:
        from core.money import format_price
        raise OfferError(f"This coupon needs a minimum order of {format_price(row['min_order_value_paise'])}.")
    if row["max_redemptions"] is not None and usage_count >= row["max_redemptions"]:
        raise OfferError("This coupon has reached its redemption limit.")


def preview_offer(hospital_id: int, coupon_code: str, subtotal_paise: int, fulfillment_type: str) -> dict:
    """Read-only check (no redemption reserved) -- used to show the guest the discount before
    they confirm the order. The real, race-safe check happens again inside create_food_order()'s
    own transaction at actual checkout; this can go stale between preview and confirm (e.g. the
    last slot of a capped coupon taken by someone else), which create_food_order() then rejects."""
    code = coupon_code.strip().upper()
    session = get_session()
    row = session.execute(
        select(Offer).where(Offer.hospital_id == hospital_id, Offer.coupon_code == code)
    ).scalar_one_or_none()
    if row is None:
        raise OfferError("We couldn't find that coupon code.")
    offer = _offer_to_dict(row)
    usage_count = session.execute(
        select(func.count(FoodOrder.id)).where(FoodOrder.offer_id == row.id, FoodOrder.status != "cancelled")
    ).scalar_one()
    _validate_offer_row(offer, subtotal_paise, fulfillment_type, usage_count, _now_iso())
    discount_paise = (
        min(subtotal_paise, round(subtotal_paise * offer["discount_value"] / 100))
        if offer["discount_type"] == "percentage" else min(subtotal_paise, offer["discount_value"])
    )
    return {"offer_id": offer["id"], "name": offer["name"], "coupon_code": offer["coupon_code"], "discount_paise": discount_paise}


def redeem_offer_in_conn(conn, hospital_id: int, coupon_code: str, subtotal_paise: int, fulfillment_type: str) -> tuple[int, int]:
    """The real, race-checked redemption -- called from create_food_order() inside its own
    BEGIN/COMMIT transaction on the shared raw connection, so the usage-count check and the
    order INSERT that follows are atomic against a genuinely concurrent redemption of the same
    capped coupon. Returns (offer_id, discount_paise); raises OfferError."""
    code = coupon_code.strip().upper()
    row = conn.execute(
        "SELECT id, discount_type, discount_value, valid_from, valid_to, min_order_value_paise, "
        "max_redemptions, fulfillment_type, is_active FROM offers WHERE hospital_id = ? AND coupon_code = ?",
        (hospital_id, code),
    ).fetchone()
    if row is None:
        raise OfferError("We couldn't find that coupon code.")
    offer = dict(row)
    usage_count = conn.execute(
        "SELECT COUNT(*) AS c FROM food_orders WHERE offer_id = ? AND status != 'cancelled'", (offer["id"],),
    ).fetchone()["c"]
    _validate_offer_row(offer, subtotal_paise, fulfillment_type, usage_count, _now_iso())
    discount_paise = (
        min(subtotal_paise, round(subtotal_paise * offer["discount_value"] / 100))
        if offer["discount_type"] == "percentage" else min(subtotal_paise, offer["discount_value"])
    )
    return offer["id"], discount_paise
