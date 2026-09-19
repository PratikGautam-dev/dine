# tests/test_food_ordering_redesign.py
"""Food-ordering redesign: category-first paged menu (every item reachable),
exact prices, item card with a photo header (+ text fallback), Edit Cart,
order review, pay-at-restaurant orders, and the portal side (photo link,
'placed' orders, stock restored on cancel)."""
import json
import os

import pytest

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import connectors  # noqa: E402
import db.repository as db  # noqa: E402
from core.money import format_price  # noqa: E402
from core.session_store import InMemorySessionStore  # noqa: E402
from db.connection import IntegrityError, get_connection  # noqa: E402
from flows.food_ordering import HANDLERS, start_food_ordering_flow  # noqa: E402
from modules.payments.razorpay_client import RazorpayError  # noqa: E402
from tests.test_table_reschedule import FakeWhatsAppClient, _portal_login, _rows, tap  # noqa: E402

PHONE = "5491112345678"
FEATURES = ["book_appointment", "order_food", "reschedule", "cancel"]


class ImageAwareWhatsAppClient(FakeWhatsAppClient):
    """Records the photo header and can simulate Meta refusing the image link."""

    def __init__(self, reject_images: bool = False):
        super().__init__()
        self.reject_images = reject_images

    async def send_buttons(self, to, body_text, buttons, header_text=None, footer_text=None, header_image_url=None):
        self.sent.append(("buttons", {
            "to": to, "body_text": body_text, "buttons": buttons, "header_image_url": header_image_url,
        }))
        return not (header_image_url and self.reject_images)


def _setup(hospital_id, features=FEATURES):
    conn = get_connection()
    conn.execute("UPDATE hospitals SET enabled_features = ? WHERE id = ?", (json.dumps(features), hospital_id))
    conn.commit()
    return connectors.get_connector_for_hospital(db.get_hospital(hospital_id))


def _menu(hospital_id, spec):
    """spec: [(name, rupees_or_paise_tuple, category, kwargs)] -> {name: id}"""
    ids = {}
    for name, price_paise, category, kwargs in spec:
        ids[name] = db.create_menu_item(hospital_id, name, price_paise=price_paise, category=category, **kwargs)["id"]
    return ids


class Guest:
    """Drives the flow like the router does: start once, then feed taps/text to the state handler."""

    def __init__(self, hospital_id, connector, wa=None):
        self.hospital_id, self.connector = hospital_id, connector
        self.wa = wa or ImageAwareWhatsAppClient()
        self.sessions = InMemorySessionStore()

    async def start(self):
        await start_food_ordering_flow(self.wa, self.sessions, PHONE, self.hospital_id, self.connector)

    @property
    def state(self):
        return self.sessions.get(self.hospital_id, PHONE)["state"]

    @property
    def context(self):
        return self.sessions.get(self.hospital_id, PHONE)["context"]

    async def send(self, reply):
        state = self.state
        await HANDLERS[state](
            self.wa, self.sessions, PHONE, self.hospital_id, reply, self.context, self.connector,
        )

    async def tap(self, option_id):
        await self.send(tap(option_id))

    async def text(self, text):
        await self.send({"type": "text", "text": text})

    def last(self, kind):
        """The most recent message of this kind, ignoring the lone follow-up Back button."""
        for k, kwargs in reversed(self.wa.sent):
            if k == "buttons" and [b["id"] for b in kwargs["buttons"]] == ["food_nav_back"]:
                continue
            if k == kind:
                return kwargs
        raise AssertionError(f"no {kind} sent")

    def all_text(self):
        parts = []
        for kind, kwargs in self.wa.sent:
            parts.append(kwargs.get("text") or kwargs.get("body_text") or "")
            if kind == "list":
                parts += [f"{r['title']} {r.get('description', '')}" for r in _rows(kwargs)]
        return "\n".join(parts)


def _real_rows(kwargs):
    return _rows(kwargs)


# --- price formatting -------------------------------------------------------

@pytest.mark.parametrize("paise,expected", [
    (4950, "₹49.50"), (24900, "₹249"), (5, "₹0.05"), (0, "₹0"), (100005, "₹1000.05"), (199, "₹1.99"),
])
def test_format_price_is_exact(paise, expected):
    assert format_price(paise) == expected


