# tests/test_tables_management.py
"""Table reservations, portal follow-up: the real tables (physical dining
tables, migration 0030) CRUD surface -- db/repositories/tables.py's
create_table()/update_table()/get_all_tables_for_hospital() plus the new
connector methods and portal/routes/tables.py route. Covers plain CRUD,
cross-tenant isolation, and the "deactivating a table doesn't retroactively
touch its already-booked reservations" behavior, same "leave doesn't
retroactively touch bookings" precedent doctor_leave/generate_slots_for_doctor
already establish."""
import os
from datetime import datetime, timedelta

import pytest

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from connectors.tier1 import Tier1Connector  # noqa: E402
from db.connection import IntegrityError  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app)
connector = Tier1Connector()


# --- Repository-level CRUD ---

def test_create_table_returns_the_full_row_shape(hospital_id):
    table = db.create_table(hospital_id, "cardiology", "Patio 1", 4)
    assert table["name"] == "Patio 1"
    assert table["department_id"] == "cardiology"
    assert table["capacity"] == 4
    assert table["is_active"] is True
    assert table["id"].startswith(f"h{hospital_id}_")


def test_get_all_tables_for_hospital_includes_inactive(hospital_id):
    table = db.create_table(hospital_id, "cardiology", "Patio 2", 2)
    db.update_table(hospital_id, table["id"], "Patio 2", "cardiology", 2, False)

    all_tables = db.get_all_tables_for_hospital(hospital_id)
    matching = next(t for t in all_tables if t["id"] == table["id"])
    assert matching["is_active"] is False

    # get_tables() (the WhatsApp/booking-flow read) must NOT show it.
    active_tables = db.get_tables(hospital_id)
    assert table["id"] not in [t["id"] for t in active_tables]


def test_update_table_changes_name_department_and_capacity(hospital_id):
    table = db.create_table(hospital_id, "cardiology", "Old Name", 2)
    updated = db.update_table(hospital_id, table["id"], "New Name", "orthopedics", 6, True)
    assert updated["name"] == "New Name"
    assert updated["department_id"] == "orthopedics"
    assert updated["capacity"] == 6


def test_connector_methods_delegate_correctly(hospital_id):
    created = connector.create_table(hospital_id, "cardiology", "Connector Table", 3)
    assert created["capacity"] == 3

    all_tables = connector.get_all_tables_for_hospital(hospital_id)
    assert any(t["id"] == created["id"] for t in all_tables)

    updated = connector.update_table(hospital_id, created["id"], "Connector Table", "cardiology", 3, False)
    assert updated["is_active"] is False


# --- Cross-tenant isolation ---

def test_table_created_for_one_hospital_is_invisible_to_another(hospital_id, second_hospital_id):
    table = db.create_table(hospital_id, "cardiology", "Isolated Table", 2)

    other_hospital_tables = db.get_all_tables_for_hospital(second_hospital_id)
    assert table["id"] not in [t["id"] for t in other_hospital_tables]

    # find_table() itself is hospital-scoped -- looking it up under the
    # WRONG hospital_id must return None, not the real row.
    assert db.find_table(second_hospital_id, table["id"]) is None
    assert db.find_table(hospital_id, table["id"]) is not None


def test_updating_a_table_under_the_wrong_hospital_id_is_a_silent_no_op(hospital_id, second_hospital_id):
    """update_table()'s WHERE clause is hospital-scoped -- calling it with
    another hospital's table id must not touch the real row (same
    "cross-tenant write is a no-op, not a crash or a leak" discipline every
    other hospital-scoped update in this codebase already follows)."""
    table = db.create_table(hospital_id, "cardiology", "Untouchable", 2)
    db.update_table(second_hospital_id, table["id"], "Hijacked Name", "cardiology", 99, False)

    unchanged = db.find_table(hospital_id, table["id"])
    assert unchanged["name"] == "Untouchable"
    assert unchanged["capacity"] == 2
    assert unchanged["is_active"] is True


# --- Portal route: capability gate + basic HTTP-level behavior ---

