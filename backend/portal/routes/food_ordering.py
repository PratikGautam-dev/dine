# portal/routes/food_ordering.py
"""Food ordering plan, Sub-stage 4 of 4: portal CRUD for the menu catalog
(menu_items) and the order list/detail + kitchen-facing status-transition
actions, gated by the dedicated manage_food_ordering capability.
Structurally cloned from portal/routes/procedures.py (catalog CRUD pattern)
and portal/routes/bookings.py (list/detail + guarded-action pattern).

Stock: stock_count is the initial/corrected count on the create/edit form (blank = unlimited), "restock +N"
adds to it atomically, and the sold-out switch (is_available) is independent of it -- an item can be hidden
with stock left, or listed with a zero count that a restock brings back. A bulk "reset to par level" action
would need a stored par level, which is deliberately not built."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from db.repositories.food_orders import (
    STATUS_ACCEPTED, STATUS_CANCELLED, STATUS_COMPLETED, STATUS_OUT_FOR_DELIVERY, STATUS_PAID,
    STATUS_PLACED, STATUS_PREPARING, STATUS_READY_FOR_PICKUP,
)
from portal.capabilities import MANAGE_FOOD_ORDERING
from portal.deps import _authenticate, require_capability, authorize

router = APIRouter()


class MenuItemPayload(BaseModel):
    name: str = ""
    description: str | None = None
    price_rupees: float = 0
    category: str | None = None
    is_available: bool = True
    stock_count: int | None = None
    image_url: str | None = None


class RestockPayload(BaseModel):
    add: int = 0


class AvailabilityPayload(BaseModel):
    is_available: bool


_MAX_IMAGE_URL_LENGTH = 2000
_MAX_RESTOCK = 10_000


def _clean_image_url(raw: str | None) -> tuple[str | None, str | None]:
    """(url, error). Blank clears the photo. WhatsApp only fetches public https
    links, so anything else is rejected here rather than failing silently at a
    guest's phone."""
    url = (raw or "").strip()
    if not url:
        return None, None
    if len(url) > _MAX_IMAGE_URL_LENGTH or not url.lower().startswith("https://") or " " in url:
        return None, "Photo link must be a public https:// web address (no spaces)."
    return url, None


def _require_food_ordering(authorization: str | None, page: str, action: str):
    """Shared guard every route below opens with -- returns (hospital, None) on success or
    (None, JSONResponse) to return as-is, same "if error: return error" early-return shape
    every portal route uses. `page` is food_menu (the menu catalogue) or food_orders (the
    kitchen's order queue); `action` is view | write. Also requires the tenant capability."""
    principal, error = authorize(authorization, page, action)
    if error:
        return None, error
    forbidden = require_capability(principal.hospital, MANAGE_FOOD_ORDERING)
    if forbidden:
        return None, forbidden
    return principal.hospital, None


@router.get("/api/portal/menu-items")
async def portal_menu_items(authorization: str | None = Header(default=None)):
    hospital, error = _require_food_ordering(authorization, "food_menu", "view")
    if error:
        return error
    # available_only=False -- the management list shows sold-out/disabled
    # items too, same "management list sees everything, guest-facing read
    # filters" split get_all_tables_for_hospital() vs get_tables() already
    # establishes for table management.
    items = db.get_menu_items(hospital.id, available_only=False)
    return JSONResponse({"menu_items": items, "categories": db.list_menu_categories(hospital.id)})


