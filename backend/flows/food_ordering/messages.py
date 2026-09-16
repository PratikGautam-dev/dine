# flows/food_ordering/messages.py
"""Food ordering plan, Sub-stage 3 of 4: menu builders for every step, plus
_resend_current_state() -- the single re-send point every Back-navigation
branch below calls through, so a fix to one step's prompt never needs a
second copy edited elsewhere. (flows/booking/messages.py's own
_resend_menu_for_state() was found MISSING branches for two states during
the table-reservation build -- routing every Back through one function here
instead of hand-rolling each branch is a deliberate structural guard against
that exact class of bug recurring.)"""
from core.translations import t
from core.translations.common import BACK_OPTION
from core.translations.food_ordering import (
    ADD_ANOTHER_ITEM_BUTTON,
    ASK_CUSTOMER_NAME,
    ASK_DELIVERY_ADDRESS,
    ASK_FULFILLMENT_TYPE,
    ASK_MENU_BROWSE,
    CANCEL_ORDER_BUTTON,
    CART_EMPTY_LINE,
    CART_SUMMARY,
    CHECKOUT_BUTTON,
    DELIVERY_BUTTON,
    MENU_SECTION_TITLE,
    NO_MENU_ITEMS_AVAILABLE,
    PICKUP_BUTTON,
    VIEW_MENU_BUTTON,
)
from core.whatsapp import WhatsAppClient

from flows.common import cap_rows
from flows.food_ordering.state import (
    ADD_ANOTHER_ITEM_ID, BACK_ID, CANCEL_ORDER_ID, CHECKOUT_ID, DELIVERY_ID, PICKUP_ID,
    STATE_AWAITING_CART_ACTION, STATE_AWAITING_CUSTOMER_NAME, STATE_AWAITING_DELIVERY_ADDRESS,
    STATE_AWAITING_FULFILLMENT_TYPE, STATE_AWAITING_MENU_BROWSE, _cart_total_paise,
)


async def _send_back_button(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    """Same shape flows/booking/messages.py's own _send_back_button()
    establishes -- see that function's docstring for why this is a separate
    follow-up buttons message rather than a row folded into the list."""
    await wa.send_buttons(to=phone, body_text="​", buttons=[{"id": BACK_ID, "title": t(BACK_OPTION, language)}])


def _cart_lines_text(cart: list[dict], language: str = "en") -> str:
    if not cart:
        return t(CART_EMPTY_LINE, language)
    return "\n".join(f"{line['quantity']}x {line['name']} — ₹{line['unit_price_paise'] // 100}" for line in cart)


async def _send_menu_browse(wa: WhatsAppClient, phone: str, hospital_id: int, connector, language: str = "en") -> bool:
    """Returns False (and sends the "nothing available" text instead) if the
    hospital has no available menu items -- same "no resource -> not a
    crash" discipline get_available_table_slots() empty-return already
    establishes for table reservations."""
    items = connector.get_menu_items(hospital_id)
    if not items:
        await wa.send_text(phone, t(NO_MENU_ITEMS_AVAILABLE, language))
        return False
    rows = cap_rows(
        [{"id": i["id"], "title": i["name"][:24], "description": f"₹{i['price_paise'] // 100}"} for i in items],
        "food_ordering menu browse",
    )
    await wa.send_list(
        to=phone, body_text=t(ASK_MENU_BROWSE, language), button_text=t(VIEW_MENU_BUTTON, language),
        sections=[{"title": t(MENU_SECTION_TITLE, language), "rows": rows}],
    )
    await _send_back_button(wa, phone, language=language)
    return True


async def _send_cart_action_menu(wa: WhatsAppClient, phone: str, cart: list[dict], language: str = "en") -> None:
    total_rupees = _cart_total_paise(cart) // 100
    cart_lines = _cart_lines_text(cart, language=language)
    body = t(CART_SUMMARY, language, cart_lines=cart_lines, total_rupees=total_rupees)
    await wa.send_buttons(
        to=phone, body_text=body,
        buttons=[
            {"id": ADD_ANOTHER_ITEM_ID, "title": t(ADD_ANOTHER_ITEM_BUTTON, language)},
            {"id": CHECKOUT_ID, "title": t(CHECKOUT_BUTTON, language)},
            {"id": CANCEL_ORDER_ID, "title": t(CANCEL_ORDER_BUTTON, language)},
        ],
    )
    await _send_back_button(wa, phone, language=language)


async def _send_fulfillment_type_menu(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    await wa.send_buttons(
        to=phone, body_text=t(ASK_FULFILLMENT_TYPE, language),
        buttons=[
            {"id": PICKUP_ID, "title": t(PICKUP_BUTTON, language)},
            {"id": DELIVERY_ID, "title": t(DELIVERY_BUTTON, language)},
        ],
    )
    await _send_back_button(wa, phone, language=language)


async def _send_delivery_address_prompt(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    await wa.send_text(phone, t(ASK_DELIVERY_ADDRESS, language))
    await _send_back_button(wa, phone, language=language)


async def _send_customer_name_prompt(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    await wa.send_text(phone, t(ASK_CUSTOMER_NAME, language))
    await _send_back_button(wa, phone, language=language)


async def _resend_current_state(
    wa: WhatsAppClient, phone: str, hospital_id: int, state: str, context: dict, connector, language: str = "en",
) -> None:
    """The one re-send point every Back-navigation branch in dispatch.py
    calls through -- adding a new state here means adding exactly one
    branch, in exactly one place, so it can't silently go missing the way
    flows/booking/messages.py's _resend_menu_for_state() once did for two
    states (found during the table-reservation build's back-navigation
    tests)."""
    if state == STATE_AWAITING_MENU_BROWSE:
        await _send_menu_browse(wa, phone, hospital_id, connector, language=language)
    elif state == STATE_AWAITING_CART_ACTION:
        await _send_cart_action_menu(wa, phone, context.get("cart", []), language=language)
    elif state == STATE_AWAITING_FULFILLMENT_TYPE:
        await _send_fulfillment_type_menu(wa, phone, language=language)
    elif state == STATE_AWAITING_DELIVERY_ADDRESS:
        await _send_delivery_address_prompt(wa, phone, language=language)
    elif state == STATE_AWAITING_CUSTOMER_NAME:
        await _send_customer_name_prompt(wa, phone, language=language)
