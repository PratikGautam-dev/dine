from datetime import datetime, timezone

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import authorize

router = APIRouter()


def _offer_json(o: dict) -> dict:
    return {
        "id": o["id"], "name": o["name"], "discount_type": o["discount_type"], "discount_value": o["discount_value"],
        "coupon_code": o["coupon_code"], "valid_from": o["valid_from"], "valid_to": o["valid_to"],
        "min_order_value_paise": o["min_order_value_paise"], "max_redemptions": o["max_redemptions"],
        "fulfillment_type": o["fulfillment_type"], "is_active": o["is_active"], "created_at": o["created_at"],
        "usage_count": o.get("usage_count", 0), "revenue_paise": o.get("revenue_paise", 0), "status": o.get("status"),
    }


@router.get("/api/portal/offers")
async def portal_offers(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "offers", "view")
    if error:
        return error
    hospital = principal.hospital
    summary = db.get_offers_summary(hospital.id)
    return JSONResponse({
        "kpis": summary["kpis"], "trend": summary["trend"], "top_redeemed": summary["top_redeemed"],
        "customer_segments": summary["customer_segments"],
        "offers": [_offer_json(o) for o in summary["offers"]],
    })


@router.post("/api/portal/offers")
async def portal_create_offer(payload: dict, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "offers", "write")
    if error:
        return error
    hospital = principal.hospital
    p = payload or {}
    required = ("name", "discount_type", "discount_value", "coupon_code", "valid_from", "valid_to")
    missing = [f for f in required if not p.get(f) and p.get(f) != 0]
    if missing:
        return JSONResponse({"error": f"Missing required field(s): {', '.join(missing)}."}, status_code=400)
    try:
        created = db.create_offer(
            hospital.id, name=p["name"], discount_type=p["discount_type"], discount_value=int(p["discount_value"]),
            coupon_code=p["coupon_code"], valid_from=p["valid_from"], valid_to=p["valid_to"],
            min_order_value_paise=int(p.get("min_order_value_paise") or 0),
            max_redemptions=int(p["max_redemptions"]) if p.get("max_redemptions") else None,
            fulfillment_type=p.get("fulfillment_type") or None,
        )
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    except db.IntegrityError:
        return JSONResponse({"error": "That coupon code is already in use."}, status_code=409)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "offer.create", entity_type="offer", entity_id=str(created["id"]),
        after={"name": created["name"], "coupon_code": created["coupon_code"]},
    )
    return JSONResponse({"offer": created})


@router.post("/api/portal/offers/{offer_id}")
async def portal_update_offer(offer_id: int, payload: dict, authorization: str | None = Header(default=None)):
    """Today, only the "..." row action's active/inactive toggle -- editing an already-live
    coupon's terms isn't exposed yet."""
    principal, error = authorize(authorization, "offers", "write")
    if error:
        return error
    hospital = principal.hospital
    is_active = (payload or {}).get("is_active")
    if is_active is None or not isinstance(is_active, bool):
        return JSONResponse({"error": "is_active (true/false) is required."}, status_code=400)
    updated = db.update_offer(hospital.id, offer_id, is_active=is_active)
    if updated is None:
        return JSONResponse({"error": "No such offer."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "offer.toggle_active", entity_type="offer", entity_id=str(offer_id),
        after={"is_active": is_active},
    )
    return JSONResponse({"offer": updated})