# --- browsing: every item reachable -----------------------------------------

@pytest.mark.asyncio
async def test_a_menu_larger_than_ten_rows_is_fully_reachable_by_category(hospital_id):
    connector = _setup(hospital_id)
    spec = [(f"Starter {i:02d}", 10000 + i, "Starters", {}) for i in range(12)]
    spec += [(f"Main {i}", 20000 + i, "Mains", {}) for i in range(5)]
    spec += [("House Water", 3000, None, {})]  # uncategorised
    ids = _menu(hospital_id, spec)
    g = Guest(hospital_id, connector)
    await g.start()

    assert g.state == "AWAITING_MENU_CATEGORY"
    cats = {r["id"]: r["description"] for r in _rows(g.last("list"))}
    assert cats == {"food_cat:Starters": "12 items", "food_cat:Mains": "5 items", "food_cat:": "1 items"} or \
        cats["food_cat:Starters"] == "12 items"
    assert len(cats) == 3

    reached = set()
    await g.tap("food_cat:Starters")
    rows = _rows(g.last("list"))
    assert len(rows) == 10 and rows[-1]["id"].startswith("food_more:")  # 9 items + "More"
    reached |= {r["id"] for r in rows if not r["id"].startswith("food_more:")}
    await g.tap(rows[-1]["id"])
    rows = _rows(g.last("list"))
    assert len(rows) == 3 and not any(r["id"].startswith("food_more:") for r in rows)
    reached |= {r["id"] for r in rows}
    assert reached == {ids[f"Starter {i:02d}"] for i in range(12)}, "every starter must be reachable"

    await g.tap("food_nav_back")
    assert g.state == "AWAITING_MENU_CATEGORY"
    await g.tap("food_cat:")
    assert [r["id"] for r in _rows(g.last("list"))] == [ids["House Water"]]


@pytest.mark.asyncio
async def test_single_category_menu_skips_the_category_step(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Soup", 15000, "Starters", {}), ("Salad", 12000, "Starters", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    assert g.state == "AWAITING_MENU_BROWSE"
    assert {r["id"] for r in _rows(g.last("list"))} == set(ids.values())


@pytest.mark.asyncio
async def test_row_prices_are_exact_never_truncated(hospital_id):
    connector = _setup(hospital_id)
    _menu(hospital_id, [("Masala Chai", 4950, "Drinks", {"description": "Spiced tea"})])
    g = Guest(hospital_id, connector)
    await g.start()
    row = _rows(g.last("list"))[0]
    assert row["description"].startswith("₹49.50") and "Spiced tea" in row["description"]
    assert len(row["title"]) <= 24 and len(row["description"]) <= 72


@pytest.mark.asyncio
async def test_empty_menu_tells_the_guest_and_returns_the_real_main_menu(hospital_id):
    connector = _setup(hospital_id)
    g = Guest(hospital_id, connector)
    await g.start()
    assert "nothing is available" in g.all_text()
    assert g.sessions.get(hospital_id, PHONE) == {"state": "IDLE", "context": {}}
    assert {"menu_order_food", "menu_book"} <= {r["id"] for r in _rows(g.last("list"))}


# --- item card with a photo -------------------------------------------------

@pytest.mark.asyncio
async def test_item_with_photo_shows_a_card_then_adds_one(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Paneer Tikka", 24950, "Starters", {
        "image_url": "https://img.example.com/paneer.jpg", "description": "Char-grilled"})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap(ids["Paneer Tikka"])

    assert g.state == "AWAITING_ITEM_DETAIL"
    card = g.last("buttons")
    assert card["header_image_url"] == "https://img.example.com/paneer.jpg"
    assert "Paneer Tikka" in card["body_text"] and "₹249.50" in card["body_text"] and "Char-grilled" in card["body_text"]
    assert [b["id"] for b in card["buttons"]] == ["food_item_add", "food_nav_back"]

    await g.tap("food_item_add")
    assert g.state == "AWAITING_CART_ACTION"
    assert g.context["cart"] == [{
        "menu_item_id": ids["Paneer Tikka"], "name": "Paneer Tikka", "unit_price_paise": 24950, "quantity": 1,
    }]  # no quantity prompt: exactly one


