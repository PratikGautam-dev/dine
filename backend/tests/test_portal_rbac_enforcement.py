# tests/test_portal_rbac_enforcement.py
"""Role enforcement on the staff portal API: Owner/Manager (admin), Front of House
(receptionist) and Kitchen Staff (kitchen).

These are real requests with a real login per role, and each refusal is checked against the
database -- a restricted role must not only get a 403, the thing it tried to change must be
untouched. Also: a sweep that fails if ANY portal route is left without a permission check,
so a route added later can't quietly reopen the gap."""
import json
import os
import re

import pytest

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SUPER_ADMIN_JWT_SECRET", "test-super-admin-jwt-secret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from db.repositories.hospitals import hash_portal_password  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from portal.capabilities import ALL_CAPABILITIES  # noqa: E402
from portal.permissions import ALL_PAGES  # noqa: E402
from tests.test_table_reschedule import _reserve  # noqa: E402

client = TestClient(app)
PASSWORD = "hunter2hunter2"
PHONE = "5491112345678"


def _grant_all_capabilities(hospital_id: int) -> None:
    conn = get_connection()
    conn.execute("UPDATE hospitals SET admin_capabilities = ? WHERE id = ?", (json.dumps(sorted(ALL_CAPABILITIES)), hospital_id))
    conn.commit()


def _login(hospital_id: int, role: str, tag: str | None = None) -> dict:
    _grant_all_capabilities(hospital_id)
    email = f"{tag or role}.{hospital_id}@example.com"
    db.create_staff_user(hospital_id, role, email, hash_portal_password(PASSWORD), f"Test {role}")
    resp = client.post("/api/portal/staff/login", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def team(hospital_id):
    return {
        "manager": _login(hospital_id, "admin", "manager"),
        "foh": _login(hospital_id, "receptionist", "foh"),
        "kitchen": _login(hospital_id, "kitchen", "kitchen"),
    }


def _menu_item(hospital_id, name="Dish", price=5000):
    return db.create_menu_item(hospital_id, name, price_paise=price, category="Mains", stock_count=9)


def _price(hospital_id, item_id):
    return db.get_menu_item(hospital_id, item_id)["price_paise"]


def _order(hospital_id):
    item = _menu_item(hospital_id, "Ordered")
    return db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item["id"], "quantity": 1}], "pickup", payment_method="pay_at_restaurant")


# ---------------------------------------------------------------- Kitchen Staff

def test_kitchen_can_work_orders_and_menu_availability(hospital_id, team):
    item = _menu_item(hospital_id)
    order = _order(hospital_id)
    kitchen = team["kitchen"]

    assert client.get("/api/portal/food-orders", headers=kitchen).status_code == 200
    assert client.post(f"/api/portal/food-orders/{order['id']}/accept", headers=kitchen).status_code == 200
    assert db.get_food_order(hospital_id, order["id"])["status"] == "accepted"
    assert client.get("/api/portal/menu-items", headers=kitchen).status_code == 200
    resp = client.put(f"/api/portal/menu-items/{item['id']}", headers=kitchen, json={"name": "Dish", "price_rupees": 50, "category": "Mains", "is_available": False, "stock_count": 0})
    assert resp.status_code == 200 and db.get_menu_item(hospital_id, item["id"])["is_available"] is False


def test_kitchen_cannot_touch_guests_messages_settings_staff_or_reservations(hospital_id, team):
    kitchen = team["kitchen"]
    patient = db.create_patient_profile(hospital_id, PHONE, "Guest One", 30)
    handoff = db.create_handoff_request(hospital_id, PHONE, "patient_requested", "help")
    appt = _reserve(hospital_id, 2, department_id="cardiology")
    settings_before = client.get("/api/portal/settings", headers=team["manager"]).json()
    staff_before = len(db.list_staff_users_for_hospital(hospital_id))

    denied = [
        client.get("/api/portal/patients", headers=kitchen),
        client.get(f"/api/portal/patients/{patient['id']}", headers=kitchen),
        client.post("/api/portal/patients/delete", headers=kitchen, json={"patient_ids": [patient["id"]]}),
        client.get("/api/portal/handoffs", headers=kitchen),
        client.post(f"/api/portal/handoffs/{handoff['id']}/resolve", headers=kitchen),
        client.get("/api/portal/settings", headers=kitchen),
        client.post("/api/portal/settings", headers=kitchen, json={"business_hours_text": "hacked"}),
        client.get("/api/portal/audit-log", headers=kitchen),
        client.get("/api/portal/staff", headers=kitchen),
        client.post("/api/portal/staff", headers=kitchen, json={"name": "X Y", "email": "x@y.com", "password": "hunter2hunter2", "role": "admin"}),
        client.get("/api/portal/roles/permissions", headers=kitchen),
        client.post(f"/api/portal/bookings/{appt.id}/cancel", headers=kitchen, json={"reason": "hack"}),
        client.post(f"/api/portal/bookings/{appt.id}/delete", headers=kitchen),
        client.get("/api/portal/doctors", headers=kitchen),
    ]
    assert [r.status_code for r in denied] == [403] * len(denied), [(r.request.url.path, r.status_code) for r in denied]

    # ...and nothing changed
    assert db.get_patient(hospital_id, patient["id"]) is not None
    assert db.get_appointment(hospital_id, appt.id).status == "booked"
    assert len(db.list_staff_users_for_hospital(hospital_id)) == staff_before
    assert client.get("/api/portal/settings", headers=team["manager"]).json() == settings_before
    # Kitchen may look at reservations and the floor layout, read-only.
    assert client.get("/api/portal/bookings", headers=kitchen).status_code == 200
    assert client.get("/api/portal/tables", headers=kitchen).status_code == 200
    assert client.post(f"/api/portal/bookings/{appt.id}/reassign-table", headers=kitchen, json={"table_id": "x"}).status_code == 403


