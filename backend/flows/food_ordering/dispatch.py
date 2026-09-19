# flows/food_ordering/dispatch.py
"""Food ordering plan, Sub-stage 3 of 4: the flow's real entry point
(start_food_ordering_flow, called from flows/router.py's _start_feature,
key "order_food") and per-state handlers, same _HANDLERS-dict-consulted-by-
the-router shape flows/booking/dispatch.py and flows/patient_identity's own
_HANDLERS already establish.

Flow: category list -> that category's items (paged) -> [item card, when the
dish has a photo] -> cart (Add Item / Checkout / Edit Cart) -> takeaway or
delivery -> [address] -> [name] -> order review -> Confirm (pay at the
restaurant / on delivery -- no card details, no payment processing) or, when
the restaurant has Razorpay set up, Pay online."""
import logging

from db.connection import IntegrityError

from core.money import format_price
from core.translations import t
from core.translations.food_ordering import (
    CART_FULL,
    CART_NOW_EMPTY,
    INVALID_CUSTOMER_NAME,
    INVALID_DELIVERY_ADDRESS,
    ITEM_ADDED_TO_CART,
    ITEM_NO_LONGER_AVAILABLE,
    ITEM_REMOVED_FROM_CART,
    ORDER_CANCELLED_TEXT,
    ORDER_ITEM_UNAVAILABLE,
    ORDER_PLACED_TEXT,
    PAYMENT_LINK_MESSAGE,
    PAYMENT_NOT_CONFIGURED,
    AWAITING_PAYMENT_REMINDER,
)
from core.whatsapp import WhatsAppClient

from flows.food_ordering.messages import (
    _cart_lines_text,
    _resend_current_state,
    _send_cart_action_menu,
    _send_cart_edit_menu,
    _send_customer_name_prompt,
    _send_delivery_address_prompt,
    _send_fulfillment_type_menu,
    _send_item_card,
    _send_item_list,
    _send_menu_entry,
    _send_order_review,
    fulfillment_line,
    pay_note,
)
from flows.food_ordering.state import (
    ADD_ANOTHER_ITEM_ID, BACK_ID, CANCEL_ORDER_ID, CART_REMOVE_ONE_PREFIX, CATEGORY_ID_PREFIX, CHECKOUT_ID,
    CONFIRM_ORDER_ID, DELIVERY_ID, EDIT_CART_ID, ITEM_ADD_ID, MAX_CART_LINES, MORE_ITEMS_ID_PREFIX,
    PAY_ONLINE_ID, PICKUP_ID,
    STATE_AWAITING_CART_ACTION, STATE_AWAITING_CART_EDIT, STATE_AWAITING_CUSTOMER_NAME,
    STATE_AWAITING_DELIVERY_ADDRESS, STATE_AWAITING_FULFILLMENT_TYPE, STATE_AWAITING_ITEM_DETAIL,
    STATE_AWAITING_MENU_BROWSE, STATE_AWAITING_MENU_CATEGORY, STATE_AWAITING_ORDER_REVIEW, STATE_AWAITING_PAYMENT,
    _cart_add_item, _cart_remove_one, _group_by_category, _parse_customer_name,
    _parse_delivery_address,
)

logger = logging.getLogger(__name__)


async def _leave_to_main_menu(wa: WhatsAppClient, sessions, phone: str, hospital_id: int, language: str) -> None:
    """Back / Cancel out of the flow: end the session and show THIS restaurant's own
    main menu (its enabled features, labels and name), not a generic list."""
    from flows.booking.messages import _send_main_menu

    sessions.reset(hospital_id, phone)
    await _send_main_menu(wa, phone, "the restaurant", language, hospital_id=hospital_id)


async def _show_menu(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
) -> None:
    result = await _send_menu_entry(wa, phone, hospital_id, connector, context, language=language)
    if result is None:  # nothing can be ordered right now -- the guest was told; don't strand them
        await _leave_to_main_menu(wa, sessions, phone, hospital_id, language)
        return
    state, new_context = result
    sessions.set(hospital_id, phone, state, new_context)


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
    await _show_menu(wa, sessions, phone, hospital_id, context, connector, language)