@pytest.mark.asyncio
async def test_rejected_image_falls_back_to_a_text_card(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Dosa", 9000, "Mains", {"image_url": "https://img.example.com/broken.jpg"})])
    g = Guest(hospital_id, connector, wa=ImageAwareWhatsAppClient(reject_images=True))
    await g.start()
    await g.tap(ids["Dosa"])
    cards = [kw for kind, kw in g.wa.sent if kind == "buttons" and "*Dosa*" in kw["body_text"]]
    assert len(cards) == 2
    assert cards[0]["header_image_url"] and cards[1]["header_image_url"] is None
    assert [b["id"] for b in cards[1]["buttons"]] == ["food_item_add", "food_nav_back"]
    await g.tap("food_item_add")
    assert g.state == "AWAITING_CART_ACTION"


@pytest.mark.asyncio
async def test_item_without_photo_is_added_directly_and_taps_stack(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Naan", 6000, "Breads", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap(ids["Naan"])
    assert g.state == "AWAITING_CART_ACTION" and g.context["cart"][0]["quantity"] == 1
    await g.tap("cart_add_more")
    await g.tap(ids["Naan"])
    assert g.context["cart"][0]["quantity"] == 2
    assert "2x Naan — ₹120" in g.all_text()


@pytest.mark.asyncio
async def test_item_that_sold_out_while_browsing_is_refused_politely(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Special", 5000, "Mains", {"stock_count": 5}), ("Other", 5000, "Mains", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    db.update_menu_item(hospital_id, ids["Special"], "Special", 5000, category="Mains", stock_count=0)
    await g.tap(ids["Special"])
    assert "Special is no longer available" in g.all_text()
    assert g.context["cart"] == [] and g.state == "AWAITING_MENU_BROWSE"


# --- cart: edit, reduce, remove, cancel --------------------------------------

async def _cart_of(g, ids, names):
    await g.start()
    for name in names:
        await g.tap(ids[name])
        await g.tap("cart_add_more")


@pytest.mark.asyncio
async def test_cart_buttons_are_add_checkout_edit_and_cancel_lives_inside_edit(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {}), ("Bun", 3000, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap(ids["Tea"])
    buttons = g.last("buttons")
    assert [b["id"] for b in buttons["buttons"]] == ["cart_add_more", "cart_checkout", "cart_edit"]
    assert all(len(b["title"]) <= 20 for b in buttons["buttons"])
    assert "₹49.50" in buttons["body_text"]

    await g.tap("cart_edit")
    assert g.state == "AWAITING_CART_EDIT"
    rows = _rows(g.last("list"))
    assert [r["id"] for r in rows] == [f"cart_dec:{ids['Tea']}", "cart_cancel_order"]
    assert "1 × ₹49.50 = ₹49.50" in rows[0]["description"]


@pytest.mark.asyncio
async def test_edit_cart_reduces_then_removes_a_line(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {}), ("Bun", 3000, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap(ids["Tea"]); await g.tap("cart_add_more")
    await g.tap(ids["Tea"]); await g.tap("cart_add_more")
    await g.tap(ids["Bun"])
    assert {l["name"]: l["quantity"] for l in g.context["cart"]} == {"Tea": 2, "Bun": 1}

    await g.tap("cart_edit")
    await g.tap(f"cart_dec:{ids['Tea']}")  # 2 -> 1
    assert {l["name"]: l["quantity"] for l in g.context["cart"]} == {"Tea": 1, "Bun": 1}
    assert g.state == "AWAITING_CART_EDIT"
    await g.tap(f"cart_dec:{ids['Tea']}")  # 1 -> gone
    assert [l["name"] for l in g.context["cart"]] == ["Bun"]
    await g.tap("food_nav_back")
    assert g.state == "AWAITING_CART_ACTION"


@pytest.mark.asyncio
async def test_removing_the_last_item_returns_to_the_menu(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {}), ("Rice", 9000, "Mains", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap("food_cat:Drinks")
    await g.tap(ids["Tea"])
    await g.tap("cart_edit")
    await g.tap(f"cart_dec:{ids['Tea']}")
    assert "cart is now empty" in g.all_text()
    assert g.state == "AWAITING_MENU_CATEGORY" and g.context["cart"] == []


@pytest.mark.asyncio
async def test_cancel_order_inside_edit_cart_returns_the_tenants_real_menu(hospital_id):
    connector = _setup(hospital_id, ["order_food", "book_appointment"])
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap(ids["Tea"])
    await g.tap("cart_edit")
    await g.tap("cart_cancel_order")
    assert "cancelled" in g.all_text()
    assert g.sessions.get(hospital_id, PHONE) == {"state": "IDLE", "context": {}}
    row_ids = {r["id"] for r in _rows(g.last("list"))}
    assert "menu_order_food" in row_ids and "menu_book" in row_ids
    assert "menu_reschedule" not in row_ids and "menu_faq" not in row_ids  # only what this restaurant enabled


@pytest.mark.asyncio
async def test_back_out_of_the_menu_returns_the_tenants_real_menu(hospital_id):
    connector = _setup(hospital_id, ["order_food", "book_appointment"])
    _menu(hospital_id, [("Tea", 4950, "Drinks", {}), ("Rice", 9000, "Mains", {})])
    g = Guest(hospital_id, connector)
    await g.start()
    await g.tap("food_nav_back")
    assert g.sessions.get(hospital_id, PHONE)["state"] == "IDLE"
    row_ids = {r["id"] for r in _rows(g.last("list"))}
    assert row_ids == {"menu_order_food", "menu_book"}


@pytest.mark.asyncio
async def test_cart_is_capped_at_eight_distinct_items(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [(f"Dish {i}", 1000 + i, "Mains", {}) for i in range(9)])
    g = Guest(hospital_id, connector)
    await g.start()
    for i in range(8):
        await g.tap(ids[f"Dish {i}"])
        await g.tap("cart_add_more")
    await g.tap(ids["Dish 8"])
    assert len(g.context["cart"]) == 8 and "8 different items" in g.all_text()
    await g.tap("cart_add_more")
    await g.tap(ids["Dish 0"])  # an item already in the cart can still be increased
    assert g.context["cart"][0]["quantity"] == 2


# --- review + pay at restaurant ---------------------------------------------

async def _to_review(g, ids, names, fulfillment="fulfillment_pickup", address="12 MG Road, Pune", name="Asha"):
    await g.start()
    for n in names:
        await g.tap(ids[n])
        await g.tap("cart_add_more")
    await g.tap("food_nav_back")  # back out of the menu to the cart
    assert g.state == "AWAITING_CART_ACTION"
    await g.tap("cart_checkout")
    await g.tap(fulfillment)
    if fulfillment == "fulfillment_delivery":
        await g.text(address)
    await g.text(name)
    assert g.state == "AWAITING_ORDER_REVIEW"


@pytest.mark.asyncio
async def test_review_lists_lines_and_exact_total_and_offers_confirm_or_edit(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {}), ("Bun", 3000, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea", "Tea", "Bun"])
    review = g.last("buttons")
    body = review["body_text"]
    assert "2x Tea — ₹99" in body and "1x Bun — ₹30" in body
    assert "Total: ₹129" in body and "Takeaway" in body and "Name: Asha" in body
    assert "pay at the restaurant" in body
    assert "Delivery fee" not in body
    # Online payment isn't set up for this restaurant: no dead-end "Pay online" button.
    assert [b["id"] for b in review["buttons"]] == ["order_confirm", "cart_edit"]
    assert all(len(b["title"]) <= 20 for b in review["buttons"])


@pytest.mark.asyncio
async def test_review_for_delivery_shows_address_and_fee(hospital_id):
    connector = _setup(hospital_id)
    conn = get_connection()
    conn.execute("UPDATE hospital_settings SET home_collection_charge = ? WHERE hospital_id = ?", (40.5, hospital_id))
    conn.commit()
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea"], fulfillment="fulfillment_delivery")
    body = g.last("buttons")["body_text"]
    assert "Subtotal: ₹49.50" in body and "Delivery fee: ₹40.50" in body and "Total: ₹90" in body
    assert "12 MG Road, Pune" in body and "pay when your order is delivered" in body


@pytest.mark.asyncio
async def test_confirming_places_a_pay_at_restaurant_order(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {"stock_count": 5}), ("Bun", 3000, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea", "Tea", "Bun"])
    await g.tap("order_confirm")

    orders = db.list_food_orders(hospital_id)
    assert len(orders) == 1
    order = orders[0]
    assert order["status"] == "placed" and order["payment_method"] == "pay_at_restaurant"
    assert order["fulfillment_type"] == "pickup" and order["total_paise"] == 12900
    assert {i["item_name_snapshot"]: i["quantity"] for i in order["items"]} == {"Tea": 2, "Bun": 1}
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 3

    text = g.last("text")["text"]
    assert order["reference_id"] in text and "₹129" in text and "pay at the restaurant" in text
    assert g.sessions.get(hospital_id, PHONE) == {"state": "IDLE", "context": {}}

    await g.tap("order_confirm") if g.state in HANDLERS else None  # nothing left to double-place
    assert len(db.list_food_orders(hospital_id)) == 1


@pytest.mark.asyncio
async def test_confirm_after_the_last_portion_sold_out_returns_to_the_cart(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Special", 5000, "Mains", {"stock_count": 1})])
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Special"])
    # someone else takes the last portion before this guest confirms
    db.create_food_order(hospital_id, "5490000000", [{"menu_item_id": ids["Special"], "quantity": 1}], "pickup")
    await g.tap("order_confirm")
    assert g.state == "AWAITING_CART_ACTION"
    assert "no longer available" in g.all_text()
    assert len(db.list_food_orders(hospital_id)) == 1  # only the other guest's order exists


@pytest.mark.asyncio
async def test_review_edit_cart_and_back_navigation(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea"], fulfillment="fulfillment_delivery")
    await g.tap("food_nav_back")
    assert g.state == "AWAITING_DELIVERY_ADDRESS"
    await g.text("Another address 5")
    assert g.state == "AWAITING_ORDER_REVIEW"
    await g.tap("cart_edit")
    assert g.state == "AWAITING_CART_EDIT"
    assert db.list_food_orders(hospital_id) == []  # nothing is created until Confirm


@pytest.mark.asyncio
async def test_known_guest_skips_the_name_prompt(hospital_id):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    patient = connector.create_patient_profile(hospital_id, PHONE, "Known Guest", 30)
    g = Guest(hospital_id, connector)
    await start_food_ordering_flow(g.wa, g.sessions, PHONE, hospital_id, connector, active_patient_id=patient["id"])
    await g.tap(ids["Tea"])
    await g.tap("cart_checkout")
    await g.tap("fulfillment_pickup")
    assert g.state == "AWAITING_ORDER_REVIEW"
    assert "Name: Known Guest" in g.last("buttons")["body_text"]


# --- online payment stays optional -------------------------------------------

def _enable_online_payment(monkeypatch):
    """Stands in for a restaurant that saved its Razorpay keys (the real setter needs the
    deployment's encryption key)."""
    monkeypatch.setattr(
        "connectors.tier1.repo.get_razorpay_credentials",
        lambda hospital_id: {"key_id": "rzp_test_x", "key_secret": "secret", "webhook_secret": "whsec"},
    )


@pytest.mark.asyncio
async def test_online_payment_is_offered_only_when_razorpay_is_set_up(hospital_id, monkeypatch):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {"stock_count": 4})])
    _enable_online_payment(monkeypatch)
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea"])
    assert [b["id"] for b in g.last("buttons")["buttons"]] == ["order_confirm", "order_pay_online", "cart_edit"]
    assert g.last("buttons")["buttons"][0]["title"] == "Pay at restaurant"

    async def fake_payment(hospital_id_, order_id):
        return {"razorpay_order_id": "plink_1", "payment_link_url": "https://rzp.io/i/abc", "amount_paise": 4950, "currency": "INR"}

    monkeypatch.setattr("connectors.tier1.repo.create_razorpay_payment", fake_payment)
    await g.tap("order_pay_online")
    order = db.list_food_orders(hospital_id)[0]
    assert order["status"] == "pending_payment" and order["payment_method"] == "online"
    assert "https://rzp.io/i/abc" in g.last("text")["text"] and "₹49.50" in g.last("text")["text"]
    assert g.state == "AWAITING_PAYMENT"


@pytest.mark.asyncio
async def test_failed_payment_link_cancels_the_order_and_gives_stock_back(hospital_id, monkeypatch):
    connector = _setup(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {"stock_count": 4})])
    _enable_online_payment(monkeypatch)
    g = Guest(hospital_id, connector)
    await _to_review(g, ids, ["Tea", "Tea"])

    async def boom(hospital_id_, order_id):
        raise RazorpayError("down")

    monkeypatch.setattr("connectors.tier1.repo.create_razorpay_payment", boom)
    await g.tap("order_pay_online")
    order = db.list_food_orders(hospital_id)[0]
    assert order["status"] == "cancelled"
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 4  # both portions returned
    assert g.sessions.get(hospital_id, PHONE)["state"] == "IDLE"


# --- repository ---------------------------------------------------------------

def test_cancelling_restores_stock_exactly_once(hospital_id):
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {"stock_count": 5}), ("Free", 100, "Drinks", {})])
    order = db.create_food_order(
        hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 3}, {"menu_item_id": ids["Free"], "quantity": 2}],
        "pickup", payment_method="pay_at_restaurant",
    )
    assert order["status"] == "placed" and db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 2
    assert db.advance_order_status(hospital_id, order["id"], "cancelled", "placed") is not None
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 5
    assert db.get_menu_item(hospital_id, ids["Free"])["stock_count"] is None  # unlimited stays unlimited
    assert db.advance_order_status(hospital_id, order["id"], "cancelled", "placed") is None  # no double restore
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 5