# ---------------------------------------------------------------- Front of House

def test_front_of_house_cannot_edit_the_menu_or_the_floor_plan(hospital_id, team):
    foh = team["foh"]
    item = _menu_item(hospital_id, price=5000)
    table = db.get_all_tables_for_hospital(hospital_id)[0]

    assert client.get("/api/portal/menu-items", headers=foh).status_code == 200  # can read
    edit = client.put(f"/api/portal/menu-items/{item['id']}", headers=foh, json={"name": "Dish", "price_rupees": 1, "category": "Mains"})
    create = client.post("/api/portal/menu-items", headers=foh, json={"name": "Sneaky", "price_rupees": 1})
    table_edit = client.put(f"/api/portal/tables/{table['id']}", headers=foh, json={"name": "Hacked", "department_id": table["department_id"], "capacity": 1})
    table_new = client.post("/api/portal/tables", headers=foh, json={"name": "Sneaky", "department_id": table["department_id"], "capacity": 2})
    assert (edit.status_code, create.status_code, table_edit.status_code, table_new.status_code) == (403, 403, 403, 403)

    assert _price(hospital_id, item["id"]) == 5000
    assert [m["name"] for m in db.get_menu_items(hospital_id, available_only=False)] == ["Dish"]
    assert db.find_table(hospital_id, table["id"])["name"] == table["name"]
    assert client.get("/api/portal/tables", headers=foh).status_code == 200  # can read the layout


def test_front_of_house_works_reservations_guests_messages_and_orders_but_cannot_delete(hospital_id, team):
    foh = team["foh"]
    appt = _reserve(hospital_id, 2, department_id="cardiology")
    patient = db.create_patient_profile(hospital_id, PHONE, "Guest Two", 30)
    handoff = db.create_handoff_request(hospital_id, PHONE, "patient_requested", "help")
    order = _order(hospital_id)

    assert client.get("/api/portal/bookings", headers=foh).status_code == 200
    assert client.get("/api/portal/patients", headers=foh).status_code == 200
    assert client.get("/api/portal/handoffs", headers=foh).status_code == 200
    assert client.post(f"/api/portal/food-orders/{order['id']}/accept", headers=foh).status_code == 200

    # delete is Owner/Manager only
    refused = [
        client.post("/api/portal/patients/delete", headers=foh, json={"patient_ids": [patient["id"]]}),
        client.post(f"/api/portal/handoffs/{handoff['id']}/delete", headers=foh),
        client.post("/api/portal/handoffs/bulk-delete", headers=foh, json={"handoff_ids": [handoff["id"]]}),
        client.post(f"/api/portal/bookings/{appt.id}/delete", headers=foh),
        client.post("/api/portal/bookings/delete", headers=foh, json={"appointment_ids": [appt.id]}),
    ]
    assert [r.status_code for r in refused] == [403] * 5
    assert db.get_patient(hospital_id, patient["id"]) is not None
    assert db.get_appointment(hospital_id, appt.id) is not None

    # no access to settings, team, roles, audit log
    for method, path in (("GET", "/api/portal/settings"), ("POST", "/api/portal/settings"), ("GET", "/api/portal/audit-log"),
                         ("GET", "/api/portal/staff"), ("GET", "/api/portal/roles/permissions"), ("GET", "/api/portal/doctors")):
        assert client.request(method, path, headers=foh, **({"json": {}} if method == "POST" else {})).status_code == 403, path


# ---------------------------------------------------------------- Owner / Manager

