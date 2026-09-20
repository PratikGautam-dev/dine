# portal/routes/food_ordering.py
"""Food ordering plan, Sub-stage 4 of 4: portal CRUD for the menu catalog
(menu_items) and the order list/detail + kitchen-facing status-transition
actions, gated by the dedicated manage_food_ordering capability.
Structurally cloned from portal/routes/procedures.py (catalog CRUD pattern)
and portal/routes/bookings.py (list/detail + guarded-action pattern).

No separate "reset stock" bulk action -- confirmed as the right scope for
v1 (Sub-stage 1's own design note): stock_count is just another field on
the same PUT /api/portal/menu-items/{id} edit form every other field goes
through, so staff correct today's count the same way they'd correct a
price. A dedicated bulk-reset endpoint would need a stored "default/par
stock level" concept that was deliberately NOT built (flagged as future
scope, time-window/kitchen-capacity availability alongside it)."""
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


_MAX_IMAGE_URL_LENGTH = 2000


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
    return JSONResponse({"menu_items": items})


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
    image_url, image_error = _clean_image_url(payload.image_url)
    if image_error:
        return JSONResponse({"error": image_error}, status_code=400)
    item = db.create_menu_item(
        hospital.id, name, price_paise=round(payload.price_rupees * 100),
        description=payload.description, category=payload.category, stock_count=payload.stock_count,
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
    image_url, image_error = _clean_image_url(payload.image_url)
    if image_error:
        return JSONResponse({"error": image_error}, status_code=400)
    item = db.update_menu_item(
        hospital.id, menu_item_id, name=name, price_paise=round(payload.price_rupees * 100),
        description=payload.description, category=payload.category, is_available=payload.is_available,
        stock_count=payload.stock_count, image_url=image_url,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "menu_item.update",
        entity_type="menu_item", entity_id=menu_item_id, before=existing, after=item,
    )
    return JSONResponse({"menu_item": item})


@router.get("/api/portal/food-orders")
async def portal_food_orders(status: str | None = None, authorization: str | None = Header(default=None)):
    hospital, error = _require_food_ordering(authorization, "food_orders", "view")
    if error:
        return error
    orders = db.list_food_orders(hospital.id, status=status)
    return JSONResponse({"food_orders": orders})


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