@router.post("/api/portal/menu-items")
async def portal_create_menu_item(payload: MenuItemPayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_food_ordering(authorization, "food_menu", "write")
    if error:
        return error
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Item name is required."}, status_code=400)
    if payload.price_rupees < 0:
        return JSONResponse({"error": "Price cannot be negative."}, status_code=400)
    if payload.stock_count is not None and payload.stock_count < 0:
        return JSONResponse({"error": "Stock cannot be negative."}, status_code=400)
    image_url, image_error = _clean_image_url(payload.image_url)
    if image_error:
        return JSONResponse({"error": image_error}, status_code=400)
    item = db.create_menu_item(
        hospital.id, name, price_paise=round(payload.price_rupees * 100),
        description=payload.description, category=db.canonical_category(hospital.id, payload.category),
        stock_count=payload.stock_count,
        image_url=image_url, is_available=payload.is_available,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "menu_item.create",
        entity_type="menu_item", entity_id=item["id"], after={"name": name},
    )
    return JSONResponse({"menu_item": item})


@router.put("/api/portal/menu-items/{menu_item_id}")
async def portal_update_menu_item(
    menu_item_id: str, payload: MenuItemPayload, authorization: str | None = Header(default=None),
):
    hospital, error = _require_food_ordering(authorization, "food_menu", "write")
    if error:
        return error
    existing = db.get_menu_item(hospital.id, menu_item_id)
    if existing is None:
        return JSONResponse({"error": "Menu item not found."}, status_code=404)
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Item name is required."}, status_code=400)
    if payload.price_rupees < 0:
        return JSONResponse({"error": "Price cannot be negative."}, status_code=400)
    if payload.stock_count is not None and payload.stock_count < 0:
        return JSONResponse({"error": "Stock cannot be negative."}, status_code=400)
    image_url, image_error = _clean_image_url(payload.image_url)
    if image_error:
        return JSONResponse({"error": image_error}, status_code=400)
    # stock_count only overwrites the live count when the request actually carries it (see update_menu_item).
    item = db.update_menu_item(
        hospital.id, menu_item_id, name=name, price_paise=round(payload.price_rupees * 100),
        description=payload.description, category=db.canonical_category(hospital.id, payload.category),
        is_available=payload.is_available,
        stock_count=payload.stock_count if "stock_count" in payload.model_fields_set else db.KEEP_STOCK,
        image_url=image_url,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "menu_item.update",
        entity_type="menu_item", entity_id=menu_item_id, before=existing, after=item,
    )
    return JSONResponse({"menu_item": item})


@router.post("/api/portal/menu-items/{menu_item_id}/restock")
async def portal_restock_menu_item(
    menu_item_id: str, payload: RestockPayload, authorization: str | None = Header(default=None),
):
    hospital, error = _require_food_ordering(authorization, "food_menu", "write")
    if error:
        return error
    existing = db.get_menu_item(hospital.id, menu_item_id)
    if existing is None:
        return JSONResponse({"error": "Menu item not found."}, status_code=404)
    if not 1 <= payload.add <= _MAX_RESTOCK:
        return JSONResponse({"error": f"Add between 1 and {_MAX_RESTOCK} portions."}, status_code=400)
    if existing["stock_count"] is None:
        return JSONResponse(
            {"error": "This item has unlimited stock. Set a stock count first if you want to track portions."},
            status_code=409,
        )
    item = db.restock_menu_item(hospital.id, menu_item_id, payload.add)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "menu_item.restock",
        entity_type="menu_item", entity_id=menu_item_id,
        before={"stock_count": existing["stock_count"]}, after={"added": payload.add},
    )
    return JSONResponse({"menu_item": item})


@router.post("/api/portal/menu-items/{menu_item_id}/availability")
async def portal_set_menu_item_availability(
    menu_item_id: str, payload: AvailabilityPayload, authorization: str | None = Header(default=None),
):
    hospital, error = _require_food_ordering(authorization, "food_menu", "write")
    if error:
        return error
    existing = db.get_menu_item(hospital.id, menu_item_id)
    if existing is None:
        return JSONResponse({"error": "Menu item not found."}, status_code=404)
    item = db.set_menu_item_availability(hospital.id, menu_item_id, payload.is_available)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "menu_item.availability",
        entity_type="menu_item", entity_id=menu_item_id,
        before={"is_available": existing["is_available"]}, after={"is_available": payload.is_available},
    )
    return JSONResponse({"menu_item": item})


DEFAULT_ORDER_DAYS = 90
MAX_ORDER_DAYS = 3650


@router.get("/api/portal/food-orders")
async def portal_food_orders(
    status: str | None = None, days: int = DEFAULT_ORDER_DAYS, authorization: str | None = Header(default=None),
):
    """The restaurant's orders, newest first. `days` limits how far back the list goes (default 90) so a page
    load never returns every order ever placed; `days=0` means all time."""
    hospital, error = _require_food_ordering(authorization, "food_orders", "view")
    if error:
        return error
    if not 0 <= days <= MAX_ORDER_DAYS:
        return JSONResponse({"error": f"days must be between 0 (all time) and {MAX_ORDER_DAYS}."}, status_code=400)
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    orders = db.list_food_orders(hospital.id, status=status, since=since)
    # The guest's name, as the dashboard and reservations list show it: from their profile at THIS restaurant.
    names = db.get_patient_names_by_phone(hospital.id, [o["phone"] for o in orders])
    return JSONResponse({
        "food_orders": [{**o, "patient_name": names.get(o["phone"])} for o in orders],
        "period_days": days,
    })


