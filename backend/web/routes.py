# web/routes.py
"""Web Storefront's public API (migration 0051) -- a second, unauthenticated-at-the-staff-level
front door into the same food_orders/menu_items data the WhatsApp bot already uses. Every route
here is reachable with no staff session; customer-scoped routes take a customer JWT
(auth/customer_session.py) instead. Security posture, throughout:
  - customer data is always filtered by the TOKEN's phone, never a client-supplied one;
  - restaurant data is always filtered by the slug-resolved hospital_id;
  - prices are always read from the DB, never trusted from the client;
  - an order that isn't this customer's own comes back 404, not 403, so ids can't be probed."""
from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from auth.customer_session import get_current_customer, issue_customer_token
from core.config import get_settings
from core.rate_limit import client_key, is_locked_out, record_failure, reset
from db.connection import IntegrityError
from db.repositories.food_orders import (
    PAYMENT_AT_RESTAURANT, PAYMENT_ONLINE, SOURCE_WEB, STATUS_CANCELLED, STATUS_PENDING_PAYMENT, STATUS_PLACED,
)
from db.repositories.offers import OfferError
from db.repositories.storefront import StorefrontError

router = APIRouter()

_MAX_ITEM_QUANTITY = 20
_MAX_ORDER_LINES = 30


def _require_customer(authorization: str | None) -> tuple[dict | None, JSONResponse | None]:
    customer = get_current_customer(authorization)
    if customer is None:
        return None, JSONResponse({"error": "Please log in again."}, status_code=401)
    return customer, None


# ---------------------------------------------------------------- marketplace

@router.get("/api/public/restaurants")
async def public_restaurants(search: str = "", city: str = "", cuisine: str = ""):
    restaurants = db.list_public_restaurants(search=search or None, city=city or None, cuisine=cuisine or None)
    return JSONResponse({"restaurants": restaurants, "cities": db.list_public_cities()})


@router.get("/api/public/restaurants/{slug}")
async def public_restaurant_detail(slug: str):
    restaurant = db.get_public_restaurant(slug)
    if restaurant is None:
        return JSONResponse({"error": "Restaurant not found."}, status_code=404)
    items = db.get_menu_items(restaurant["hospital_id"], available_only=True)
    by_category: dict[str, list[dict]] = {}
    for item in items:
        by_category.setdefault(item["category"] or "Menu", []).append({
            "id": item["id"], "name": item["name"], "description": item["description"],
            "price_paise": item["price_paise"], "category": item["category"], "image_url": item["image_url"],
            "stock_count": item["stock_count"], "is_combo": item["is_combo"], "combo_item_count": item.get("combo_item_count"),
        })
    categories = [{"name": name, "items": group} for name, group in by_category.items()]
    return JSONResponse({
        "restaurant": restaurant, "categories": categories,
        "delivery_fee_paise": {
            "pickup": 0,
            "delivery": db.get_delivery_fee_paise(restaurant["hospital_id"], "delivery"),
        },
    })


class CouponPreviewPayload(BaseModel):
    code: str = ""
    subtotal_paise: int = 0
    fulfillment_type: str = "pickup"


@router.post("/api/public/restaurants/{slug}/coupon-preview")
async def public_coupon_preview(slug: str, payload: CouponPreviewPayload):
    restaurant = db.get_public_restaurant(slug)
    if restaurant is None:
        return JSONResponse({"error": "Restaurant not found."}, status_code=404)
    try:
        preview = db.preview_offer(restaurant["hospital_id"], payload.code, payload.subtotal_paise, payload.fulfillment_type)
    except OfferError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return JSONResponse({"preview": preview})


# ---------------------------------------------------------------- customer auth

class OtpRequestPayload(BaseModel):
    phone: str = ""


@router.post("/api/public/auth/otp/request")
async def public_otp_request(payload: OtpRequestPayload, request: Request):
    phone = db.normalize_customer_phone(payload.phone)
    if phone is None:
        return JSONResponse({"error": "Enter a valid phone number."}, status_code=400)
    key = f"{client_key('customer_otp', request)}:{phone}"
    if is_locked_out(key):
        return JSONResponse({"error": "Too many attempts. Try again later."}, status_code=429)
    code = db.request_otp(phone)
    body = {"sent": True}
    # The entire "mock" in mock OTP: the plain code is only ever returned to the client while this
    # flag is true. Flip it off (and wire a real SMS sender in request_otp()'s caller) to go live.
    if get_settings().WEB_OTP_MOCK:
        body["mock_code"] = code
    return JSONResponse(body)


class OtpVerifyPayload(BaseModel):
    phone: str = ""
    code: str = ""
    name: str | None = None


@router.post("/api/public/auth/otp/verify")
async def public_otp_verify(payload: OtpVerifyPayload, request: Request):
    phone = db.normalize_customer_phone(payload.phone)
    if phone is None:
        return JSONResponse({"error": "Enter a valid phone number."}, status_code=400)
    key = f"{client_key('customer_otp_verify', request)}:{phone}"
    if is_locked_out(key):
        return JSONResponse({"error": "Too many attempts. Try again later."}, status_code=429)
    if not db.verify_otp(phone, payload.code.strip()):
        record_failure(key)
        return JSONResponse({"error": "That code is wrong or has expired."}, status_code=401)
    reset(key)
    name = (payload.name or "").strip() or None
    token = issue_customer_token(phone, name)
    return JSONResponse({"token": token, "customer": {"phone": phone, "name": name}})


