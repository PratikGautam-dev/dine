# tests/test_bookings_table_fields.py
"""Table reservations, portal follow-up: portal/routes/bookings.py's
_appointment_json() now surfaces table_id/table_name/party_size -- this
data existed in db.models.Appointment since Stage 4 but was never returned
by the portal's JSON shape at all. Additive: a table reservation's
doctor_id/doctor_name stay None (never set by create_table_reservation()),
and a legacy doctor appointment's table_id/table_name/party_size stay None
(never set by create_appointment()) -- the two shapes coexist in the same
list without either overwriting the other."""
import os
from datetime import datetime, timedelta

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app)


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


def _next_operating_datetime(hospital_id: int, hour: int = 12) -> datetime:
    settings = db.get_hospital_settings(hospital_id)
    now = datetime.now()
    day_offset = 1
    while True:
        candidate_day = now + timedelta(days=day_offset)
        if candidate_day.strftime("%a")[:3] in settings["operating_days"]:
            return candidate_day.replace(hour=hour, minute=0, second=0, microsecond=0)
        day_offset += 1


def test_table_reservation_appears_in_the_list_with_table_fields_and_no_doctor_fields(hospital_id):
    _set_hospital_password(hospital_id, "bookingtest123")
    token = _login("bookingtest123")

    scheduled_at = _next_operating_datetime(hospital_id)
    reservation = db.create_table_reservation(
        hospital_id, "919888800001", party_size=3, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Table Guest",
    )

    resp = client.get("/api/portal/bookings", headers=_auth(token))
    assert resp.status_code == 200
    row = next(a for a in resp.json()["appointments"] if a["id"] == reservation.id)

    assert row["table_id"] == reservation.table_id
    assert row["table_name"] == reservation.table_name
    assert row["party_size"] == 3
    # Additive, not replacing -- a table reservation genuinely has no doctor.
    assert row["doctor_id"] is None
    assert row["doctor_name"] is None
    # Section (department) is shared/common to every appointment type --
    # still populated for a table reservation, same as any other type.
    assert row["department_id"] == "cardiology"
    assert row["department_name"] == "Cardiology"


def test_legacy_doctor_appointment_still_displays_correctly_with_null_table_fields(hospital_id):
    """The pre-existing doctor-appointment shape must keep working byte-for-
    byte -- doctor_id/doctor_name populated exactly as before, and the new
    table_id/table_name/party_size fields simply come back None rather than
    breaking or being force-populated with anything."""
    _set_hospital_password(hospital_id, "bookingtest456")
    token = _login("bookingtest456")

    scheduled_at = _next_operating_datetime(hospital_id, hour=15)
    appointment = db.create_appointment(
        hospital_id, "919888800002", "cardiology", "doc_card_1", scheduled_at,
        patient_name="Doctor Patient", patient_age=40,
    )

    resp = client.get("/api/portal/bookings", headers=_auth(token))
    assert resp.status_code == 200
    row = next(a for a in resp.json()["appointments"] if a["id"] == appointment.id)

    assert row["doctor_id"] == "doc_card_1"
    assert row["doctor_name"] == "Dr. Anjali Rao"
    assert row["department_id"] == "cardiology"
    assert row["department_name"] == "Cardiology"
    # Additive, not replacing -- a doctor appointment genuinely has no table.
    assert row["table_id"] is None
    assert row["table_name"] is None
    assert row["party_size"] is None


def test_a_single_list_response_correctly_shows_both_shapes_side_by_side(hospital_id):
    """The real scenario this whole fix is for: one hospital's Reservations
    list containing both a table reservation and a legacy doctor
    appointment at once, neither corrupting the other's row."""
    _set_hospital_password(hospital_id, "bookingtest789")
    token = _login("bookingtest789")

    table_scheduled_at = _next_operating_datetime(hospital_id, hour=13)
    doctor_scheduled_at = _next_operating_datetime(hospital_id, hour=16)

    table_reservation = db.create_table_reservation(
        hospital_id, "919888800003", party_size=2, scheduled_at=table_scheduled_at,
        department_id="cardiology", patient_name="Side By Side Table Guest",
    )
    doctor_appointment = db.create_appointment(
        hospital_id, "919888800004", "cardiology", "doc_card_2", doctor_scheduled_at,
        patient_name="Side By Side Doctor Patient", patient_age=55,
    )

    resp = client.get("/api/portal/bookings", headers=_auth(token))
    assert resp.status_code == 200
    by_id = {a["id"]: a for a in resp.json()["appointments"]}

    table_row = by_id[table_reservation.id]
    assert table_row["table_name"] is not None
    assert table_row["doctor_name"] is None

    doctor_row = by_id[doctor_appointment.id]
    assert doctor_row["doctor_name"] == "Dr. Vikram Sethi"
    assert doctor_row["table_name"] is None