@router.get("/api/portal/food-orders/{order_id}")
async def portal_food_order_detail(order_id: int, authorization: str | None = Header(default=None)):
    hospital, error = _require_food_ordering(authorization, "food_orders", "view")
    if error:
        return error
    order = db.get_food_order(hospital.id, order_id)
    if order is None:
        return JSONResponse({"error": "Order not found."}, status_code=404)
    return JSONResponse({"food_order": order})


def _ready_status_for(order: dict) -> str:
    return STATUS_OUT_FOR_DELIVERY if order["fulfillment_type"] == "delivery" else STATUS_READY_FOR_PICKUP


# action name -> (expected_prior_status, new_status) for the straight-line
# transitions ("accept" is handled separately: an online order arrives 'paid', a
# pay-at-restaurant order arrives 'placed'). "mark_ready"'s target depends on fulfillment_type, so
# it's handled separately below rather than forced into this table.
_STRAIGHT_TRANSITIONS = {
    "start_preparing": (STATUS_ACCEPTED, STATUS_PREPARING),
    "complete": (None, STATUS_COMPLETED),  # expected_status resolved per-order below (pickup vs delivery ready state)
}

# cancel is reachable from any of these -- advance_order_status()'s guard
# takes exactly one expected_status, so cancel tries each candidate in turn;
# the first one whose actual current status matches wins (there's only ever
# one that can, since status is a single column).
_CANCELLABLE_FROM = (STATUS_PLACED, STATUS_PAID, STATUS_ACCEPTED, STATUS_PREPARING)

# the two "waiting for the kitchen" states an order can be accepted from
_ACCEPTABLE_FROM = (STATUS_PLACED, STATUS_PAID)


@router.post("/api/portal/food-orders/{order_id}/{action}")
async def portal_advance_food_order(order_id: int, action: str, authorization: str | None = Header(default=None)):
    hospital, error = _require_food_ordering(authorization, "food_orders", "write")
    if error:
        return error
    order = db.get_food_order(hospital.id, order_id)
    if order is None:
        return JSONResponse({"error": "Order not found."}, status_code=404)

    if action == "cancel":
        updated = None
        for expected in _CANCELLABLE_FROM:
            updated = db.advance_order_status(hospital.id, order_id, STATUS_CANCELLED, expected_status=expected)
            if updated is not None:
                break
    elif action == "accept":
        updated = None
        for expected in _ACCEPTABLE_FROM:
            updated = db.advance_order_status(hospital.id, order_id, STATUS_ACCEPTED, expected_status=expected)
            if updated is not None:
                break
    elif action == "mark_ready":
        updated = db.advance_order_status(
            hospital.id, order_id, _ready_status_for(order), expected_status=STATUS_PREPARING,
        )
    elif action == "complete":
        updated = db.advance_order_status(
            hospital.id, order_id, STATUS_COMPLETED, expected_status=_ready_status_for(order),
        )
    elif action in _STRAIGHT_TRANSITIONS:
        expected_status, new_status = _STRAIGHT_TRANSITIONS[action]
        updated = db.advance_order_status(hospital.id, order_id, new_status, expected_status=expected_status)
    else:
        return JSONResponse({"error": f"Unknown action: {action!r}"}, status_code=400)

    if updated is None:
        # Same idempotent-no-op-is-not-an-error contract advance_order_status()
        # itself establishes -- a double-tapped portal button or a stale page
        # (order already moved on) isn't a 500, just a 409 telling the UI to
        # refresh rather than silently pretending it worked.
        return JSONResponse(
            {"error": f"Order is not in a state where '{action}' applies (current status: {order['status']!r})."},
            status_code=409,
        )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", f"food_order.{action}",
        entity_type="food_order", entity_id=str(order_id), before={"status": order["status"]}, after={"status": updated["status"]},
    )
    return JSONResponse({"food_order": updated})