def test_the_manager_can_do_everything_the_other_roles_cannot(hospital_id, team):
    m = team["manager"]
    item = _menu_item(hospital_id)
    patient = db.create_patient_profile(hospital_id, PHONE, "Guest Three", 30)
    table = db.get_all_tables_for_hospital(hospital_id)[0]

    assert client.put(f"/api/portal/menu-items/{item['id']}", headers=m, json={"name": "Dish", "price_rupees": 77, "category": "Mains"}).status_code == 200
    assert _price(hospital_id, item["id"]) == 7700
    assert client.put(f"/api/portal/tables/{table['id']}", headers=m, json={"name": "Renamed", "department_id": table["department_id"], "capacity": 3}).status_code == 200
    assert client.get("/api/portal/settings", headers=m).status_code == 200
    assert client.get("/api/portal/audit-log", headers=m).status_code == 200
    assert client.get("/api/portal/staff", headers=m).status_code == 200
    assert client.get("/api/portal/roles/permissions", headers=m).status_code == 200
    made = client.post("/api/portal/staff", headers=m, json={"name": "New Cook", "email": "cook@example.com", "password": PASSWORD, "role": "kitchen"})
    assert made.status_code == 201 and made.json()["role"] == "kitchen"
    deleted = client.post("/api/portal/patients/delete", headers=m, json={"patient_ids": [patient["id"]]})
    assert deleted.status_code == 200 and deleted.json()["deleted"] == [patient["id"]]


# ---------------------------------------------------------------- the grid is live, and sessions die at once

def test_editing_the_permission_grid_changes_access_immediately(hospital_id, team):
    item = _menu_item(hospital_id, price=5000)
    foh, m = team["foh"], team["manager"]
    body = {"name": "Dish", "price_rupees": 9, "category": "Mains"}
    assert client.put(f"/api/portal/menu-items/{item['id']}", headers=foh, json=body).status_code == 403

    grant = client.put("/api/portal/roles/permissions", headers=m, json={"updates": [
        {"role": "receptionist", "page_key": "food_menu", "can_view": True, "can_write": True, "can_delete": False}]})
    assert grant.status_code == 200
    assert client.put(f"/api/portal/menu-items/{item['id']}", headers=foh, json=body).status_code == 200
    assert _price(hospital_id, item["id"]) == 900

    client.put("/api/portal/roles/permissions", headers=m, json={"updates": [
        {"role": "receptionist", "page_key": "food_menu", "can_view": True, "can_write": False, "can_delete": False}]})
    assert client.put(f"/api/portal/menu-items/{item['id']}", headers=foh, json={**body, "price_rupees": 1}).status_code == 403
    assert _price(hospital_id, item["id"]) == 900


def test_a_role_without_view_access_cannot_even_read(hospital_id, team):
    m, kitchen = team["manager"], team["kitchen"]
    assert client.get("/api/portal/food-orders", headers=kitchen).status_code == 200
    client.put("/api/portal/roles/permissions", headers=m, json={"updates": [
        {"role": "kitchen", "page_key": "food_orders", "can_view": False, "can_write": False, "can_delete": False}]})
    assert client.get("/api/portal/food-orders", headers=kitchen).status_code == 403


def test_the_permission_update_error_is_readable_by_the_frontend(hospital_id, team):
    resp = client.put("/api/portal/roles/permissions", headers=team["manager"], json={"updates": [
        {"role": "chef", "page_key": "food_menu", "can_view": True}]})
    assert resp.status_code == 400 and isinstance(resp.json().get("error"), str) and "chef" in resp.json()["error"]


def test_a_deactivated_staff_login_is_refused_on_its_very_next_request(hospital_id, team):
    foh_email = f"foh.{hospital_id}@example.com"
    staff_id = db.get_staff_user_by_email(foh_email)["id"]
    assert client.get("/api/portal/bookings", headers=team["foh"]).status_code == 200
    assert client.patch(f"/api/portal/staff/{staff_id}", headers=team["manager"], json={"is_active": False}).status_code == 200
    assert client.get("/api/portal/bookings", headers=team["foh"]).status_code == 401


def test_the_tenant_feature_switch_still_applies_on_top_of_the_role(hospital_id, team):
    conn = get_connection()
    conn.execute("UPDATE hospitals SET admin_capabilities = ? WHERE id = ?", (json.dumps(["manage_settings"]), hospital_id))
    conn.commit()
    assert client.get("/api/portal/menu-items", headers=team["manager"]).status_code == 403  # a Manager, but the restaurant lacks food ordering


