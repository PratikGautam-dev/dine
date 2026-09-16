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
STATE_AWAITING_MENU_BROWSE = "AWAITING_MENU_BROWSE"
STATE_AWAITING_CART_ACTION = "AWAITING_CART_ACTION"
STATE_AWAITING_FULFILLMENT_TYPE = "AWAITING_FULFILLMENT_TYPE"
STATE_AWAITING_DELIVERY_ADDRESS = "AWAITING_DELIVERY_ADDRESS"
STATE_AWAITING_CUSTOMER_NAME = "AWAITING_CUSTOMER_NAME"
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