def test_delivery_fee_and_payment_method_validation(hospital_id):
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    assert db.get_delivery_fee_paise(hospital_id, "pickup") is None
    assert db.get_delivery_fee_paise(hospital_id, "delivery") is None  # none configured: omitted, not a fake 0
    conn = get_connection()
    conn.execute("UPDATE hospital_settings SET home_collection_charge = ? WHERE hospital_id = ?", (30, hospital_id))
    conn.commit()
    assert db.get_delivery_fee_paise(hospital_id, "delivery") == 3000
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 1}], "delivery", delivery_address="Somewhere 1")
    assert order["delivery_fee_paise"] == 3000 and order["total_paise"] == 7950
    assert order["status"] == "pending_payment" and order["payment_method"] == "online"  # the default is unchanged
    with pytest.raises(ValueError):
        db.create_food_order(hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 1}], "pickup", payment_method="cash")


def test_database_rejects_an_unknown_payment_method_or_status(hospital_id):
    conn = get_connection()
    with pytest.raises(Exception):
        conn.execute(
            "INSERT INTO food_orders (hospital_id, phone, status, fulfillment_type, payment_method) VALUES (?, ?, ?, ?, ?)",
            (hospital_id, PHONE, "placed", "pickup", "barter"),
        )
    conn.execute(
        "INSERT INTO food_orders (hospital_id, phone, status, fulfillment_type, payment_method) VALUES (?, ?, ?, ?, ?)",
        (hospital_id, PHONE, "placed", "pickup", "pay_at_restaurant"),
    )
    conn.commit()


