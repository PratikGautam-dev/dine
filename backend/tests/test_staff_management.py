# tests/test_staff_management.py
"""Staff management API (portal/routes/staff.py): create / list / edit / change role / reset password /
activate-deactivate, for Owner/Manager, Front of House and Kitchen Staff logins.

Real logins and real requests throughout. Covers the guards that keep a restaurant from locking itself
out (last active Owner, self-demotion), that role changes and password resets end the person's sessions
immediately, that nothing can reach another restaurant's staff, sections or managers, and that the
retired 'doctor' role can no longer exist."""
import json
import os

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

client = TestClient(app)
PW = "hunter2hunter2"


def _login(email: str, password: str = PW):
    return client.post("/api/portal/staff/login", json={"email": email, "password": password})


def _headers(email: str, password: str = PW) -> dict:
    resp = _login(email, password)
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make(hospital_id: int, role: str, email: str, name: str | None = None) -> dict:
    return db.create_staff_user(hospital_id, role, email, hash_portal_password(PW), name or email.split("@")[0].title())


@pytest.fixture
def owner(hospital_id):
    _make(hospital_id, "admin", "owner@example.com", "Olive Owner")
    return _headers("owner@example.com")


def _new(owner, **over):
    body = {"name": "Sam Server", "email": "sam@example.com", "password": PW, "role": "receptionist", **over}
    return client.post("/api/portal/staff", headers=owner, json=body)


# ---------------------------------------------------------------- create + list

def test_create_each_role_and_the_list_shows_the_profile(hospital_id, owner):
    section = db.create_department(hospital_id, "Patio")
    manager = db.get_staff_user_by_email("owner@example.com")

    made = _new(owner, role="kitchen", name="Kim Cook", email="kim@example.com", phone="+91 98765 43210",
                address="12 Market Road", department_id=section["id"], reports_to_id=manager["id"])
    assert made.status_code == 201, made.text
    row = made.json()
    assert row["role"] == "kitchen" and row["name"] == "Kim Cook" and row["is_active"] is True
    assert row["phone"] == "+91 98765 43210" and row["address"] == "12 Market Road"
    assert row["department_name"] == "Patio" and row["reports_to_name"] == "Olive Owner"
    assert row["employee_id"] == "EMP-ST-00002"  # the owner fixture is 00001

    assert _new(owner).status_code == 201
    assert _new(owner, role="admin", email="second.owner@example.com").status_code == 201
    listed = client.get("/api/portal/staff", headers=owner).json()
    assert [s["employee_id"] for s in sorted(listed, key=lambda s: s["employee_id"])] == [f"EMP-ST-{n:05d}" for n in range(1, 5)]
    assert {s["role"] for s in listed} == {"admin", "receptionist", "kitchen"}
    # the new person can sign in with the password they were given, as the role they were given
    assert _login("kim@example.com").status_code == 200


def test_employee_ids_count_up_per_restaurant(hospital_id, second_hospital_id, owner):
    _make(second_hospital_id, "admin", "other.owner@example.com", "Other Owner")
    other = _headers("other.owner@example.com")
    assert _new(owner).json()["employee_id"] == "EMP-ST-00002"
    assert client.post("/api/portal/staff", headers=other, json={"name": "Ola Other", "email": "ola@example.com", "password": PW, "role": "kitchen"}).json()["employee_id"] == "EMP-ST-00002"


def test_create_validation_errors_use_the_single_error_shape(hospital_id, owner):
    cases = [
        ({"name": ""}, "Name is required"),
        ({"email": "not-an-email"}, "valid email"),
        ({"password": "short"}, "at least 8"),
        ({"role": "chef"}, "Choose a role"),
        ({"phone": "abc"}, "Phone number"),
        ({"department_id": "not-a-section"}, "own sections"),
        ({"reports_to_id": 999999}, "active member of your own team"),
    ]
    for over, expect in cases:
        resp = _new(owner, **over)
        assert resp.status_code == 400 and isinstance(resp.json().get("error"), str), (over, resp.text)
        assert expect in resp.json()["error"], (over, resp.json())
    assert len(client.get("/api/portal/staff", headers=owner).json()) == 1  # nothing was created


def test_a_duplicate_email_is_a_clean_error(hospital_id, owner):
    assert _new(owner).status_code == 201
    dup = _new(owner, name="Someone Else")
    assert dup.status_code == 400 and "already in use" in dup.json()["error"]
    assert _new(owner, email="SAM@example.com").status_code == 400  # case-insensitive


def test_the_retired_doctor_role_cannot_be_created_or_stored(hospital_id, owner):
    resp = _new(owner, role="doctor")
    assert resp.status_code == 400 and "Choose a role" in resp.json()["error"]
    with pytest.raises(Exception):
        get_connection().execute("UPDATE staff_details SET role = 'doctor' WHERE hospital_id = ?", (hospital_id,))


# ---------------------------------------------------------------- edit