def test_the_retired_shared_password_session_opens_nothing(hospital_id):
    """A token in the old "hospital_id.expires.signature" shape (what the shared password used to
    mint) must not authenticate anywhere any more."""
    import time

    from auth.session import _sign_session

    old_token = _sign_session(hospital_id, int(time.time()) + 3600)
    headers = {"Authorization": f"Bearer {old_token}"}
    for path in ("/api/portal/bookings", "/api/portal/menu-items", "/api/portal/settings", "/api/portal/patients", "/api/portal/tables"):
        assert client.get(path, headers=headers).status_code == 401, path


# ---------------------------------------------------------------- every route is guarded

PUBLIC = {
    ("POST", "/api/portal/login"),  # retired: always answers 410
    ("POST", "/api/portal/staff/login"), ("POST", "/api/portal/staff/refresh"), ("POST", "/api/portal/staff/logout"),
}


def _portal_routes():
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/portal"):
            continue
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            if (method, path) not in PUBLIC:
                yield method, path


def _fill(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


def test_every_portal_route_refuses_the_unauthenticated_and_the_unpermitted(hospital_id, team, super_admin_headers):
    """The sweep behind "84 of 91 routes only checked that you were logged in": call EVERY portal
    route as (a) nobody, (b) a platform super-admin token, and (c) a staff login whose role has no
    permission on any page. All three must be refused before the handler does anything."""
    # a role with zero access anywhere: Front of House with every cell switched off
    db.upsert_role_permissions(hospital_id, [
        {"role": "receptionist", "page_key": p, "can_view": False, "can_write": False, "can_delete": False} for p in ALL_PAGES])
    from portal.permission_cache import invalidate
    invalidate(hospital_id)

    routes = list(_portal_routes())
    assert len(routes) > 80, f"route discovery looks wrong: {len(routes)}"
    wrong = []
    for method, path in routes:
        url = _fill(path) + ("?party_size=1" if "table-slots" in path else "")
        kw = {"json": {}} if method in ("POST", "PUT", "PATCH") else {}
        for who, headers, expected in (("anonymous", {}, 401), ("platform token", super_admin_headers, 401), ("no-access role", team["foh"], 403)):
            resp = client.request(method, url, headers=headers, **kw)
            if resp.status_code != expected:
                wrong.append(f"{who}: {method} {path} -> {resp.status_code} (wanted {expected})")
    assert not wrong, "\n" + "\n".join(wrong)


# ---------------------------------------------------------------- the staff HR pages (leave and attendance)

HR_PAGES = ("my_leave", "check_in_out", "leave_requests", "attendance", "attendance_settings")


def test_hr_page_permissions_per_role_as_the_login_reports_them(hospital_id):
    """check_in_out and my_leave for EVERYONE (Owners clock in too); the review queue, the team attendance
    view and the attendance rules for Owner/Manager only."""
    expected = {
        "admin": {p: True for p in HR_PAGES},
        "receptionist": {"my_leave": True, "check_in_out": True, "leave_requests": False, "attendance": False, "attendance_settings": False},
        "kitchen": {"my_leave": True, "check_in_out": True, "leave_requests": False, "attendance": False, "attendance_settings": False},
    }
    for role, want in expected.items():
        db.create_staff_user(hospital_id, role, f"{role}.hr@example.com", hash_portal_password(PASSWORD), role.title())
        resp = client.post("/api/portal/staff/login", json={"email": f"{role}.hr@example.com", "password": PASSWORD})
        perms = resp.json()["permissions"]
        for page, allowed in want.items():
            assert perms[page]["view"] is allowed, (role, page, perms[page])
            assert perms[page]["write"] is allowed, (role, page, perms[page])
        assert all(perms[p]["delete"] is (role == "admin") for p in HR_PAGES), role


def test_hr_routes_follow_those_permissions_for_real(hospital_id, team):
    routes_for_everyone = [
        ("GET", "/api/portal/leave/mine"), ("GET", "/api/portal/attendance/today"), ("GET", "/api/portal/attendance/history"),
        ("GET", "/api/portal/notifications"),
    ]
    owner_only = [
        ("GET", "/api/portal/leave/requests"), ("GET", "/api/portal/leave/policy"), ("GET", "/api/portal/attendance/overview"),
        ("GET", "/api/portal/attendance/summary"), ("GET", "/api/portal/attendance/settings"),
    ]
    for who in ("manager", "foh", "kitchen"):
        for method, path in routes_for_everyone:
            assert client.request(method, path, headers=team[who]).status_code == 200, (who, path)
    for method, path in owner_only:
        assert client.request(method, path, headers=team["manager"]).status_code == 200, path
        for who in ("foh", "kitchen"):
            assert client.request(method, path, headers=team[who]).status_code == 403, (who, path)