async def _handle_awaiting_menu_category(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            await _back_out_of_menu(wa, sessions, phone, hospital_id, context, connector, language)
            return
        if reply["id"].startswith(CATEGORY_ID_PREFIX):
            category = reply["id"][len(CATEGORY_ID_PREFIX):]
            groups = _group_by_category(connector.get_menu_items(hospital_id))
            if category in groups:
                new_context = {**context, "browse_category": category, "browse_page": 0}
                sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, new_context)
                await _send_item_list(wa, phone, groups[category], category, 0, language=language)
                return
    await _show_menu(wa, sessions, phone, hospital_id, context, connector, language)


async def _back_out_of_menu(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
) -> None:
    """Back from the top of the menu: to the cart if the guest already has items
    in it, otherwise out to the restaurant's main menu."""
    if context.get("cart"):
        sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
        await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_CART_ACTION, context, connector, language=language)
        return
    await _leave_to_main_menu(wa, sessions, phone, hospital_id, language)


async def _handle_awaiting_menu_browse(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        reply_id = reply["id"]
        if reply_id == BACK_ID:
            if context.get("single_category"):
                await _back_out_of_menu(wa, sessions, phone, hospital_id, context, connector, language)
            else:
                await _show_menu(wa, sessions, phone, hospital_id, context, connector, language)
            return
        if reply_id.startswith(MORE_ITEMS_ID_PREFIX):
            try:
                page = int(reply_id[len(MORE_ITEMS_ID_PREFIX):])
            except ValueError:
                page = 0
            new_context = {**context, "browse_page": page}
            sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, new_context)
            await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_MENU_BROWSE, new_context, connector, language=language)
            return
        items = connector.get_menu_items(hospital_id)
        item = next((i for i in items if i["id"] == reply_id), None)
        if item is not None:
            if item.get("image_url"):
                sessions.set(hospital_id, phone, STATE_AWAITING_ITEM_DETAIL, {**context, "detail_item_id": item["id"]})
                await _send_item_card(wa, phone, item, language=language)
                return
            await _add_to_cart(wa, sessions, phone, hospital_id, context, item, connector, language)
            return
        stale = connector.get_menu_item(hospital_id, reply_id)
        if stale is not None:  # the dish sold out / was switched off since the list was sent
            await wa.send_text(phone, t(ITEM_NO_LONGER_AVAILABLE, language, item_name=stale["name"]))
    sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
    await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_MENU_BROWSE, context, connector, language=language)


async def _handle_awaiting_item_detail(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
            await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_MENU_BROWSE, context, connector, language=language)
            return
        if reply["id"] == ITEM_ADD_ID:
            items = connector.get_menu_items(hospital_id)
            item = next((i for i in items if i["id"] == context.get("detail_item_id")), None)
            if item is None:
                stale = connector.get_menu_item(hospital_id, context.get("detail_item_id", ""))
                await wa.send_text(phone, t(ITEM_NO_LONGER_AVAILABLE, language, item_name=stale["name"] if stale else ""))
                sessions.set(hospital_id, phone, STATE_AWAITING_MENU_BROWSE, context)
                await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_MENU_BROWSE, context, connector, language=language)
                return
            await _add_to_cart(wa, sessions, phone, hospital_id, context, item, connector, language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_ITEM_DETAIL, context)
    await _resend_current_state(wa, phone, hospital_id, STATE_AWAITING_ITEM_DETAIL, context, connector, language=language)


async def _add_to_cart(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, item: dict, connector, language: str,
) -> None:
    """One tap = one of the dish (no quantity prompt); tapping again adds another."""
    cart = context.get("cart", [])
    if len(cart) >= MAX_CART_LINES and not any(line["menu_item_id"] == item["id"] for line in cart):
        sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
        await wa.send_text(phone, t(CART_FULL, language, max_lines=MAX_CART_LINES))
        await _send_cart_action_menu(wa, phone, cart, language=language)
        return
    new_cart = _cart_add_item(cart, item)
    new_context = {k: v for k, v in {**context, "cart": new_cart}.items() if k != "detail_item_id"}
    sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, new_context)
    await wa.send_text(phone, t(ITEM_ADDED_TO_CART, language, item_name=item["name"]))
    await _send_cart_action_menu(wa, phone, new_cart, language=language)


