# webhook/razorpay_routes.py
"""Food ordering plan, Sub-stage 2's inbound webhook, extended in Sub-stage 3
to actually notify the guest: once db.handle_razorpay_webhook() confirms a
real pending_payment->paid transition, this sends the WhatsApp order
confirmation and resets the guest's session -- same "reach into the
session/WhatsApp-client layer to finish what the DB-level state change
started" shape flows/booking/book.py's own build_success_summary hook plays
for a normal in-conversation booking confirm, just triggered by an async
webhook instead of the guest's own next message.

Split into its own router/module rather than added to webhook/routes.py,
same reasoning that file's own docstring gives for splitting the HTTP
boundary out of message processing -- this is a genuinely separate
integration (payments, not WhatsApp-inbound) that happens to share the
exact two-phase verification SHAPE, not the same code path.

One shared endpoint for every hospital's Razorpay account, same as the
Meta webhook: db/repositories/food_orders.py's handle_razorpay_webhook()
does the actual two-phase resolve-tenant-then-verify-signature work; this
file is the HTTP boundary + the WhatsApp-send follow-up, mirroring
webhook/routes.py's own receive_message()."""
import json
import logging

from fastapi import APIRouter, Request, Response

import db.repository as db
from core.money import format_price
from core.translations import t
from core.translations.food_ordering import ORDER_CONFIRMED_TEXT
from flows.food_ordering.messages import fulfillment_line
from webhook.dispatch import SESSIONS, _get_whatsapp_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/webhook/razorpay")
async def receive_razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Same "never crash on a payload shape we don't understand, ack 200
    # either way" discipline webhook/routes.py's own receive_message() uses
    # for Meta payloads -- nothing here is usefully retriable by Razorpay if
    # the JSON itself is malformed.
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Razorpay webhook payload is not valid JSON, ignoring")
        return Response(status_code=200)

    try:
        order = db.handle_razorpay_webhook(body, signature, payload)
    except Exception:
        logger.exception("Unexpected error handling Razorpay webhook")
        return Response(status_code=200)

    if order is None:
        logger.info("Razorpay webhook ignored (unroutable, unconfigured, unverifiable, or a non-actionable/already-transitioned event)")
        return Response(status_code=200)

    hospital = db.get_hospital(order["hospital_id"])
    if hospital is None:
        logger.warning("Razorpay webhook resolved a paid order for hospital_id=%s, but that hospital no longer exists", order["hospital_id"])
        return Response(status_code=200)

    session_state = SESSIONS.get(hospital.id, order["phone"])
    language = session_state.get("language") or "en"
    wa = _get_whatsapp_client(hospital)
    await wa.send_text(order["phone"], t(
        ORDER_CONFIRMED_TEXT, language, reference_id=order["reference_id"],
        fulfillment_line=fulfillment_line(order["fulfillment_type"], order["delivery_address"], language),
        total=format_price(order["total_paise"]),
    ))
    # The guest's session was left at STATE_AWAITING_PAYMENT (no further
    # action possible there) -- reset it now so their NEXT message starts a
    # fresh conversation, same "nothing left in context to reroute" property
    # create_food_order()'s own callers already established at checkout.
    SESSIONS.reset(hospital.id, order["phone"])

    return Response(status_code=200)
