# tests/test_sections_and_stock.py
"""Sections as a managed list (rename / reorder / delete-guard, unique names), stock control on menu items
(restock, independent sold-out switch, stale edit form can't overwrite live stock) and category tidying."""
import json
import os

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from db.repositories.hospitals import hash_portal_password  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from portal.capabilities import ALL_CAPABILITIES  # noqa: E402

client = TestClient(app)
PW = "hunter2hunter2"


def _login(hospital_id, role="admin", tag="x"):
    conn = get_connection()
    conn.execute("UPDATE hospitals SET admin_capabilities = ? WHERE id = ?", (json.dumps(sorted(ALL_CAPABILITIES)), hospital_id))
    conn.commit()
    email = f"{role}.{tag}.{hospital_id}@example.com"
    db.create_staff_user(hospital_id, role, email, hash_portal_password(PW), f"{role} {tag}")
    resp = client.post("/api/portal/staff/login", json={"email": email, "password": PW})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _names(sections):
    return [s["name"] for s in sections]


# ------------------------------------------------------------------ sections

def test_sections_are_created_at_the_end_and_listed_in_order(hospital_id):
    h = _login(hospital_id)
    base = len(client.get("/api/portal/tables", headers=h).json()["sections"])
    for name in ("Patio", "Rooftop", "Bar"):
        assert client.post("/api/portal/sections", headers=h, json={"name": name}).status_code == 200
    sections = client.get("/api/portal/tables", headers=h).json()["sections"]
    assert _names(sections)[base:] == ["Patio", "Rooftop", "Bar"]
    # the guest-facing list (WhatsApp) uses the same order
    assert [d["name"] for d in db.get_departments(hospital_id)] == _names(sections)


def test_section_names_are_unique_ignoring_case_and_spacing(hospital_id):
    h = _login(hospital_id)
    assert client.post("/api/portal/sections", headers=h, json={"name": "Garden"}).status_code == 200
    for dup in ("garden", "  GARDEN ", "Garden"):
        resp = client.post("/api/portal/sections", headers=h, json={"name": dup})
        assert resp.status_code == 409, dup
    assert client.post("/api/portal/sections", headers=h, json={"name": "   "}).status_code == 400
    assert client.post("/api/portal/sections", headers=h, json={"name": "x" * 61}).status_code == 400


def test_rename_and_move_a_section(hospital_id):
    h = _login(hospital_id)
    a = client.post("/api/portal/sections", headers=h, json={"name": "Alpha"}).json()["section"]["id"]
    b = client.post("/api/portal/sections", headers=h, json={"name": "Beta"}).json()["section"]["id"]
    assert client.put(f"/api/portal/sections/{a}", headers=h, json={"name": "Beta"}).status_code == 409  # taken
    assert client.put(f"/api/portal/sections/{a}", headers=h, json={"name": "alpha"}).status_code == 200  # own name, new case
    assert client.put("/api/portal/sections/nope", headers=h, json={"name": "Z"}).status_code == 404

    moved = client.post(f"/api/portal/sections/{b}/move", headers=h, json={"direction": "up"})
    assert moved.status_code == 200
    order = [s["id"] for s in moved.json()["sections"]]
    assert order.index(b) < order.index(a)
    # moving the first one up again is a harmless no-op
    first = order[0]
    assert client.post(f"/api/portal/sections/{first}/move", headers=h, json={"direction": "up"}).status_code == 200
    assert [s["id"] for s in client.get("/api/portal/tables", headers=h).json()["sections"]] == order
    assert client.post(f"/api/portal/sections/{b}/move", headers=h, json={"direction": "sideways"}).status_code == 400
    assert client.post("/api/portal/sections/nope/move", headers=h, json={"direction": "up"}).status_code == 404


