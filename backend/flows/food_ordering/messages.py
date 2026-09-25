# flows/food_ordering/messages.py
"""Food ordering plan, Sub-stage 3 of 4: menu builders for every step, plus
_resend_current_state() -- the single re-send point every Back-navigation
branch below calls through, so a fix to one step's prompt never needs a
second copy edited elsewhere. (flows/booking/messages.py's own
_resend_menu_for_state() was found MISSING branches for two states during
the table-reservation build -- routing every Back through one function here
instead of hand-rolling each branch is a deliberate structural guard against
that exact class of bug recurring.)

Every price shown to a guest goes through core.money.format_price (exact
paise, never truncated). WhatsApp lists hold at most 10 rows, so the menu is
browsed category-first and paged, which keeps every item reachable."""
import logging

from core.money import format_price
from core.translations import t
from core.translations.common import BACK_OPTION
from core.translations.food_ordering import (
    ADD_ANOTHER_ITEM_BUTTON,
    ADD_TO_CART_BUTTON,
    ASK_CUSTOMER_NAME,
    ASK_DELIVERY_ADDRESS,
    ASK_EDIT_CART,
    ASK_FULFILLMENT_TYPE,
    ASK_ITEMS_IN_CATEGORY,
    ASK_MENU_CATEGORY,
    CANCEL_ORDER_BUTTON,
    CART_EMPTY_LINE,
    CART_SUMMARY,
    CATEGORY_ITEM_COUNT,
    CHECKOUT_BUTTON,
    CONFIRM_ORDER_BUTTON,
    COUPON_HINT_LINE,
    DELIVERY_BUTTON,
    DELIVERY_FEE_LABEL,
    DISCOUNT_LABEL,
    EDIT_CART_BUTTON,
    EDIT_CART_ITEMS_SECTION,
    EDIT_CART_OTHER_SECTION,
    EDIT_CART_ROW_DESC,
    MENU_SECTION_TITLE,
    MORE_ITEMS_ROW,
    MORE_ITEMS_ROW_DESC,
    NO_MENU_ITEMS_AVAILABLE,
    ORDER_REVIEW_HEADING,
    OTHER_CATEGORY,
    PAY_NOTE_DELIVERY,
    PAY_NOTE_TAKEAWAY,
    PAY_AT_RESTAURANT_BUTTON,
    PAY_ON_DELIVERY_BUTTON,
    PAY_ONLINE_BUTTON,
    PICKUP_BUTTON,
    REVIEW_DELIVERY_LINE,
    REVIEW_NAME_LINE,
    REVIEW_TAKEAWAY_LINE,
    SUBTOTAL_LABEL,
    TOTAL_LABEL,
    VIEW_MENU_BUTTON,
)
from core.whatsapp import WhatsAppClient

from flows.common import cap_rows
from flows.food_ordering.state import (
    ADD_ANOTHER_ITEM_ID, BACK_ID, CART_REMOVE_ONE_PREFIX, CATEGORY_ID_PREFIX, CONFIRM_ORDER_ID, DELIVERY_ID,
    EDIT_CART_ID, CANCEL_ORDER_ID, CHECKOUT_ID, ITEM_ADD_ID, MORE_ITEMS_ID_PREFIX, PAY_ONLINE_ID, PICKUP_ID,
    ROWS_PER_PAGE,
    STATE_AWAITING_CART_ACTION, STATE_AWAITING_CART_EDIT, STATE_AWAITING_CUSTOMER_NAME,
    STATE_AWAITING_DELIVERY_ADDRESS, STATE_AWAITING_FULFILLMENT_TYPE, STATE_AWAITING_ITEM_DETAIL,
    STATE_AWAITING_MENU_BROWSE, STATE_AWAITING_MENU_CATEGORY, STATE_AWAITING_ORDER_REVIEW,
    _cart_total_paise, _group_by_category,
)

logger = logging.getLogger(__name__)

# WhatsApp limits: row title 24, row description 72, button title 20, button body 1024.
_ROW_TITLE_MAX = 24
_ROW_DESC_MAX = 72
_BUTTON_BODY_MAX = 1024


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


