# flows/food_ordering/state.py
"""Food ordering plan, Sub-stage 3 of 4: session-state constants and row-id
helpers, same split-out-pure-constants shape flows/booking/state.py already
establishes for its own state machine -- this package's own, since food
ordering is a genuinely separate top-level feature (flows/patient_identity/
menu.py's _FEATURE_MENU, key "order_food"), not a booking TypeFlow.

Cart lives in the session's own `context["cart"]` (a list of
{"menu_item_id", "name", "unit_price_paise", "quantity"}) until checkout,
same "in-progress state lives in context until the real DB row is created"
shape flows/booking/types/table_reservation.py's own party_size/date/time
context fields already use before create_table_reservation() runs."""
# Category-first browse: AWAITING_MENU_CATEGORY (the category list) -> AWAITING_MENU_BROWSE
# (one category's items, paged) -> AWAITING_ITEM_DETAIL (a dish with a photo).
STATE_AWAITING_MENU_CATEGORY = "AWAITING_MENU_CATEGORY"
STATE_AWAITING_MENU_BROWSE = "AWAITING_MENU_BROWSE"
STATE_AWAITING_ITEM_DETAIL = "AWAITING_ITEM_DETAIL"
STATE_AWAITING_CART_ACTION = "AWAITING_CART_ACTION"
STATE_AWAITING_CART_EDIT = "AWAITING_CART_EDIT"
STATE_AWAITING_FULFILLMENT_TYPE = "AWAITING_FULFILLMENT_TYPE"
STATE_AWAITING_DELIVERY_ADDRESS = "AWAITING_DELIVERY_ADDRESS"
STATE_AWAITING_CUSTOMER_NAME = "AWAITING_CUSTOMER_NAME"
STATE_AWAITING_ORDER_REVIEW = "AWAITING_ORDER_REVIEW"
STATE_AWAITING_PAYMENT = "AWAITING_PAYMENT"

# Free-text states -- exempted from the reset-keyword short-circuit at the
# router level, same reasoning flows/booking/state.py's own
# FREE_TEXT_INPUT_STATES gives for patient name/age/address: a delivery
# address or a customer name could itself start with a word this app
# otherwise treats as a reset keyword.
FREE_TEXT_INPUT_STATES = {STATE_AWAITING_DELIVERY_ADDRESS, STATE_AWAITING_CUSTOMER_NAME}

BACK_ID = "food_nav_back"

ADD_ANOTHER_ITEM_ID = "cart_add_more"
CHECKOUT_ID = "cart_checkout"
CANCEL_ORDER_ID = "cart_cancel_order"
EDIT_CART_ID = "cart_edit"
CART_REMOVE_ONE_PREFIX = "cart_dec:"

CATEGORY_ID_PREFIX = "food_cat:"
MORE_ITEMS_ID_PREFIX = "food_more:"
ITEM_ADD_ID = "food_item_add"

CONFIRM_ORDER_ID = "order_confirm"  # confirm and pay at the restaurant / on delivery
PAY_ONLINE_ID = "order_pay_online"

# WhatsApp lists hold 10 rows in total. A page shows 9 items plus a "More" row; the
# cart-edit list shows one row per distinct line plus "Cancel Order".
ROWS_PER_PAGE = 9
MAX_CART_LINES = 8

PICKUP_ID = "fulfillment_pickup"
DELIVERY_ID = "fulfillment_delivery"

MIN_CUSTOMER_NAME_LENGTH = 2
MAX_CUSTOMER_NAME_LENGTH = 100
MIN_DELIVERY_ADDRESS_LENGTH = 5


def _cart_add_item(cart: list[dict], item: dict) -> list[dict]:
    """Increments quantity if `item` (by menu_item_id) is already in the
    cart, else appends a new line -- a guest tapping the same menu row twice
    is "2 of this item", not two separate lines. Returns a NEW list (same
    "never mutate context in place" discipline every session-context helper
    in this codebase follows, e.g. flows/booking/state.py's _push_history)."""
    new_cart = [dict(line) for line in cart]
    for line in new_cart:
        if line["menu_item_id"] == item["id"]:
            line["quantity"] += 1
            return new_cart
    new_cart.append({
        "menu_item_id": item["id"], "name": item["name"], "unit_price_paise": item["price_paise"], "quantity": 1,
    })
    return new_cart


def _cart_remove_one(cart: list[dict], menu_item_id: str) -> list[dict]:
    """One fewer of a line; a line at quantity 1 is removed. Returns a new list."""
    new_cart = []
    for line in cart:
        if line["menu_item_id"] == menu_item_id:
            if line["quantity"] > 1:
                new_cart.append({**line, "quantity": line["quantity"] - 1})
            continue
        new_cart.append(dict(line))
    return new_cart


def _group_by_category(items: list[dict]) -> dict[str, list[dict]]:
    """{category: items} in menu order. Uncategorised items share the "" key."""
    groups: dict[str, list[dict]] = {}
    for item in items:
        groups.setdefault((item.get("category") or "").strip(), []).append(item)
    return groups


def _cart_total_paise(cart: list[dict]) -> int:
    return sum(line["unit_price_paise"] * line["quantity"] for line in cart)


def _parse_customer_name(text: str) -> str | None:
    text = text.strip()
    if not (MIN_CUSTOMER_NAME_LENGTH <= len(text) <= MAX_CUSTOMER_NAME_LENGTH):
        return None
    return text


def _parse_delivery_address(text: str) -> str | None:
    text = text.strip()
    if len(text) < MIN_DELIVERY_ADDRESS_LENGTH:
        return None
    return text