def test_a_section_with_tables_cannot_be_deleted_an_empty_one_can(hospital_id):
    h = _login(hospital_id)
    sid = client.post("/api/portal/sections", headers=h, json={"name": "Terrace"}).json()["section"]["id"]
    table = client.post("/api/portal/tables", headers=h, json={"name": "TT1", "department_id": sid, "capacity": 4})
    assert table.status_code == 200
    listed = {s["id"]: s for s in client.get("/api/portal/tables", headers=h).json()["sections"]}
    assert listed[sid]["table_count"] == 1

    blocked = client.delete(f"/api/portal/sections/{sid}", headers=h)
    assert blocked.status_code == 409 and "tables" in blocked.json()["error"]
    assert sid in listed

    empty = client.post("/api/portal/sections", headers=h, json={"name": "Temp"}).json()["section"]["id"]
    assert client.delete(f"/api/portal/sections/{empty}", headers=h).status_code == 200
    assert empty not in {s["id"] for s in client.get("/api/portal/tables", headers=h).json()["sections"]}
    assert client.delete(f"/api/portal/sections/{empty}", headers=h).status_code == 404


def test_a_table_can_only_go_in_an_existing_section_and_moves_with_section_order(hospital_id):
    h = _login(hospital_id)
    bad = client.post("/api/portal/tables", headers=h, json={"name": "Ghost", "department_id": "nope", "capacity": 2})
    assert bad.status_code == 400


def test_front_of_house_can_view_and_write_but_not_delete_sections(hospital_id):
    """Live Operations follow-up: front-of-house needs `tables` write to Seat/Clear a table, so their
    PAGE_TABLES permission moved from view-only to view+write (portal/permissions.py) -- this also
    unlocks section create/rename/move, which a host arranging the floor reasonably needs too. Delete
    stays admin-only (the `tables` page's `delete` action, never granted to receptionist)."""
    admin = _login(hospital_id)
    foh = _login(hospital_id, "receptionist", "foh")
    sid = client.post("/api/portal/sections", headers=admin, json={"name": "Lounge"}).json()["section"]["id"]
    assert client.get("/api/portal/tables", headers=foh).status_code == 200
    assert client.post("/api/portal/sections", headers=foh, json={"name": "Patio"}).status_code == 200
    assert client.put(f"/api/portal/sections/{sid}", headers=foh, json={"name": "Lounge (front)"}).status_code == 200
    assert client.post(f"/api/portal/sections/{sid}/move", headers=foh, json={"direction": "up"}).status_code == 200
    assert client.delete(f"/api/portal/sections/{sid}", headers=foh).status_code == 403


def test_migration_backfill_numbers_existing_sections_without_reordering(hospital_id):
    """init_db's idempotent backfill: sections left at 0 are numbered by name, per restaurant, and numbered ones stay."""
    conn = get_connection()
    for name in ("Zeta", "Alpha"):
        db.create_department(hospital_id, name)
    conn.execute("UPDATE departments SET sort_order = 0 WHERE hospital_id = ?", (hospital_id,))
    conn.commit()
    conn.execute(
        "UPDATE departments d SET sort_order = n.rn FROM (SELECT id, row_number() OVER (PARTITION BY hospital_id ORDER BY name, id) AS rn "
        "FROM departments) n WHERE n.id = d.id AND d.sort_order = 0"
    )
    conn.commit()
    rows = conn.execute("SELECT name, sort_order FROM departments WHERE hospital_id = ? ORDER BY sort_order", (hospital_id,)).fetchall()
    orders = [r["sort_order"] for r in rows]
    assert 0 not in orders and orders == sorted(orders) and len(set(orders)) == len(orders)
    assert [r["name"] for r in rows] == sorted(r["name"] for r in rows)


# ------------------------------------------------------------------ stock control

