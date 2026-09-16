# flows/food_ordering/dispatch.py
"""Food ordering plan, Sub-stage 3 of 4: the flow's real entry point
(start_food_ordering_flow, called from flows/router.py's _start_feature,
key "order_food") and per-state handlers, same _HANDLERS-dict-consulted-by-
the-router shape flows/booking/dispatch.py and flows/patient_identity's own
_HANDLERS already establish."""
import logging

from db.connection import IntegrityError

from core.translations import t
from core.translations.food_ordering import (
    INVALID_CUSTOMER_NAME,
    INVALID_DELIVERY_ADDRESS,
    ITEM_ADDED_TO_CART,
    ORDER_CANCELLED_TEXT,
    ORDER_ITEM_UNAVAILABLE,
    PAYMENT_LINK_MESSAGE,
    PAYMENT_NOT_CONFIGURED,
    AWAITING_PAYMENT_REMINDER,
)
from core.whatsapp import WhatsAppClient

from flows.food_ordering.messages import (
    _resend_current_state,
    _send_cart_action_menu,
    _send_customer_name_prompt,
    _send_delivery_address_prompt,
    _send_fulfillment_type_menu,
    _send_menu_browse,
)
from flows.food_ordering.state import (
    BACK_ID, CANCEL_ORDER_ID, CHECKOUT_ID, DELIVERY_ID, PICKUP_ID, ADD_ANOTHER_ITEM_ID,
    STATE_AWAITING_CART_ACTION, STATE_AWAITING_CUSTOMER_NAME, STATE_AWAITING_DELIVERY_ADDRESS,
    STATE_AWAITING_FULFILLMENT_TYPE, STATE_AWAITING_MENU_BROWSE, STATE_AWAITING_PAYMENT,
    _cart_add_item, _cart_total_paise, _parse_customer_name, _parse_delivery_address,
)

logger = logging.getLogger(__name__)


async def start_food_ordering_flow(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, connector, language: str = "en",
    active_patient_id: int | None = None,
) -> None:
    """Same "active_patient_id resolved once up front, skip straight past
    identity collection" shape flows/booking/book.py's own
    _start_booking_flow() establishes -- if a patient is already linked to
    this phone, its name is carried into context immediately and the
    AWAITING_CUSTOMER_NAME step is skipped later at checkout, never
    re-asked for an already-known guest."""
    context: dict = {"cart": []}
    if active_patient_id is not None:
        patients = connector.list_active_patients(hospital_id, phone)
        match = next((p for p in patients if p["id"] == active_patient_id), None)
        if match is not None:
            context["active_patient_id"] = match["id"]
            context["customer_name"] = match["name"]
    sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
    await _send_menu_browse(wa, phone, hospital_id, connector, language=language)