def test_edit_profile_fields_and_clear_them(hospital_id, owner):
    section = db.create_department(hospital_id, "Main Hall")
    sam = _new(owner, phone="9876543210").json()

    edited = client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"name": "Samantha Server", "department_id": section["id"], "address": "1 High St"})
    assert edited.status_code == 200
    assert edited.json()["name"] == "Samantha Server" and edited.json()["department_name"] == "Main Hall"
    assert edited.json()["phone"] == "9876543210"  # not sent -> untouched

    cleared = client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"phone": None, "department_id": None})
    assert cleared.json()["phone"] is None and cleared.json()["department_name"] is None and cleared.json()["address"] == "1 High St"
    assert client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={}).status_code == 400


def test_reports_to_cannot_point_at_self_or_create_a_loop(hospital_id, owner):
    a = _new(owner, name="Ann", email="ann@example.com").json()
    b = _new(owner, name="Ben", email="ben@example.com").json()
    assert client.patch(f"/api/portal/staff/{a['id']}", headers=owner, json={"reports_to_id": a["id"]}).status_code == 400
    assert client.patch(f"/api/portal/staff/{b['id']}", headers=owner, json={"reports_to_id": a["id"]}).status_code == 200
    loop = client.patch(f"/api/portal/staff/{a['id']}", headers=owner, json={"reports_to_id": b["id"]})
    assert loop.status_code == 400 and "report to each other" in loop.json()["error"]


# ---------------------------------------------------------------- role changes end sessions and change access

def test_changing_a_role_takes_effect_and_ends_their_sessions(hospital_id, owner):
    sam = _new(owner, role="kitchen", email="cook@example.com").json()
    cook = _headers("cook@example.com")
    assert client.get("/api/portal/patients", headers=cook).status_code == 403  # Kitchen: no guests

    changed = client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"role": "receptionist"})
    assert changed.status_code == 200 and changed.json()["role"] == "receptionist"
    assert client.get("/api/portal/patients", headers=cook).status_code == 401  # the old session is dead
    assert client.get("/api/portal/patients", headers=_headers("cook@example.com")).status_code == 200  # Front of House can


def test_the_last_active_owner_cannot_be_removed_or_demoted(hospital_id, owner):
    second = _new(owner, role="admin", email="co-owner@example.com").json()
    me = db.get_staff_user_by_email("owner@example.com")
    co_owner = _headers("co-owner@example.com")

    # the co-owner may switch the first owner off... but then they are the last one
    assert client.patch(f"/api/portal/staff/{me['id']}", headers=co_owner, json={"is_active": False}).status_code == 200
    only = client.patch(f"/api/portal/staff/{second['id']}", headers=_headers("co-owner@example.com"), json={"is_active": False})
    assert only.status_code == 400  # self-deactivation
    demote_owner = client.patch(f"/api/portal/staff/{second['id']}", headers=_headers("co-owner@example.com"), json={"role": "kitchen"})
    assert demote_owner.status_code == 400  # own role
    assert db.count_active_admins(hospital_id) == 1


def test_you_cannot_deactivate_or_demote_yourself(hospital_id, owner):
    me = db.get_staff_user_by_email("owner@example.com")
    assert client.patch(f"/api/portal/staff/{me['id']}", headers=owner, json={"is_active": False}).status_code == 400
    assert client.patch(f"/api/portal/staff/{me['id']}", headers=owner, json={"role": "kitchen"}).status_code == 400
    assert client.get("/api/portal/staff", headers=owner).status_code == 200  # still signed in as an Owner


def test_a_manager_who_holds_staff_write_cannot_demote_the_only_owner(hospital_id, owner):
    """Front of House granted staff:write through the grid still can't strand the restaurant."""
    _new(owner, email="lead@example.com")
    client.put("/api/portal/roles/permissions", headers=owner, json={"updates": [
        {"role": "receptionist", "page_key": "staff", "can_view": True, "can_write": True, "can_delete": False}]})
    lead = _headers("lead@example.com")
    me = db.get_staff_user_by_email("owner@example.com")
    for body in ({"is_active": False}, {"role": "kitchen"}):
        resp = client.patch(f"/api/portal/staff/{me['id']}", headers=lead, json=body)
        assert resp.status_code == 400 and "at least one active Owner" in resp.json()["error"]
    assert db.count_active_admins(hospital_id) == 1


# ---------------------------------------------------------------- activate / deactivate / password

def test_deactivating_ends_their_session_and_blocks_login_until_reactivated(hospital_id, owner):
    sam = _new(owner).json()
    session = _headers("sam@example.com")
    assert client.get("/api/portal/bookings", headers=session).status_code == 200

    assert client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"is_active": False}).json()["is_active"] is False
    assert client.get("/api/portal/bookings", headers=session).status_code == 401
    assert _login("sam@example.com").status_code == 401

    assert client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"is_active": True}).json()["is_active"] is True
    assert _login("sam@example.com").status_code == 200