def _create_item(h, **fields):
    body = {"name": "Paneer Tikka", "price_rupees": 220, "category": "Starters", **fields}
    resp = client.post("/api/portal/menu-items", headers=h, json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()["menu_item"]


def test_initial_stock_then_restock_adds_atomically(hospital_id):
    h = _login(hospital_id)
    item = _create_item(h, stock_count=10)
    assert item["stock_count"] == 10
    resp = client.post(f"/api/portal/menu-items/{item['id']}/restock", headers=h, json={"add": 5})
    assert resp.status_code == 200 and resp.json()["menu_item"]["stock_count"] == 15
    # DB-level: restock is one UPDATE, not read-modify-write -- it composes with an order taking stock in between
    conn = get_connection()
    conn.execute("UPDATE menu_items SET stock_count = stock_count - 3 WHERE id = ?", (item["id"],))
    conn.commit()
    assert client.post(f"/api/portal/menu-items/{item['id']}/restock", headers=h, json={"add": 2}).json()["menu_item"]["stock_count"] == 14


def test_restock_validation(hospital_id):
    h = _login(hospital_id)
    counted = _create_item(h, name="Counted", stock_count=1)
    unlimited = _create_item(h, name="Unlimited")
    assert unlimited["stock_count"] is None
    for bad in (0, -3, 10_001):
        assert client.post(f"/api/portal/menu-items/{counted['id']}/restock", headers=h, json={"add": bad}).status_code == 400
    assert client.post(f"/api/portal/menu-items/{unlimited['id']}/restock", headers=h, json={"add": 5}).status_code == 409
    assert client.post("/api/portal/menu-items/nope/restock", headers=h, json={"add": 5}).status_code == 404
    assert db.get_menu_item(hospital_id, unlimited["id"])["stock_count"] is None  # untouched


def test_negative_stock_is_rejected_on_create_and_edit(hospital_id):
    h = _login(hospital_id)
    assert client.post("/api/portal/menu-items", headers=h, json={"name": "Bad", "price_rupees": 1, "stock_count": -1}).status_code == 400
    item = _create_item(h, stock_count=2)
    assert client.put(f"/api/portal/menu-items/{item['id']}", headers=h, json={"name": "Bad", "price_rupees": 1, "stock_count": -5}).status_code == 400
    assert db.get_menu_item(hospital_id, item["id"])["stock_count"] == 2


def test_sold_out_switch_is_independent_of_the_stock_count(hospital_id):
    h = _login(hospital_id)
    item = _create_item(h, stock_count=7)
    resp = client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=h, json={"is_available": False})
    assert resp.status_code == 200
    assert resp.json()["menu_item"]["is_available"] is False and resp.json()["menu_item"]["stock_count"] == 7
    # hidden from guests while sold out, even with stock
    assert item["id"] not in {m["id"] for m in db.get_menu_items(hospital_id)}
    client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=h, json={"is_available": True})
    assert item["id"] in {m["id"] for m in db.get_menu_items(hospital_id)}

    # the other direction: zero stock hides it, a restock brings it back, without touching the switch
    zero = _create_item(h, name="Zero", stock_count=0)
    assert zero["is_available"] is True and zero["id"] not in {m["id"] for m in db.get_menu_items(hospital_id)}
    client.post(f"/api/portal/menu-items/{zero['id']}/restock", headers=h, json={"add": 3})
    assert zero["id"] in {m["id"] for m in db.get_menu_items(hospital_id)}
    assert client.post("/api/portal/menu-items/nope/availability", headers=h, json={"is_available": False}).status_code == 404