# --- portal ------------------------------------------------------------------

def _portal(hospital_id, pw="food-pw"):
    conn = get_connection()
    conn.execute(
        "UPDATE hospitals SET admin_capabilities = ? WHERE id = ?",
        (json.dumps(["manage_food_ordering"]), hospital_id),
    )
    conn.commit()
    return _portal_login(hospital_id, pw)


def test_portal_menu_item_photo_link_roundtrip_and_validation(hospital_id):
    client, headers = _portal(hospital_id)
    base = {"name": "Dosa", "price_rupees": 49.5, "category": "Mains", "is_available": True}

    created = client.post("/api/portal/menu-items", headers=headers, json={**base, "image_url": "  https://img.example.com/d.jpg "})
    assert created.status_code == 200, created.text
    item = created.json()["menu_item"]
    assert item["image_url"] == "https://img.example.com/d.jpg" and item["price_paise"] == 4950

    bad = client.post("/api/portal/menu-items", headers=headers, json={**base, "image_url": "http://insecure.example.com/d.jpg"})
    assert bad.status_code == 400 and "https" in bad.json()["error"]
    assert client.post("/api/portal/menu-items", headers=headers, json={**base, "image_url": "javascript:alert(1)"}).status_code == 400
    assert client.post("/api/portal/menu-items", headers=headers, json={**base, "image_url": "https://a b"}).status_code == 400

    cleared = client.put(f"/api/portal/menu-items/{item['id']}", headers=headers, json={**base, "image_url": ""})
    assert cleared.status_code == 200 and cleared.json()["menu_item"]["image_url"] is None

    listed = client.get("/api/portal/menu-items", headers=headers).json()["menu_items"]
    assert [m["id"] for m in listed] == [item["id"]] and "image_url" in listed[0]


