# tests/test_food_orders_list_guest_names.py
"""GET /api/portal/food-orders returns each order's guest NAME (from their profile at that restaurant), so the
Orders page can show who ordered instead of only a phone number."""
import os

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import json  # noqa: E402

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from tests.test_table_reschedule import _portal_login  # noqa: E402

PHONE_A = "5491100000031"
PHONE_B = "5491100000032"


def _enable_food(hospital_id):
    conn = get_connection()
    conn.execute("UPDATE hospitals SET enabled_features = ? WHERE id = ?", (json.dumps(["book_appointment", "order_food"]), hospital_id))
    conn.commit()


def _order(hospital_id, phone, name, item_id):
    return db.create_food_order(
        hospital_id, phone, [{"menu_item_id": item_id, "quantity": 1}], "pickup",
        patient_name=name, payment_method="pay_at_restaurant",
    )


def _list(hospital_id, password):
    _enable_food(hospital_id)
    client, headers = _portal_login(hospital_id, password)
    resp = client.get("/api/portal/food-orders", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["food_orders"]


def test_every_order_carries_the_guests_name(hospital_id):
    item = db.create_menu_item(hospital_id, "Dish", price_paise=10000)["id"]
    _order(hospital_id, PHONE_A, "Riya Sharma", item)
    _order(hospital_id, PHONE_A, "Riya Sharma", item)
    _order(hospital_id, PHONE_B, "Arjun Mehta", item)
    rows = _list(hospital_id, "orders-pw-1")
    assert len(rows) == 3
    assert {r["phone"]: r["patient_name"] for r in rows} == {PHONE_A: "Riya Sharma", PHONE_B: "Arjun Mehta"}
    assert all(r["items"] for r in rows)  # the line items are still there


def test_an_unnamed_guest_is_null_not_blank(hospital_id):
    item = db.create_menu_item(hospital_id, "Dish", price_paise=10000)["id"]
    _order(hospital_id, PHONE_A, "Someone", item)
    conn = get_connection()
    conn.execute("UPDATE patients SET name = '  ' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_A))
    conn.commit()
    assert _list(hospital_id, "orders-pw-2")[0]["patient_name"] is None


def test_names_never_come_from_another_restaurant(hospital_id, second_hospital_id):
    # B's profiles are created first so they hold the lower ids -- an unscoped lookup would pick them
    db.create_patient_profile(second_hospital_id, PHONE_A, "Name At B", 30)
    item = db.create_menu_item(hospital_id, "Dish", price_paise=10000)["id"]
    _order(hospital_id, PHONE_A, "Name At A", item)
    _order(hospital_id, PHONE_B, "Placeholder", item)
    conn = get_connection()
    conn.execute("UPDATE patients SET name = '' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_B))
    conn.commit()
    db.create_patient_profile(second_hospital_id, PHONE_B, "Only Known At B", 30)

    names = {r["phone"]: r["patient_name"] for r in _list(hospital_id, "orders-pw-3")}
    assert names == {PHONE_A: "Name At A", PHONE_B: None}
