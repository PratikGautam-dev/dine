# tests/test_bookings_list_guest_names.py
"""GET /api/portal/bookings returns each reservation's guest NAME (from their profile at that restaurant), so the
Reservations page can show who is coming instead of only a phone number."""
import os
from datetime import datetime

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from tests.test_table_reschedule import _portal_login  # noqa: E402

PHONE_A = "5491100000021"
PHONE_B = "5491100000022"


def _reserve_for(hospital_id, phone, name, slot_index):
    slots = db.get_available_table_slots(hospital_id, 2)
    return db.create_table_reservation(
        hospital_id, phone, 2, datetime.fromisoformat(slots[slot_index]["id"]), patient_name=name,
    )


def _list(hospital_id, password):
    client, headers = _portal_login(hospital_id, password)
    resp = client.get("/api/portal/bookings", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["appointments"]


def test_every_reservation_carries_the_guests_name(hospital_id):
    _reserve_for(hospital_id, PHONE_A, "Riya Sharma", 0)
    _reserve_for(hospital_id, PHONE_A, "Riya Sharma", 2)  # same guest twice: one lookup serves both rows
    _reserve_for(hospital_id, PHONE_B, "Arjun Mehta", 4)
    rows = _list(hospital_id, "list-pw-1")
    assert len(rows) == 3
    assert {r["phone"]: r["patient_name"] for r in rows} == {PHONE_A: "Riya Sharma", PHONE_B: "Arjun Mehta"}
    assert all(r["phone"] for r in rows)  # the phone is still there too


def test_an_unnamed_guest_is_null_not_blank(hospital_id):
    _reserve_for(hospital_id, PHONE_A, "Someone", 0)
    conn = db.get_connection()
    conn.execute("UPDATE patients SET name = '  ' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_A))
    conn.commit()
    assert _list(hospital_id, "list-pw-2")[0]["patient_name"] is None


def test_names_never_come_from_another_restaurant(hospital_id, second_hospital_id):
    # B's profiles are created first so they hold the lower ids -- an unscoped lookup would pick them
    db.create_patient_profile(second_hospital_id, PHONE_A, "Name At B", 30)
    db.create_patient_profile(second_hospital_id, PHONE_B, "Only Known At B", 30)
    _reserve_for(hospital_id, PHONE_A, "Name At A", 0)
    _reserve_for(hospital_id, PHONE_B, "Placeholder", 2)
    conn = db.get_connection()
    conn.execute("UPDATE patients SET name = '' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_B))
    conn.commit()

    names = {r["phone"]: r["patient_name"] for r in _list(hospital_id, "list-pw-3")}
    assert names == {PHONE_A: "Name At A", PHONE_B: None}


def test_name_lookup_helper_edge_cases(hospital_id):
    assert db.get_patient_names_by_phone(hospital_id, []) == {}
    assert db.get_patient_names_by_phone(hospital_id, ["5490000000000"]) == {}