async def _handle_awaiting_cart_action(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        if reply["id"] in (BACK_ID, ADD_ANOTHER_ITEM_ID):
            await _show_menu(wa, sessions, phone, hospital_id, context, connector, language)
            return
        if reply["id"] == EDIT_CART_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_CART_EDIT, context)
            await _send_cart_edit_menu(wa, phone, context.get("cart", []), language=language)
            return
        if reply["id"] == CANCEL_ORDER_ID:  # from a cart message sent before Cancel moved into Edit Cart
            await _cancel_order(wa, sessions, phone, hospital_id, language)
            return
        if reply["id"] == CHECKOUT_ID:
            if not context.get("cart"):
                await _show_menu(wa, sessions, phone, hospital_id, context, connector, language)
                return
            sessions.set(hospital_id, phone, STATE_AWAITING_FULFILLMENT_TYPE, context)
            await _send_fulfillment_type_menu(wa, phone, language=language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
    await _send_cart_action_menu(wa, phone, context.get("cart", []), language=language)


async def _cancel_order(wa: WhatsAppClient, sessions, phone: str, hospital_id: int, language: str) -> None:
    await wa.send_text(phone, t(ORDER_CANCELLED_TEXT, language))
    await _leave_to_main_menu(wa, sessions, phone, hospital_id, language)


async def _handle_awaiting_cart_edit(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    cart = context.get("cart", [])
    if reply["type"] == "interactive_reply":
        reply_id = reply["id"]
        if reply_id == BACK_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
            await _send_cart_action_menu(wa, phone, cart, language=language)
            return
        if reply_id == CANCEL_ORDER_ID:
            await _cancel_order(wa, sessions, phone, hospital_id, language)
            return
        if reply_id.startswith(CART_REMOVE_ONE_PREFIX):
            menu_item_id = reply_id[len(CART_REMOVE_ONE_PREFIX):]
            line = next((l for l in cart if l["menu_item_id"] == menu_item_id), None)
            if line is not None:
                new_cart = _cart_remove_one(cart, menu_item_id)
                new_context = {**context, "cart": new_cart}
                await wa.send_text(phone, t(ITEM_REMOVED_FROM_CART, language, item_name=line["name"]))
                if not new_cart:
                    await wa.send_text(phone, t(CART_NOW_EMPTY, language))
                    await _show_menu(wa, sessions, phone, hospital_id, new_context, connector, language)
                    return
                sessions.set(hospital_id, phone, STATE_AWAITING_CART_EDIT, new_context)
                await _send_cart_edit_menu(wa, phone, new_cart, language=language)
                return
    sessions.set(hospital_id, phone, STATE_AWAITING_CART_EDIT, context)
    await _send_cart_edit_menu(wa, phone, cart, language=language)


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
    """Shared by both takeaway (straight from AWAITING_FULFILLMENT_TYPE) and
    delivery (after AWAITING_DELIVERY_ADDRESS) -- skips the name prompt if the
    guest's name is already known (active_patient_id resolved at flow start),
    same "never re-ask an already-known guest's name" shape
    _start_booking_flow() establishes. Either way the guest sees the order
    review next; nothing is created until they confirm it there."""
    if context.get("customer_name"):
        await _show_order_review(wa, sessions, phone, hospital_id, context, connector, language)
        return
    sessions.set(hospital_id, phone, STATE_AWAITING_CUSTOMER_NAME, context)
    await _send_customer_name_prompt(wa, phone, language=language)


async def _show_order_review(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
) -> None:
    sessions.set(hospital_id, phone, STATE_AWAITING_ORDER_REVIEW, context)
    await _send_order_review(wa, phone, connector, hospital_id, context, language=language)


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
            await _show_order_review(wa, sessions, phone, hospital_id, {**context, "customer_name": name}, connector, language)
            return
    await wa.send_text(phone, t(INVALID_CUSTOMER_NAME, language))
    sessions.set(hospital_id, phone, STATE_AWAITING_CUSTOMER_NAME, context)
    await _send_customer_name_prompt(wa, phone, language=language)


async def _handle_awaiting_order_review(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    if reply["type"] == "interactive_reply":
        reply_id = reply["id"]
        if reply_id == BACK_ID:
            back_state = STATE_AWAITING_DELIVERY_ADDRESS if context.get("fulfillment_type") == "delivery" else STATE_AWAITING_FULFILLMENT_TYPE
            sessions.set(hospital_id, phone, back_state, context)
            await _resend_current_state(wa, phone, hospital_id, back_state, context, connector, language=language)
            return
        if reply_id == EDIT_CART_ID:
            sessions.set(hospital_id, phone, STATE_AWAITING_CART_EDIT, context)
            await _send_cart_edit_menu(wa, phone, context.get("cart", []), language=language)
            return
        if reply_id == CONFIRM_ORDER_ID:
            await _place_order(wa, sessions, phone, hospital_id, context, connector, language, payment_method="pay_at_restaurant")
            return
        if reply_id == PAY_ONLINE_ID and connector.has_online_payment(hospital_id):
            await _place_order(wa, sessions, phone, hospital_id, context, connector, language, payment_method="online")
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_ORDER_REVIEW, context)
    await _send_order_review(wa, phone, connector, hospital_id, context, language=language)


async def _place_order(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, context: dict, connector, language: str,
    payment_method: str,
) -> None:
    """Checkout: creates the real food_orders/food_order_items row
    (connector.create_food_order(), db/repositories/food_orders.py's own
    all-or-nothing stock-guarded transaction). A pay-at-restaurant order is
    complete right there (status 'placed', waiting for the kitchen); an online
    order additionally gets its payment link. Cart context is discarded either
    way once this runs -- a double-tap on anything that reaches this point has
    nothing left in context to re-trigger a second order, same "state leaves
    cart so a double-tap can't reroute" property table_reservation.py's own
    post-booking state gets from create_table_reservation() succeeding."""
    from db.repositories.food_orders import PAYMENT_AT_RESTAURANT, STATUS_CANCELLED, STATUS_PENDING_PAYMENT
    from modules.payments.razorpay_client import RazorpayError

    cart = context.get("cart", [])
    items = [{"menu_item_id": line["menu_item_id"], "quantity": line["quantity"]} for line in cart]
    try:
        order = connector.create_food_order(
            hospital_id, phone, items, context["fulfillment_type"],
            delivery_address=context.get("delivery_address"), patient_name=context.get("customer_name"),
            patient_id=context.get("active_patient_id"), payment_method=payment_method,
        )
    except IntegrityError as exc:
        logger.info("food order checkout failed for hospital=%s phone=%s: %s", hospital_id, phone, exc)
        sessions.set(hospital_id, phone, STATE_AWAITING_CART_ACTION, context)
        await wa.send_text(phone, t(ORDER_ITEM_UNAVAILABLE, language, reason=str(exc)))
        await _send_cart_action_menu(wa, phone, cart, language=language)
        return

    if payment_method == PAYMENT_AT_RESTAURANT:
        sessions.reset(hospital_id, phone)
        await wa.send_text(phone, t(
            ORDER_PLACED_TEXT, language, reference_id=order["reference_id"],
            fulfillment_line=fulfillment_line(order["fulfillment_type"], order["delivery_address"], language),
            items_lines=_cart_lines_text(cart, language=language), total=format_price(order["total_paise"]),
            payment_note=pay_note(order["fulfillment_type"], language),
        ))
        return

    try:
        payment = await connector.create_food_order_payment(hospital_id, order["id"])
    except RazorpayError:
        logger.warning("Razorpay unavailable for hospital=%s, food_order=%s -- cancelling it", hospital_id, order["id"])
        # cancelling gives the reserved stock back
        connector.advance_food_order_status(hospital_id, order["id"], STATUS_CANCELLED, STATUS_PENDING_PAYMENT)
        sessions.reset(hospital_id, phone)
        await wa.send_text(phone, t(PAYMENT_NOT_CONFIGURED, language))
        return

    sessions.set(hospital_id, phone, STATE_AWAITING_PAYMENT, {
        "order_id": order["id"], "reference_id": order["reference_id"],
    })
    await wa.send_text(phone, t(
        PAYMENT_LINK_MESSAGE, language, reference_id=order["reference_id"],
        total=format_price(order["total_paise"]), payment_link_url=payment["payment_link_url"],
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
    STATE_AWAITING_MENU_CATEGORY: _handle_awaiting_menu_category,
    STATE_AWAITING_MENU_BROWSE: _handle_awaiting_menu_browse,
    STATE_AWAITING_ITEM_DETAIL: _handle_awaiting_item_detail,
    STATE_AWAITING_CART_ACTION: _handle_awaiting_cart_action,
    STATE_AWAITING_CART_EDIT: _handle_awaiting_cart_edit,
    STATE_AWAITING_FULFILLMENT_TYPE: _handle_awaiting_fulfillment_type,
    STATE_AWAITING_DELIVERY_ADDRESS: _handle_awaiting_delivery_address,
    STATE_AWAITING_CUSTOMER_NAME: _handle_awaiting_customer_name,
    STATE_AWAITING_ORDER_REVIEW: _handle_awaiting_order_review,
    STATE_AWAITING_PAYMENT: _handle_awaiting_payment,
}
