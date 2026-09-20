# tests/test_reassign_table.py
"""db/repositories/tables.py::reassign_table() -- the portal's "Reassign
Table" action (reservation detail view), letting staff move an existing
table reservation onto a different table (e.g. resolving a walk-in
conflict). Same advisory-lock-protected re-check-under-lock shape as
create_table_reservation(): the target table's freeness is re-verified
inside the transaction, not trusted from whatever list the portal last
rendered. Covers: a successful reassignment to a genuinely free table;
rejection when the target table isn't actually free for that time
(race-protected -- a concurrent booking landing on the target table between
the portal's own stale read and this call must still be caught); and
cross-tenant isolation (can't reassign hospital A's reservation onto
hospital B's table, and can't touch hospital B's reservation from hospital
A's session)."""
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
    settings = db.get_hospital_settings(hosp_id)
    now = datetime.now()
    day_offset = 1
    while True:
        candidate_day = now + timedelta(days=day_offset)
        if candidate_day.strftime("%a")[:3] in settings["operating_days"]:
            return candidate_day.replace(hour=hour, minute=0, second=0, microsecond=0)
        day_offset += 1


def _tables_in(hosp_id: int, department_id: str) -> list[dict]:
    return [t for t in db.get_all_tables_for_hospital(hosp_id) if t["department_id"] == department_id]


def test_reassign_table_succeeds_when_target_is_free(hospital_id):
    scheduled_at = _next_operating_datetime(hospital_id)
    reservation = db.create_table_reservation(
        hospital_id, "919812400001", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Reassign Me",
    )
    tables = _tables_in(hospital_id, "cardiology")
    other_table = next(t for t in tables if t["id"] != reservation.table_id and t["capacity"] >= 2)

    updated = db.reassign_table(hospital_id, reservation.id, other_table["id"])
    assert updated.table_id == other_table["id"]

    refetched = db.get_appointment(hospital_id, reservation.id)
    assert refetched.table_id == other_table["id"]


def test_reassign_table_rejected_when_target_table_already_occupied(hospital_id):
    """Not a naive "is this table generally free" check -- the target must
    actually be free for THIS reservation's own scheduled_at/turnover span,
    re-verified under the advisory lock, mirroring the same race the
    original booking's own create path protects against."""
    scheduled_at = _next_operating_datetime(hospital_id, hour=13)
    reservation = db.create_table_reservation(
        hospital_id, "919812400002", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Party A",
    )
    tables = _tables_in(hospital_id, "cardiology")
    other_table = next(t for t in tables if t["id"] != reservation.table_id and t["capacity"] >= 2)
    # Occupies the target table for the exact same time -- a genuine
    # conflict a blind UPDATE would miss.
    db.create_table_reservation(
        hospital_id, "919812400003", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Party B",
    )
    # Confirm Party B actually landed on other_table (only 2 candidate
    # tables of capacity >= 2 exist in cardiology, and reservation already
    # took the first one by nearest-fit).
    party_b = next(a for a in db.get_all_appointments_for_hospital(hospital_id) if a.phone == "919812400003")
    assert party_b.table_id == other_table["id"]

    with pytest.raises(IntegrityError):
        db.reassign_table(hospital_id, reservation.id, other_table["id"])

    # Original assignment untouched after the failed attempt.
    refetched = db.get_appointment(hospital_id, reservation.id)
    assert refetched.table_id == reservation.table_id


def test_reassign_table_rejects_a_too_small_target_table(hospital_id):
    scheduled_at = _next_operating_datetime(hospital_id, hour=14)
    # Table C2 (capacity 4) is the only cardiology table that fits 4.
    reservation = db.create_table_reservation(
        hospital_id, "919812400004", party_size=4, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Big Party",
    )
    small_table = next(t for t in _tables_in(hospital_id, "cardiology") if t["capacity"] < 4)

    with pytest.raises(ValueError, match="capacity"):
        db.reassign_table(hospital_id, reservation.id, small_table["id"])


def test_reassign_table_cross_tenant_isolation_cannot_target_another_hospitals_table(hospital_id, second_hospital_id):
    scheduled_at = _next_operating_datetime(hospital_id)
    reservation = db.create_table_reservation(
        hospital_id, "919812400005", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Tenant A Guest",
    )
    foreign_table = db.get_all_tables_for_hospital(second_hospital_id)[0]

    with pytest.raises(ValueError, match="not found"):
        db.reassign_table(hospital_id, reservation.id, foreign_table["id"])


def test_reassign_table_cross_tenant_isolation_cannot_touch_another_hospitals_reservation(hospital_id, second_hospital_id):
    scheduled_at = _next_operating_datetime(second_hospital_id)
    foreign_reservation = db.create_table_reservation(
        second_hospital_id, "919812400006", party_size=2, scheduled_at=scheduled_at,
        department_id="t2_dermatology", patient_name="Tenant B Guest",
    )
    own_table = _tables_in(hospital_id, "cardiology")[0]

    with pytest.raises(ValueError, match="not found"):
        db.reassign_table(hospital_id, foreign_reservation.id, own_table["id"])


# --- JSON API layer ---

def test_reassign_table_via_api_succeeds(hospital_id):
    headers = _login(hospital_id, "reassign-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=16)
    reservation = db.create_table_reservation(
        hospital_id, "919812400007", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="API Reassign",
    )
    other_table = next(t for t in _tables_in(hospital_id, "cardiology") if t["id"] != reservation.table_id and t["capacity"] >= 2)

    resp = client.post(
        f"/api/portal/bookings/{reservation.id}/reassign-table", headers=headers,
        json={"table_id": other_table["id"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["table_id"] == other_table["id"]


def test_reassign_table_via_api_rejected_when_target_occupied(hospital_id):
    headers = _login(hospital_id, "reassign-conflict-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=17)
    reservation = db.create_table_reservation(
        hospital_id, "919812400008", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Party A",
    )
    other_table = next(t for t in _tables_in(hospital_id, "cardiology") if t["id"] != reservation.table_id and t["capacity"] >= 2)
    db.create_table_reservation(
        hospital_id, "919812400009", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Party B",
    )

    resp = client.post(
        f"/api/portal/bookings/{reservation.id}/reassign-table", headers=headers,
        json={"table_id": other_table["id"]},
    )
    assert resp.status_code == 400
    assert "free" in resp.json()["errors"][0].lower()


def test_reassign_table_via_api_cannot_target_another_hospitals_table(hospital_id, second_hospital_id):
    headers = _login(hospital_id, "reassign-isolation-pw")
    scheduled_at = _next_operating_datetime(hospital_id, hour=18)
    reservation = db.create_table_reservation(
        hospital_id, "919812400010", party_size=2, scheduled_at=scheduled_at,
        department_id="cardiology", patient_name="Isolation Test",
    )
    foreign_table = db.get_all_tables_for_hospital(second_hospital_id)[0]

    resp = client.post(
        f"/api/portal/bookings/{reservation.id}/reassign-table", headers=headers,
        json={"table_id": foreign_table["id"]},
    )
    assert resp.status_code == 400
