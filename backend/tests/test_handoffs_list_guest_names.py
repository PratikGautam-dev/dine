# tests/test_handoffs_list_guest_names.py
"""GET /api/portal/handoffs returns each conversation's guest NAME (from their profile at that restaurant), so the
Messages page can show who is asking instead of only a phone number."""
import os

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from tests.test_table_reschedule import _portal_login  # noqa: E402

PHONE_A = "5491100000051"
PHONE_B = "5491100000052"


def _list(hospital_id, password):
    client, headers = _portal_login(hospital_id, password)
    resp = client.get("/api/portal/handoffs?status=all", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["handoffs"]


def test_every_conversation_carries_the_guests_name(hospital_id):
    db.create_patient_profile(hospital_id, PHONE_A, "Riya Sharma", 30)
    db.create_patient_profile(hospital_id, PHONE_B, "Arjun Mehta", 30)
    db.create_handoff_request(hospital_id, PHONE_A, "patient_requested", "Can I speak to someone?")
    db.create_handoff_request(hospital_id, PHONE_A, "system_error", "oops")
    db.create_handoff_request(hospital_id, PHONE_B, "patient_requested", "Table for 6?")
    rows = _list(hospital_id, "handoff-pw-1")
    assert len(rows) == 3
    assert {r["phone"]: r["patient_name"] for r in rows} == {PHONE_A: "Riya Sharma", PHONE_B: "Arjun Mehta"}
    assert all(r["message_text"] for r in rows)  # the rest of each row is untouched


def test_a_number_with_no_profile_or_a_blank_name_is_null(hospital_id):
    db.create_patient_profile(hospital_id, PHONE_B, "Someone", 30)
    conn = get_connection()
    conn.execute("UPDATE patients SET name = '  ' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_B))
    conn.commit()
    db.create_handoff_request(hospital_id, PHONE_A, "patient_requested", "never registered")
    db.create_handoff_request(hospital_id, PHONE_B, "patient_requested", "blank name")
    names = {r["phone"]: r["patient_name"] for r in _list(hospital_id, "handoff-pw-2")}
    assert names == {PHONE_A: None, PHONE_B: None}


def test_names_never_come_from_another_restaurant(hospital_id, second_hospital_id):
    # B's profile is created first so it holds the lower id -- an unscoped lookup would pick it
    db.create_patient_profile(second_hospital_id, PHONE_A, "Name At B", 30)
    db.create_handoff_request(hospital_id, PHONE_A, "patient_requested", "hello")
    assert [r["patient_name"] for r in _list(hospital_id, "handoff-pw-3")] == [None]
