# tests/test_portal_staff_table_reservation.py
"""Staff-created table reservations (/api/portal/new-booking with
booking_type="table") -- the portal's "new booking" flow gaining a genuine
path to connector.create_table_reservation(), alongside its existing
department/doctor create_booking() path. Covers: a staff table reservation
succeeds through the API and gets source="staff"; the /table-slots endpoint
returns the same real availability WhatsApp's own date/time menus would
offer; and race protection between a staff-created and a WhatsApp-created
table reservation for the same table+time -- exactly one succeeds, same
advisory-lock discipline as the existing staff-vs-WhatsApp doctor-booking
race tests in test_portal_new_booking.py."""
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
from db.connection import IntegrityError  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from tests.portal_login import portal_login  # noqa: E402

client = TestClient(app)


def _login(hosp_id: int, password: str) -> dict:
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
    resp = portal_login(client, password)
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def _next_operating_datetime(hosp_id: int, hour: int = 12) -> datetime:
    """cardiology's Table C2 (capacity 4) is the only table seeded for the
    test hospital that fits a party of 4 -- db/seed.py's TABLES_BY_DEPARTMENT
    -- so a party_size=4 booking there always has exactly one candidate
    table, making it the clean case for race-protection tests."""
    settings = db.get_hospital_settings(hosp_id)
    now = datetime.now()
    day_offset = 1
    while True:
        candidate_day = now + timedelta(days=day_offset)
        if candidate_day.strftime("%a")[:3] in settings["operating_days"]:
            return candidate_day.replace(hour=hour, minute=0, second=0, microsecond=0)
        day_offset += 1


def test_staff_table_reservation_via_api_succeeds_with_source_staff(hospital_id):
    headers = _login(hospital_id, "staff-table-pw")
    scheduled_at = _next_operating_datetime(hospital_id)

    resp = client.post(
        "/api/portal/new-booking", headers=headers,
        json={
            "booking_type": "table", "patient_name": "Staff-Booked Guest", "patient_phone": "919812300001",
            "party_size": 4, "department_id": "cardiology", "slot_id": scheduled_at.isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    appts = db.get_all_appointments_for_hospital(hospital_id)
    created = next(a for a in appts if a.phone == "919812300001")
    assert created.source == "staff"
    assert created.party_size == 4
    assert created.table_id is not None
    assert created.doctor_id is None


def test_new_booking_table_slots_endpoint_returns_real_availability(hospital_id):
    headers = _login(hospital_id, "staff-table-slots-pw")
    resp = client.get(
        "/api/portal/new-booking/table-slots", headers=headers,
        params={"party_size": 4, "department_id": "cardiology"},
    )
    assert resp.status_code == 200, resp.text
    slots = resp.json()["slots"]
    assert len(slots) > 0
    assert all("id" in s and "label" in s for s in slots)


def test_new_booking_table_slots_requires_login(hospital_id):
    resp = client.get("/api/portal/new-booking/table-slots", params={"party_size": 4})
    assert resp.status_code == 401


def test_staff_table_reservation_rejected_when_slot_already_taken(hospital_id):
    headers = _login(hospital_id, "staff-table-conflict-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=13)

    # Fills the one cardiology table that fits a party of 4.
    db.create_table_reservation(
        hospital_id, "919812300002", party_size=4, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Already Seated",
    )

    resp = client.post(
        "/api/portal/new-booking", headers=headers,
        json={
            "booking_type": "table", "patient_phone": "919812300003",
            "party_size": 4, "department_id": "cardiology", "slot_id": scheduled_at.isoformat(),
        },
    )
    assert resp.status_code == 400
    assert "already" in resp.json()["errors"][0].lower() or "taken" in resp.json()["errors"][0].lower()


# --- Race protection: staff-created vs WhatsApp-created table reservation,
# same table+time (mirrors test_portal_new_booking.py's own staff-vs-
# WhatsApp doctor-booking race tests) ---

def test_staff_table_reservation_blocks_a_later_whatsapp_reservation_for_same_table_and_time(hospital_id):
    headers = _login(hospital_id, "staff-table-race-1-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=14)

    resp = client.post(
        "/api/portal/new-booking", headers=headers,
        json={
            "booking_type": "table", "patient_phone": "919812300004",
            "party_size": 4, "department_id": "cardiology", "slot_id": scheduled_at.isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text

    # Simulates the WhatsApp flow's own book.py confirm step: same
    # connector.create_table_reservation() call, default source="whatsapp".
    with pytest.raises(IntegrityError):
        db.create_table_reservation(
            hospital_id, "919812300005", party_size=4, scheduled_at=scheduled_at, department_id="cardiology",
        )


def test_whatsapp_table_reservation_blocks_a_later_staff_reservation_for_same_table_and_time(hospital_id):
    headers = _login(hospital_id, "staff-table-race-2-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=15)

    db.create_table_reservation(
        hospital_id, "919812300006", party_size=4, scheduled_at=scheduled_at, department_id="cardiology",
    )  # whatsapp (default source)

    resp = client.post(
        "/api/portal/new-booking", headers=headers,
        json={
            "booking_type": "table", "patient_phone": "919812300007",
            "party_size": 4, "department_id": "cardiology", "slot_id": scheduled_at.isoformat(),
        },
    )
    assert resp.status_code == 400
    errors = resp.json()["errors"]
    assert any("taken" in e.lower() for e in errors)


def test_new_table_reservation_via_api_cannot_target_another_hospitals_department(hospital_id, second_hospital_id):
    headers = _login(hospital_id, "staff-table-isolation-pw")
    scheduled_at = _next_operating_datetime(hospital_id)

    resp = client.post(
        "/api/portal/new-booking", headers=headers,
        json={
            "booking_type": "table", "patient_phone": "919812300008",
            "party_size": 2, "department_id": "t2_neurology", "slot_id": scheduled_at.isoformat(),
        },
    )
    # No table in hospital_id's own tenant matches "t2_neurology" (that
    # department belongs to second_hospital_id) -- get_available_table_slots
    # filters by THIS hospital's own tables, so no candidate ever qualifies.
    assert resp.status_code == 400
    assert any("taken" in e.lower() or "slot" in e.lower() for e in resp.json()["errors"])