def test_resetting_a_password_replaces_it_and_ends_their_sessions(hospital_id, owner):
    sam = _new(owner).json()
    session = _headers("sam@example.com")

    short = client.post(f"/api/portal/staff/{sam['id']}/password", headers=owner, json={"new_password": "short"})
    assert short.status_code == 400 and "at least 8" in short.json()["error"]
    assert client.post(f"/api/portal/staff/{sam['id']}/password", headers=owner, json={"new_password": "a-new-password-1"}).status_code == 200

    assert client.get("/api/portal/bookings", headers=session).status_code == 401
    assert _login("sam@example.com", PW).status_code == 401
    assert _login("sam@example.com", "a-new-password-1").status_code == 200


def test_every_write_is_in_the_audit_log_without_secrets(hospital_id, owner):
    sam = _new(owner).json()
    client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"role": "kitchen"})
    client.post(f"/api/portal/staff/{sam['id']}/password", headers=owner, json={"new_password": "a-new-password-1"})
    client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"is_active": False})
    log = client.get("/api/portal/audit-log", headers=owner)
    assert log.status_code == 200
    actions = {e["action"] for e in log.json()["entries"]} if isinstance(log.json(), dict) and "entries" in log.json() else {e["action"] for e in log.json()}
    assert {"staff.create", "staff.change_role", "staff.reset_password", "staff.deactivate"} <= actions
    assert "a-new-password-1" not in log.text and PW not in log.text


# ---------------------------------------------------------------- who may use it

def test_only_roles_with_staff_access_can_use_the_staff_api(hospital_id, owner):
    _new(owner, role="receptionist", email="foh@example.com")
    _new(owner, role="kitchen", email="cook@example.com")
    sam = _new(owner, email="target@example.com").json()
    for email in ("foh@example.com", "cook@example.com"):
        h = _headers(email)
        assert client.get("/api/portal/staff", headers=h).status_code == 403
        assert client.get("/api/portal/staff/options", headers=h).status_code == 403
        assert _new(h, email=f"x.{email}").status_code == 403
        assert client.patch(f"/api/portal/staff/{sam['id']}", headers=h, json={"is_active": False}).status_code == 403
        assert client.post(f"/api/portal/staff/{sam['id']}/password", headers=h, json={"new_password": "a-new-password-1"}).status_code == 403
    assert _login("target@example.com", PW).status_code == 200  # untouched


def test_options_lists_only_active_team_members(hospital_id, owner):
    sam = _new(owner).json()
    client.patch(f"/api/portal/staff/{sam['id']}", headers=owner, json={"is_active": False})
    _new(owner, name="Ben", email="ben@example.com")
    names = [o["name"] for o in client.get("/api/portal/staff/options", headers=owner).json()]
    assert "Ben" in names and "Olive Owner" in names and "Sam Server" not in names


# ---------------------------------------------------------------- other restaurants

def test_staff_of_another_restaurant_are_out_of_reach(hospital_id, second_hospital_id, owner):
    theirs = _make(second_hospital_id, "receptionist", "theirs@example.com", "Their Host")
    their_section = db.create_department(second_hospital_id, "Their Patio")
    their_owner = _make(second_hospital_id, "admin", "their.owner@example.com", "Their Owner")

    assert "Their Host" not in client.get("/api/portal/staff", headers=owner).text
    assert "Their Host" not in client.get("/api/portal/staff/options", headers=owner).text
    assert client.patch(f"/api/portal/staff/{theirs['id']}", headers=owner, json={"is_active": False}).status_code == 404
    assert client.patch(f"/api/portal/staff/{theirs['id']}", headers=owner, json={"role": "admin"}).status_code == 404
    assert client.post(f"/api/portal/staff/{theirs['id']}/password", headers=owner, json={"new_password": "a-new-password-1"}).status_code == 404
    # ...nor can our staff be pointed at their sections or managers
    assert _new(owner, department_id=their_section["id"]).status_code == 400
    assert _new(owner, email="x@example.com", reports_to_id=their_owner["id"]).status_code == 400

    still = db.get_staff_user_by_email("theirs@example.com")
    assert still["is_active"] and still["role"] == "receptionist"
    assert _login("theirs@example.com", PW).status_code == 200  # their password is unchanged


def test_the_repository_update_itself_is_scoped_to_the_restaurant(hospital_id, second_hospital_id):
    theirs = _make(second_hospital_id, "kitchen", "theirs@example.com", "Their Cook")
    assert db.update_staff_profile(hospital_id, theirs["id"], {"name": "Hacked", "phone": "1234567"}) is False
    assert db.update_staff_user_role(theirs["id"], "admin", hospital_id=hospital_id) is False
    after = db.get_staff_user_by_email("theirs@example.com")
    assert after["name"] == "Their Cook" and after["role"] == "kitchen" and after["phone"] is None