@router.get("/api/public/me")
async def public_me(authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error
    return JSONResponse(customer)


# ---------------------------------------------------------------- orders

class OrderLinePayload(BaseModel):
    menu_item_id: str
    quantity: int = 1


class CreateOrderPayload(BaseModel):
    slug: str = ""
    items: list[OrderLinePayload] = []
    fulfillment_type: str = "pickup"
    delivery_address: str | None = None
    payment_method: str = PAYMENT_ONLINE
    coupon_code: str | None = None
    name: str = ""


@router.post("/api/public/orders")
async def public_create_order(payload: CreateOrderPayload, authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error

    restaurant = db.get_public_restaurant(payload.slug)
    if restaurant is None:
        return JSONResponse({"error": "Restaurant not found."}, status_code=404)
    if not restaurant["is_open"]:
        return JSONResponse({"error": "Restaurant is closed right now."}, status_code=409)
    if payload.fulfillment_type not in ("pickup", "delivery"):
        return JSONResponse({"error": "Choose pickup or delivery."}, status_code=400)
    if payload.fulfillment_type == "delivery" and not (payload.delivery_address or "").strip():
        return JSONResponse({"error": "A delivery address is required."}, status_code=400)
    if payload.payment_method not in (PAYMENT_ONLINE, PAYMENT_AT_RESTAURANT):
        return JSONResponse({"error": "Choose a valid payment method."}, status_code=400)
    if not payload.items:
        return JSONResponse({"error": "Your cart is empty."}, status_code=400)
    if len(payload.items) > _MAX_ORDER_LINES:
        return JSONResponse({"error": "Too many items in one order."}, status_code=400)
    for line in payload.items:
        if not (1 <= line.quantity <= _MAX_ITEM_QUANTITY):
            return JSONResponse({"error": f"Quantity must be between 1 and {_MAX_ITEM_QUANTITY}."}, status_code=400)

    # Prices are computed by create_food_order() itself, from the DB, never from the client -- this
    # subtotal is only for the minimum-order check below.
    menu_by_id = {i["id"]: i for i in db.get_menu_items(restaurant["hospital_id"], available_only=True)}
    subtotal_paise = 0
    for line in payload.items:
        item = menu_by_id.get(line.menu_item_id)
        if item is None:
            return JSONResponse({"error": "One of the items in your cart is no longer available."}, status_code=409)
        subtotal_paise += item["price_paise"] * line.quantity
    if subtotal_paise < restaurant["min_order_paise"]:
        from core.money import format_price
        return JSONResponse(
            {"error": f"Minimum order is {format_price(restaurant['min_order_paise'])}."}, status_code=400,
        )

    try:
        order = db.create_food_order(
            restaurant["hospital_id"], customer["phone"],
            [{"menu_item_id": line.menu_item_id, "quantity": line.quantity} for line in payload.items],
            payload.fulfillment_type, delivery_address=payload.delivery_address,
            patient_name=(payload.name or customer.get("name") or None),
            payment_method=payload.payment_method, coupon_code=payload.coupon_code, source=SOURCE_WEB,
        )
    except IntegrityError as e:
        return JSONResponse({"error": str(e)}, status_code=409)
    except OfferError as e:
        return JSONResponse({"error": str(e)}, status_code=400)

    db.record_audit_log(
        "portal", restaurant["hospital_id"], "web storefront", "food_order.web_placed",
        entity_type="food_order", entity_id=str(order["id"]),
    )
    return JSONResponse({"order": order, "next": "pay" if payload.payment_method == PAYMENT_ONLINE else "track"}, status_code=201)


@router.get("/api/public/orders")
async def public_list_orders(authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error
    return JSONResponse({"orders": db.list_orders_for_phone(customer["phone"])})


@router.get("/api/public/orders/{order_id}")
async def public_order_detail(order_id: int, authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error
    order = db.get_public_order(order_id)
    if order is None or order["phone"] != customer["phone"]:
        return JSONResponse({"error": "Order not found."}, status_code=404)
    return JSONResponse({"order": order})


class MockPayPayload(BaseModel):
    outcome: str = "success"


@router.post("/api/public/orders/{order_id}/mock-pay")
async def public_mock_pay(order_id: int, payload: MockPayPayload, authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error
    order = db.get_public_order(order_id)
    if order is None or order["phone"] != customer["phone"]:
        return JSONResponse({"error": "Order not found."}, status_code=404)

    if payload.outcome == "fail":
        return JSONResponse({"ok": False, "order": order, "error": "Payment failed (simulated). You can try again."})

    updated = db.mark_order_paid_mock(order["hospital_id"], order_id)
    if updated is None:
        return JSONResponse({"error": "This order isn't awaiting payment."}, status_code=409)
    updated["restaurant"] = order["restaurant"]
    return JSONResponse({"ok": True, "order": updated})


@router.post("/api/public/orders/{order_id}/cancel")
async def public_cancel_order(order_id: int, authorization: str | None = Header(default=None)):
    customer, error = _require_customer(authorization)
    if error:
        return error
    order = db.get_public_order(order_id)
    if order is None or order["phone"] != customer["phone"]:
        return JSONResponse({"error": "Order not found."}, status_code=404)
    if order["status"] not in (STATUS_PENDING_PAYMENT, STATUS_PLACED):
        return JSONResponse({"error": "This order can no longer be cancelled."}, status_code=409)
    updated = db.advance_order_status(order["hospital_id"], order_id, STATUS_CANCELLED, expected_status=order["status"])
    if updated is None:
        return JSONResponse({"error": "This order can no longer be cancelled."}, status_code=409)
    updated["restaurant"] = order["restaurant"]
    return JSONResponse({"order": updated})
