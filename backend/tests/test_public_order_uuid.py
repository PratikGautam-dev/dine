# tests/test_public_order_uuid.py
"""Public order URLs use the order's UUID (public_id), not its internal integer id."""
import os

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from auth.customer_session import issue_customer_token  # noqa: E402
from db.repositories.storefront import resolve_public_order_id  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
PHONE = "919900000040"


def _headers():
    return {"Authorization": f"Bearer {issue_customer_token(PHONE, 'Test Guest')}"}


def test_order_detail_is_reachable_by_its_public_uuid(hospital_id):
    item = db.create_menu_item(hospital_id, "Vada", price_paise=5000, category="Mains")["id"]
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup")

    resp = client.get(f"/api/public/orders/{order['public_id']}", headers=_headers())

    assert resp.status_code == 200
    assert resp.json()["order"]["id"] == order["id"]


def test_order_detail_404s_for_an_unknown_uuid(hospital_id):
    resp = client.get("/api/public/orders/00000000-0000-0000-0000-000000000000", headers=_headers())
    assert resp.status_code == 404


def test_the_internal_integer_id_no_longer_resolves(hospital_id):
    item = db.create_menu_item(hospital_id, "Uttapam", price_paise=5000, category="Mains")["id"]
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup")

    resp = client.get(f"/api/public/orders/{order['id']}", headers=_headers())

    assert resp.status_code == 404


def test_resolve_public_order_id_scopes_to_the_right_order(hospital_id):
    item = db.create_menu_item(hospital_id, "Paratha", price_paise=5000, category="Mains")["id"]
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup")

    assert resolve_public_order_id(order["public_id"]) == order["id"]
    assert resolve_public_order_id("not-a-real-uuid") is None