async def _send_back_button(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    """Same shape flows/booking/messages.py's own _send_back_button()
    establishes -- see that function's docstring for why this is a separate
    follow-up buttons message rather than a row folded into the list."""
    await wa.send_buttons(to=phone, body_text="​", buttons=[{"id": BACK_ID, "title": t(BACK_OPTION, language)}])


def _cart_lines_text(cart: list[dict], language: str = "en") -> str:
    if not cart:
        return t(CART_EMPTY_LINE, language)
    return "\n".join(
        f"{line['quantity']}x {line['name']} — {format_price(line['unit_price_paise'] * line['quantity'])}"
        for line in cart
    )


def _category_label(category: str, language: str) -> str:
    return category or t(OTHER_CATEGORY, language)


async def _send_category_list(wa: WhatsAppClient, phone: str, items: list[dict], language: str = "en") -> None:
    groups = _group_by_category(items)
    rows = [
        {
            "id": f"{CATEGORY_ID_PREFIX}{category}",
            "title": _truncate(_category_label(category, language), _ROW_TITLE_MAX),
            "description": t(CATEGORY_ITEM_COUNT, language, count=len(group)),
        }
        for category, group in groups.items()
    ]
    rows = cap_rows(rows, "food_ordering categories")  # >10 categories is far beyond a normal menu
    await wa.send_list(
        to=phone, body_text=t(ASK_MENU_CATEGORY, language), button_text=t(VIEW_MENU_BUTTON, language),
        sections=[{"title": t(MENU_SECTION_TITLE, language), "rows": rows}],
    )
    await _send_back_button(wa, phone, language=language)


def _item_row(item: dict) -> dict:
    description = format_price(item["price_paise"])
    if item.get("description"):
        description = f"{description} · {item['description']}"
    return {
        "id": item["id"], "title": _truncate(item["name"], _ROW_TITLE_MAX),
        "description": _truncate(description, _ROW_DESC_MAX),
    }


def page_bounds(total: int, page: int) -> tuple[int, int, bool]:
    """(start, end, has_more) for a page of a category's items. A category that
    fits in one list (<=10 items) is shown whole; a longer one is paged 9 at a time
    with a "More" row, so no item is ever unreachable."""
    if total <= ROWS_PER_PAGE + 1:
        return 0, total, False
    start = page * ROWS_PER_PAGE
    if start >= total:
        start, page = 0, 0
    end = min(start + ROWS_PER_PAGE, total)
    return start, end, end < total


async def _send_item_list(
    wa: WhatsAppClient, phone: str, items: list[dict], category: str, page: int, language: str = "en",
) -> None:
    start, end, has_more = page_bounds(len(items), page)
    rows = [_item_row(i) for i in items[start:end]]
    if has_more:
        rows.append({
            "id": f"{MORE_ITEMS_ID_PREFIX}{end // ROWS_PER_PAGE}",
            "title": t(MORE_ITEMS_ROW, language), "description": t(MORE_ITEMS_ROW_DESC, language),
        })
    body = t(ASK_ITEMS_IN_CATEGORY, language, category=_category_label(category, language))
    await wa.send_list(
        to=phone, body_text=body, button_text=t(VIEW_MENU_BUTTON, language),
        sections=[{"title": _truncate(_category_label(category, language), _ROW_TITLE_MAX), "rows": rows}],
    )
    await _send_back_button(wa, phone, language=language)


async def _send_item_card(wa: WhatsAppClient, phone: str, item: dict, language: str = "en") -> None:
    """A dish with a photo: image header, name/price/description, Add to cart.
    If Meta can't fetch the link the same card goes out as plain text, so a bad
    URL never blocks ordering."""
    body = f"*{item['name']}* — {format_price(item['price_paise'])}"
    if item.get("description"):
        body += f"\n{item['description']}"
    body = _truncate(body, _BUTTON_BODY_MAX)
    buttons = [
        {"id": ITEM_ADD_ID, "title": t(ADD_TO_CART_BUTTON, language)},
        {"id": BACK_ID, "title": t(BACK_OPTION, language)},
    ]
    ok = await wa.send_buttons(to=phone, body_text=body, buttons=buttons, header_image_url=item["image_url"])
    if ok is False:
        logger.warning("food_ordering: image header rejected for menu item %s -- sending the card as text", item["id"])
        await wa.send_buttons(to=phone, body_text=body, buttons=buttons)


async def _send_menu_entry(
    wa: WhatsAppClient, phone: str, hospital_id: int, connector, context: dict, language: str = "en",
) -> tuple[str, dict] | None:
    """Shows the category list -- or, for a single-category menu, that category's
    items directly. Returns the (state, context) the session should now be in,
    or None (after telling the guest) when nothing can be ordered right now."""
    items = connector.get_menu_items(hospital_id)
    if not items:
        await wa.send_text(phone, t(NO_MENU_ITEMS_AVAILABLE, language))
        return None
    groups = _group_by_category(items)
    if len(groups) == 1:
        category = next(iter(groups))
        await _send_item_list(wa, phone, groups[category], category, 0, language=language)
        return STATE_AWAITING_MENU_BROWSE, {**context, "browse_category": category, "browse_page": 0, "single_category": True}
    await _send_category_list(wa, phone, items, language=language)
    return STATE_AWAITING_MENU_CATEGORY, {**context, "single_category": False}


async def _send_cart_action_menu(wa: WhatsAppClient, phone: str, cart: list[dict], language: str = "en") -> None:
    body = t(CART_SUMMARY, language, cart_lines=_cart_lines_text(cart, language=language), total=format_price(_cart_total_paise(cart)))
    await wa.send_buttons(
        to=phone, body_text=_truncate(body, _BUTTON_BODY_MAX),
        buttons=[
            {"id": ADD_ANOTHER_ITEM_ID, "title": t(ADD_ANOTHER_ITEM_BUTTON, language)},
            {"id": CHECKOUT_ID, "title": t(CHECKOUT_BUTTON, language)},
            {"id": EDIT_CART_ID, "title": t(EDIT_CART_BUTTON, language)},
        ],
    )
    await _send_back_button(wa, phone, language=language)


async def _send_cart_edit_menu(wa: WhatsAppClient, phone: str, cart: list[dict], language: str = "en") -> None:
    """Each cart line is a row; tapping it removes one of that item (the last
    one removes the line). Cancel Order lives here, out of the way of Checkout."""
    line_rows = [
        {
            "id": f"{CART_REMOVE_ONE_PREFIX}{line['menu_item_id']}",
            "title": _truncate(f"➖ {line['name']}", _ROW_TITLE_MAX),
            "description": _truncate(t(
                EDIT_CART_ROW_DESC, language, quantity=line["quantity"],
                unit_price=format_price(line["unit_price_paise"]),
                line_total=format_price(line["unit_price_paise"] * line["quantity"]),
            ), _ROW_DESC_MAX),
        }
        for line in cart
    ]
    await wa.send_list(
        to=phone,
        body_text=_truncate(
            f"{t(CART_SUMMARY, language, cart_lines=_cart_lines_text(cart, language=language), total=format_price(_cart_total_paise(cart)))}"
            f"\n\n{t(ASK_EDIT_CART, language)}", 1024,
        ),
        button_text=t(EDIT_CART_BUTTON, language),
        sections=[
            {"title": t(EDIT_CART_ITEMS_SECTION, language), "rows": line_rows},
            {"title": t(EDIT_CART_OTHER_SECTION, language), "rows": [
                {"id": CANCEL_ORDER_ID, "title": t(CANCEL_ORDER_BUTTON, language)},
            ]},
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


def fulfillment_line(fulfillment_type: str, delivery_address: str | None, language: str = "en") -> str:
    """One line naming how the order reaches the guest ("Takeaway" /
    "Delivery: <address>"), with its trailing newline. Shared by the review
    step, the placed-order message and the Razorpay confirmation."""
    if fulfillment_type == "delivery":
        return f"{t(DELIVERY_BUTTON, language)}: {delivery_address}\n"
    return f"{t(PICKUP_BUTTON, language)}\n"


def pay_note(fulfillment_type: str, language: str = "en") -> str:
    return t(PAY_NOTE_DELIVERY if fulfillment_type == "delivery" else PAY_NOTE_TAKEAWAY, language)


async def _send_order_review(
    wa: WhatsAppClient, phone: str, connector, hospital_id: int, context: dict, language: str = "en",
) -> None:
    """The last look before an order exists: every line with its total, how it
    reaches the guest, the delivery fee and the grand total -- the same numbers
    create_food_order() will then record. Online payment is offered only when the
    restaurant has it set up; otherwise the choice is just Confirm / Edit Cart."""
    cart = context.get("cart", [])
    fulfillment_type = context["fulfillment_type"]
    subtotal = _cart_total_paise(cart)
    fee = connector.get_delivery_fee_paise(hospital_id, fulfillment_type)

    coupon = context.get("coupon")  # {"code": str, "offer_id": int, "discount_paise": int} or None
    discount = coupon["discount_paise"] if coupon else 0

    lines = [t(ORDER_REVIEW_HEADING, language), "", _cart_lines_text(cart, language=language), ""]
    if fee or discount:
        lines.append(f"{t(SUBTOTAL_LABEL, language)}: {format_price(subtotal)}")
        if discount:
            lines.append(f"{t(DISCOUNT_LABEL, language, code=coupon['code'])}: -{format_price(discount)}")
        if fee:
            lines.append(f"{t(DELIVERY_FEE_LABEL, language)}: {format_price(fee)}")
    lines.append(f"*{t(TOTAL_LABEL, language)}: {format_price(max(0, subtotal - discount) + (fee or 0))}*")
    lines.append("")
    if not coupon:
        lines.append(t(COUPON_HINT_LINE, language))
        lines.append("")
    if fulfillment_type == "delivery":
        lines.append(t(REVIEW_DELIVERY_LINE, language, address=context.get("delivery_address", "")))
    else:
        lines.append(t(REVIEW_TAKEAWAY_LINE, language))
    if context.get("customer_name"):
        lines.append(t(REVIEW_NAME_LINE, language, name=context["customer_name"]))
    lines.append("")
    lines.append(pay_note(fulfillment_type, language))

    if connector.has_online_payment(hospital_id):
        pay_later = PAY_ON_DELIVERY_BUTTON if fulfillment_type == "delivery" else PAY_AT_RESTAURANT_BUTTON
        buttons = [
            {"id": CONFIRM_ORDER_ID, "title": t(pay_later, language)},
            {"id": PAY_ONLINE_ID, "title": t(PAY_ONLINE_BUTTON, language)},
            {"id": EDIT_CART_ID, "title": t(EDIT_CART_BUTTON, language)},
        ]
    else:
        buttons = [
            {"id": CONFIRM_ORDER_ID, "title": t(CONFIRM_ORDER_BUTTON, language)},
            {"id": EDIT_CART_ID, "title": t(EDIT_CART_BUTTON, language)},
        ]
    await wa.send_buttons(to=phone, body_text=_truncate("\n".join(lines), _BUTTON_BODY_MAX), buttons=buttons)
    await _send_back_button(wa, phone, language=language)


async def _resend_current_state(
    wa: WhatsAppClient, phone: str, hospital_id: int, state: str, context: dict, connector, language: str = "en",
) -> None:
    """The one re-send point every Back-navigation branch in dispatch.py
    calls through -- adding a new state here means adding exactly one
    branch, in exactly one place, so it can't silently go missing the way
    flows/booking/messages.py's _resend_menu_for_state() once did for two
    states (found during the table-reservation build's back-navigation
    tests). The menu states re-read the live menu, so a dish that sold out
    meanwhile disappears from what is re-sent."""
    if state in (STATE_AWAITING_MENU_CATEGORY, STATE_AWAITING_MENU_BROWSE, STATE_AWAITING_ITEM_DETAIL):
        items = connector.get_menu_items(hospital_id)
        groups = _group_by_category(items)
        category = context.get("browse_category")
        if state == STATE_AWAITING_MENU_CATEGORY and len(groups) > 1:
            await _send_category_list(wa, phone, items, language=language)
        elif state == STATE_AWAITING_ITEM_DETAIL and any(i["id"] == context.get("detail_item_id") for i in items):
            item = next(i for i in items if i["id"] == context.get("detail_item_id"))
            await _send_item_card(wa, phone, item, language=language)
        elif category in groups:
            await _send_item_list(wa, phone, groups[category], category, context.get("browse_page", 0), language=language)
        elif items:
            await _send_category_list(wa, phone, items, language=language)
        else:
            await wa.send_text(phone, t(NO_MENU_ITEMS_AVAILABLE, language))
    elif state == STATE_AWAITING_CART_ACTION:
        await _send_cart_action_menu(wa, phone, context.get("cart", []), language=language)
    elif state == STATE_AWAITING_CART_EDIT:
        await _send_cart_edit_menu(wa, phone, context.get("cart", []), language=language)
    elif state == STATE_AWAITING_FULFILLMENT_TYPE:
        await _send_fulfillment_type_menu(wa, phone, language=language)
    elif state == STATE_AWAITING_DELIVERY_ADDRESS:
        await _send_delivery_address_prompt(wa, phone, language=language)
    elif state == STATE_AWAITING_CUSTOMER_NAME:
        await _send_customer_name_prompt(wa, phone, language=language)
    elif state == STATE_AWAITING_ORDER_REVIEW:
        await _send_order_review(wa, phone, connector, hospital_id, context, language=language)