def test_portal_create_honours_unavailable(hospital_id):
    client, headers = _portal(hospital_id)
    resp = client.post("/api/portal/menu-items", headers=headers, json={"name": "Hidden", "price_rupees": 10, "is_available": False})
    assert resp.json()["menu_item"]["is_available"] is False
    assert db.get_menu_items(hospital_id) == []  # not offered to guests


def test_portal_accepts_and_cancels_a_placed_order_and_stock_returns(hospital_id):
    client, headers = _portal(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {"stock_count": 5})])
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 2}], "pickup", payment_method="pay_at_restaurant")

    listed = client.get("/api/portal/food-orders?status=placed", headers=headers).json()["food_orders"]
    assert [o["id"] for o in listed] == [order["id"]] and listed[0]["payment_method"] == "pay_at_restaurant"

    accepted = client.post(f"/api/portal/food-orders/{order['id']}/accept", headers=headers)
    assert accepted.status_code == 200 and accepted.json()["food_order"]["status"] == "accepted"
    assert client.post(f"/api/portal/food-orders/{order['id']}/accept", headers=headers).status_code == 409  # double tap

    for action in ("start_preparing", "mark_ready", "complete"):
        assert client.post(f"/api/portal/food-orders/{order['id']}/{action}", headers=headers).status_code == 200
    assert db.get_food_order(hospital_id, order["id"])["status"] == "completed"

    second = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 2}], "pickup", payment_method="pay_at_restaurant")
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 1
    cancelled = client.post(f"/api/portal/food-orders/{second['id']}/cancel", headers=headers)
    assert cancelled.status_code == 200 and cancelled.json()["food_order"]["status"] == "cancelled"
    assert db.get_menu_item(hospital_id, ids["Tea"])["stock_count"] == 3