async def _handle_awaiting_menu_browse(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    from flows.patient_identity import _send_dynamic_menu, REAL_FEATURES

    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            sessions.reset(hospital_id, phone)
            await _send_dynamic_menu(wa, phone, "the restaurant", list(REAL_FEATURES), language=language)
            return
        items = connector.get_menu_items(hospital_id)
        item = next((i for i in items if i["id"] == reply["id"]), None)
        if item is not None:
            new_cart = _cart_add_item(context.get("cart", []), item)
            new_context = {**context, "cart": new_cart}
            sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, new_context)
            await wa.send_text(phone, t(ITEM_ADDED_TO_CART, language, item_name=item["name"]))
            await _send_cart_action_menu(wa, phone, new_cart, language=language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
    await _send_menu_browse(wa, phone, hospital_id, connector, language=language)


async def _handle_awaiting_cart_action(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
            await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_MENU_BROWSE, context, connector, language=language)
            return
        if reply["id"] == ADD_ANOTHER_ITEM_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
            await _send_menu_browse(wa, phone, hospital_id, connector, language=language)
            return
        if reply["id"] == CANCEL_ORDER_ID:
            sessions.reset(hospital_id, phone)
            await wa.send_text(phone, t(ORDER_CANCELLED_TEXT, language))
            from flows.patient_identity import _send_dynamic_menu, REAL_FEATURES
            await _send_dynamic_menu(wa, phone, "the restaurant", list(REAL_FEATURES), language=language)
            return
        if reply["id"] == CHECKOUT_ID:
            if not context.get("cart"):
                sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
                await _send_menu_browse(wa, phone, hospital_id, connector, language=language)
                return
            sessions.set(hospital_id, phone, STATE_AWAITING_FULFILLMENT_TYPE, context)
            await _send_fulfillment_type_menu(wa, phone, language=language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
    await _send_cart_action_menu(wa, phone, context.get("cart", []), language=language)


async def _handle_awaiting_fulfillment_type(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
            await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_CART_ACTION, context, connector, language=language)
            return
        if reply["id"] == PICKUP_ID:
            await _proceed_past_fulfillment(wa, sessions, phone, hospital_id, {**context, "fulfillment_type": "pickup"}, connector, language=language)
            return
        if reply["id"] == DELIVERY_ID:
            new_context = {**context, "fulfillment_type": "delivery"}
            sessions.set(hospital_id, phone, STATE_AWAITING_DELIVERY_ADDRESS, new_context)
            await _send_delivery_address_prompt(wa, phone, language=language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_FULFILLMENT_TYPE, context)
    await _send_fulfillment_type_menu(wa, phone, language=language)


async def _handle_awaiting_delivery_address(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply" and reply["id"] == BACK_ID:
        sessions.set(hospital_id, phone, STATE_AWAITING_FULFILLMENT_TYPE, context)
        await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_FULFILLMENT_TYPE, context, connector, language=language)
        return
    if reply["type"] == "text":
        address = _parse_delivery_address(reply["text"])
        if address is not None:
            await _proceed_past_fulfillment(wa, sessions, phone, hospital_id, {**context, "delivery_address": address}, connector, language=language)
            return
    await wa.send_text(phone, t(INVALID_DELIVERY_ADDRESS, language))
    sessions.set(hospital_id, phone, STATE_AWAITING_DELIVERY_ADDRESS, context)
    await _send_delivery_address_prompt(wa, phone, language=language)


async def _proceed_past_fulfillment(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
) -> None:
    """Shared by both pickup (straight from AWAITING_FULFILLMENT_TYPE) and
    delivery (after AWAITING_DELIVERY_ADDRESS) -- skips straight to checkout
    if the guest's name is already known (active_patient_id resolved at
    flow start), same "never re-ask an already-known guest's name" shape
    _start_booking_flow() establishes."""
    if context.get("customer_name"):
        await _create_order_and_send_payment_link(wa, sessions, phone, hospital_id, context, connector, language=language)
        return
    sessions.set(hospital_id, phone, STATE_AWAITING_CUSTOMER_NAME, context)
    await _send_customer_name_prompt(wa, phone, language=language)


async def _handle_awaiting_customer_name(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply" and reply["id"] == BACK_ID:
        back_state = STATE_AWAITING_DELIVERY_ADDRESS if context.get("fulfillment_type") == "delivery" else STATE_AWAITING_FULFILLMENT_TYPE
        sessions.set(hospital_id, phone, back_state, context)
        await _resend_current_state(wa, phone, hospital_id, back_state, context, connector, language=language)
        return
    if reply["type"] == "text":
        name = _parse_customer_name(reply["text"])
        if name is not None:
            await _create_order_and_send_payment_link(wa, sessions, phone, hospital_id, {**context, "customer_name": name}, connector, language=language)
            return
    await wa.send_text(phone, t(INVALID_CUSTOMER_NAME, language))
    sessions.set(hospital_id, phone, STATE_AWAITING_CUSTOMER_NAME, context)
    await _send_customer_name_prompt(wa, phone, language=language)


async def _create_order_and_send_payment_link(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
) -> None:
    """Checkout: creates the real food_orders/food_order_items row
    (connector.create_food_order(), db/repositories/food_orders.py's own
    all-or-nothing stock-guarded transaction), then initiates payment. Cart
    context is discarded either way once this runs -- a double-tap on
    anything that reaches this point has nothing left in context to
    re-trigger a second order, same "state leaves cart so a double-tap can't
    reroute" property table_reservation.py's own post-booking state gets
    from create_table_reservation() succeeding."""
    from modules.payments.razorpay_client import RazorpayError

    cart = context.get("cart", [])
    items = [{"menu_item_id": line["menu_item_id"], "quantity": line["quantity"]} for line in cart]
    try:
        order = connector.create_food_order(
            hospital_id, phone, items, context["fulfillment_type"],
            delivery_address=context.get("delivery_address"), patient_name=context.get("customer_name"),
            patient_id=context.get("active_patient_id"),
        )
    except IntegrityError as exc:
        logger.info("food order checkout failed for hospital=%s phone=%s: %s", hospital_id, phone, exc)
        sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
        await wa.send_text(phone, t(ORDER_ITEM_UNAVAILABLE, language, reason=str(exc)))
        await _send_cart_action_menu(wa, phone, cart, language=language)
        return

    try:
        payment = await connector.create_food_order_payment(hospital_id, order["id"])
    except RazorpayError:
        logger.warning("Razorpay not configured for hospital=%s, food_order=%s", hospital_id, order["id"])
        sessions.reset(hospital_id, phone)
        await wa.send_text(phone, t(PAYMENT_NOT_CONFIGURED, language))
        return

    sessions.set(hospital_id, phone, STATE_AWAITING_PAYMENT, {
        "order_id": order["id"], "reference_id": order["reference_id"],
    })
    await wa.send_text(phone, t(
        PAYMENT_LINK_MESSAGE, language, reference_id=order["reference_id"],
        total_rupees=order["total_paise"] // 100, payment_link_url=payment["payment_link_url"],
    ))


async def _handle_awaiting_payment(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    """No Back navigation and no re-triggerable action here on purpose --
    the payment link has already been created, and completion is driven by
    webhook/razorpay_routes.py's own webhook handler, not by anything the
    guest types. Any incoming message just gets a reminder."""
    sessions.set(hospital_id, phone, STATE_AWAITING_PAYMENT, context)
    await wa.send_text(phone, t(AWAITING_PAYMENT_REMINDER, language, reference_id=context.get("reference_id", "")))


_HANDLERS = {
    STATE_AWAITING_MENU_BROWSE: _handle_awaiting_menu_browse,
    STATE_AWAITING_CART_ACTION: _handle_awaiting_cart_action,
    STATE_AWAITING_FULFILLMENT_TYPE: _handle_awaiting_fulfillment_type,
    STATE_AWAITING_DELIVERY_ADDRESS: _handle_awaiting_delivery_address,
    STATE_AWAITING_CUSTOMER_NAME: _handle_awaiting_customer_name,
    STATE_AWAITING_PAYMENT: _handle_awaiting_payment,
}