def _login(password: str) -> str:
    resp = client.post("/api/portal/login", json={"password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _set_hospital_password(hosp_id: int, password: str) -> None:
    h = db.get_hospital(hosp_id)
    db.update_hospital(
        hosp_id, h.name, h.whatsapp_phone_number_id, access_token=h.access_token, app_secret=h.app_secret,
        timezone=h.timezone, welcome_message_text=h.welcome_message_text,
        reminder_offsets_hours=h.reminder_offsets_hours, reminder_template_name=h.reminder_template_name,
        data_tier=h.data_tier, external_api_base_url=h.external_api_base_url, external_api_key=h.external_api_key,
        portal_password_hash=db.hash_portal_password(password), enabled_features=h.enabled_features,
        feature_labels=h.feature_labels, closing_message_text=h.closing_message_text,
        business_hours_text=h.business_hours_text, default_language=h.default_language,
        language_prompt_enabled=h.language_prompt_enabled, session_timeout_minutes=h.session_timeout_minutes,
        handoff_auto_resolve_hours=h.handoff_auto_resolve_hours,
        require_patient_confirmation=h.require_patient_confirmation, privacy_notice_text=h.privacy_notice_text,
        tenant_type=h.tenant_type, admin_capabilities=h.admin_capabilities,
        dpdp_consent_required=h.dpdp_consent_required,
    )


def test_portal_tables_list_requires_authentication():
    resp = client.get("/api/portal/tables")
    assert resp.status_code == 401


def test_portal_can_list_create_and_update_a_table(hospital_id):
    _set_hospital_password(hospital_id, "tablepass123")
    token = _login("tablepass123")

    resp = client.get("/api/portal/tables", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "departments" in data and "tables" in data
    assert len(data["tables"]) > 0  # seeded tables from db/seed.py

    create_resp = client.post(
        "/api/portal/tables", headers=_auth(token),
        json={"name": "Portal Table", "department_id": "cardiology", "capacity": 4, "is_active": True},
    )
    assert create_resp.status_code == 200, create_resp.text
    table_id = create_resp.json()["table"]["id"]

    update_resp = client.put(
        f"/api/portal/tables/{table_id}", headers=_auth(token),
        json={"name": "Portal Table Renamed", "department_id": "cardiology", "capacity": 5, "is_active": False},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["table"]["name"] == "Portal Table Renamed"
    assert update_resp.json()["table"]["is_active"] is False


def test_portal_create_table_rejects_an_invalid_department(hospital_id):
    _set_hospital_password(hospital_id, "tablepass456")
    token = _login("tablepass456")
    resp = client.post(
        "/api/portal/tables", headers=_auth(token),
        json={"name": "Bad Table", "department_id": "not_a_real_department", "capacity": 2, "is_active": True},
    )
    assert resp.status_code == 400


# --- Deactivation does NOT retroactively touch existing reservations ---

def test_deactivating_a_table_leaves_its_existing_reservation_untouched(hospital_id):
    """Same 'leave doesn't retroactively touch bookings' precedent
    doctor_leave/generate_slots_for_doctor() already establish for doctors --
    a table that already has a real, booked reservation keeps that
    reservation exactly as it is when the table is later deactivated. The
    guest isn't silently un-booked, and the appointment's table_id isn't
    cleared."""
    table = db.create_table(hospital_id, "cardiology", "Deactivation Test Table", 4)

    settings = db.get_hospital_settings(hospital_id)
    now = datetime.now()
    day_offset = 1
    while True:
        candidate_day = now + timedelta(days=day_offset)
        weekday_abbrev = candidate_day.strftime("%a")[:3]
        if weekday_abbrev in settings["operating_days"]:
            break
        day_offset += 1
    scheduled_at = candidate_day.replace(hour=12, minute=0, second=0, microsecond=0)

    appointment = db.create_table_reservation(
        hospital_id, "919999999999", party_size=4, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Test Guest",
    )
    # Confirmed with the user's own scoping instruction: don't require the
    # reservation land on THIS specific table (nearest-fit could pick a
    # smaller table if one exists) -- deactivate whichever table it actually
    # landed on, which is the real thing being tested here.
    booked_table_id = appointment.table_id
    assert booked_table_id is not None

    db.update_table(hospital_id, booked_table_id, "Deactivation Test Table", "cardiology", 4, False)

    # The appointment itself is completely unaffected -- still booked, still
    # pointing at the now-inactive table, still at the same time.
    reloaded = db.get_appointment(hospital_id, appointment.id)
    assert reloaded is not None
    assert reloaded.status == "booked"
    assert reloaded.table_id == booked_table_id
    assert reloaded.scheduled_at == appointment.scheduled_at

    # The table itself is genuinely deactivated.
    table_row = db.find_table(hospital_id, booked_table_id)
    assert table_row["is_active"] is False

    # And it's correctly excluded from FUTURE availability searches for a
    # new reservation, without erroring -- it just stops being offered.
    active_tables = db.get_tables(hospital_id, department_id="cardiology")
    assert booked_table_id not in [t["id"] for t in active_tables]


def test_deactivated_table_is_not_offered_for_a_new_reservation_but_others_still_are(hospital_id):
    table = db.create_table(hospital_id, "orthopedics", "Solo Ortho Table", 10)
    # Deactivate every OTHER orthopedics table (the two seeded ones) so this
    # one deactivation is unambiguous, then confirm slots for a party this
    # size disappear once it's deactivated too.
    for existing in db.get_tables(hospital_id, department_id="orthopedics"):
        if existing["id"] != table["id"]:
            db.update_table(hospital_id, existing["id"], existing["name"], "orthopedics", existing["capacity"], False)

    slots_while_active = db.get_available_table_slots(hospital_id, party_size=8, department_id="orthopedics")
    assert len(slots_while_active) > 0

    db.update_table(hospital_id, table["id"], "Solo Ortho Table", "orthopedics", 10, False)

    slots_after_deactivation = db.get_available_table_slots(hospital_id, party_size=8, department_id="orthopedics")
    assert slots_after_deactivation == []