def test_portal_still_accepts_a_paid_online_order(hospital_id):
    client, headers = _portal(hospital_id)
    ids = _menu(hospital_id, [("Tea", 4950, "Drinks", {})])
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": ids["Tea"], "quantity": 1}], "pickup")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")
    assert client.post(f"/api/portal/food-orders/{order['id']}/accept", headers=headers).json()["food_order"]["status"] == "accepted"


def test_portal_cannot_touch_another_restaurants_orders_or_menu(hospital_id, second_hospital_id):
    client, headers = _portal(hospital_id)
    other_ids = _menu(second_hospital_id, [("Theirs", 1000, "Mains", {})])
    other_order = db.create_food_order(second_hospital_id, PHONE, [{"menu_item_id": other_ids["Theirs"], "quantity": 1}], "pickup", payment_method="pay_at_restaurant")
    assert client.get("/api/portal/food-orders", headers=headers).json()["food_orders"] == []
    assert client.post(f"/api/portal/food-orders/{other_order['id']}/accept", headers=headers).status_code == 404
    assert client.put(
        f"/api/portal/menu-items/{other_ids['Theirs']}", headers=headers, json={"name": "x", "price_rupees": 1},
    ).status_code == 404
    assert db.get_food_order(second_hospital_id, other_order["id"])["status"] == "placed"


# --- startup must survive existing table reservations ---------------------------

def test_startup_schema_init_succeeds_when_table_reservations_exist(hospital_id):
    """init_db() runs on every boot. It once re-added the old doctor/resource/procedure
    check, which a table reservation (all three NULL) violates -- crashing the deploy."""
    from datetime import datetime

    from db.init_db import init_db_on_connection

    slot = db.get_available_table_slots(hospital_id, 2)[0]
    db.create_table_reservation(hospital_id, PHONE, 2, datetime.fromisoformat(slot["id"]), patient_name="Boot Guest")
    init_db_on_connection(get_connection())  # must not raise
    init_db_on_connection(get_connection())  # and stays idempotent