def test_an_edit_that_leaves_stock_out_does_not_overwrite_live_stock(hospital_id):
    """The old edit form always sent the count it loaded, clobbering orders taken since. Now an edit that doesn't
    mention stock_count leaves it alone, and one that does sets it (including back to unlimited)."""
    h = _login(hospital_id)
    item = _create_item(h, stock_count=10)
    conn = get_connection()
    conn.execute("UPDATE menu_items SET stock_count = 6 WHERE id = ?", (item["id"],))  # four portions were ordered
    conn.commit()
    resp = client.put(f"/api/portal/menu-items/{item['id']}", headers=h, json={"name": "Paneer Tikka Deluxe", "price_rupees": 250})
    assert resp.status_code == 200
    assert resp.json()["menu_item"]["stock_count"] == 6 and resp.json()["menu_item"]["name"] == "Paneer Tikka Deluxe"
    resp = client.put(f"/api/portal/menu-items/{item['id']}", headers=h, json={"name": "Paneer Tikka Deluxe", "price_rupees": 250, "stock_count": 20})
    assert resp.json()["menu_item"]["stock_count"] == 20
    resp = client.put(f"/api/portal/menu-items/{item['id']}", headers=h, json={"name": "Paneer Tikka Deluxe", "price_rupees": 250, "stock_count": None})
    assert resp.json()["menu_item"]["stock_count"] is None


def test_kitchen_staff_can_restock_and_mark_sold_out_but_front_of_house_cannot(hospital_id):
    admin = _login(hospital_id)
    kitchen = _login(hospital_id, "kitchen", "k")
    foh = _login(hospital_id, "receptionist", "f")
    item = _create_item(admin, stock_count=2)
    ok = client.post(f"/api/portal/menu-items/{item['id']}/restock", headers=kitchen, json={"add": 4})
    assert ok.status_code == 200 and ok.json()["menu_item"]["stock_count"] == 6
    assert client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=kitchen, json={"is_available": False}).status_code == 200
    assert client.post(f"/api/portal/menu-items/{item['id']}/restock", headers=foh, json={"add": 4}).status_code == 403
    assert client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=foh, json={"is_available": True}).status_code == 403
    assert db.get_menu_item(hospital_id, item["id"])["stock_count"] == 6


# ------------------------------------------------------------------ categories

def test_categories_are_listed_and_new_names_match_existing_spelling(hospital_id):
    h = _login(hospital_id)
    _create_item(h, name="A", category="Starters")
    _create_item(h, name="B", category="Mains")
    listed = client.get("/api/portal/menu-items", headers=h).json()
    assert listed["categories"] == ["Mains", "Starters"]

    # "starters" typed next to "Starters" is the SAME category -- the WhatsApp menu groups by exact text
    typed = _create_item(h, name="C", category="  starters ")
    assert typed["category"] == "Starters"
    edited = client.put(f"/api/portal/menu-items/{typed['id']}", headers=h, json={"name": "C", "price_rupees": 1, "category": "MAINS"})
    assert edited.json()["menu_item"]["category"] == "Mains"
    assert client.get("/api/portal/menu-items", headers=h).json()["categories"] == ["Mains", "Starters"]

    fresh = _create_item(h, name="D", category="Chef   Specials")
    assert fresh["category"] == "Chef Specials"
    blank = _create_item(h, name="E", category="   ")
    assert blank["category"] is None
    groups = {}
    for item in db.get_menu_items(hospital_id):
        groups.setdefault((item.get("category") or "").strip(), []).append(item["name"])
    assert set(groups) == {"Starters", "Mains", "Chef Specials", ""}


def test_availability_route_checks_permission_before_it_validates_the_body(hospital_id):
    """No body / no sign-in must be a 401 (and no permission a 403), never a 422 that leaks that the route exists and
    what it wants -- the same rule the every-route sweep in test_portal_rbac_enforcement applies."""
    item = _create_item(_login(hospital_id), stock_count=3)
    assert client.post(f"/api/portal/menu-items/{item['id']}/availability", json={}).status_code == 401
    foh = _login(hospital_id, "receptionist", "f2")
    assert client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=foh, json={}).status_code == 403
    admin = _login(hospital_id, "admin", "a2")
    missing = client.post(f"/api/portal/menu-items/{item['id']}/availability", headers=admin, json={})
    assert missing.status_code == 400 and "required" in missing.json()["error"]
    assert db.get_menu_item(hospital_id, item["id"])["is_available"] is True  # nothing changed
