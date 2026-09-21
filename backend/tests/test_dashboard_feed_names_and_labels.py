# tests/test_dashboard_feed_names_and_labels.py
"""The dashboard's activity feed: guests are shown by NAME (from their profile at that restaurant, never another
restaurant's), and every reservation status arrives as a readable label from the API -- including attended /
no-show and any status added later -- so the UI never has to translate raw values."""
import os
from datetime import datetime

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from db.repositories.dashboard import activity_label  # noqa: E402
from tests.test_table_reschedule import _portal_login  # noqa: E402

PHONE_A = "5491100000011"
PHONE_B = "5491100000012"
PHONE_C = "5491100000013"


def _reserve_for(hospital_id, phone, name, slot_index):
    slots = db.get_available_table_slots(hospital_id, 2)
    return db.create_table_reservation(
        hospital_id, phone, 2, datetime.fromisoformat(slots[slot_index]["id"]), patient_name=name,
    )


def _feed(hospital_id, password):
    client, headers = _portal_login(hospital_id, password)
    resp = client.get("/api/portal/dashboard", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["activity_feed"]


def test_feed_shows_the_guests_name_and_keeps_the_phone(hospital_id):
    _reserve_for(hospital_id, PHONE_A, "Priya Nair", 0)
    feed = _feed(hospital_id, "feed-pw-1")
    assert len(feed) == 1
    assert feed[0]["guest_name"] == "Priya Nair"
    assert feed[0]["phone"] == PHONE_A  # still there as the fallback / for reference


def test_a_guest_without_a_profile_name_gets_null_not_a_blank_or_another_guests_name(hospital_id):
    slot = db.get_slots(hospital_id, "doc_card_1")[0]
    db.create_appointment(hospital_id, PHONE_C, "cardiology", "doc_card_1", datetime.fromisoformat(slot["id"]))
    conn = db.get_connection()
    conn.execute("UPDATE patients SET name = '   ' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_C))
    conn.commit()
    feed = _feed(hospital_id, "feed-pw-2")
    assert len(feed) == 1 and feed[0]["guest_name"] is None


def test_the_name_comes_from_this_restaurants_profile_never_another_restaurants(hospital_id, second_hospital_id):
    """The same phone is a guest at both restaurants under different names; A's feed must use A's, and a phone that
    only has a profile at B must show no name at all in A's feed. B's profiles are created FIRST so they have the
    lower ids -- an unscoped "first profile for this phone" lookup would pick them and leak."""
    db.create_patient_profile(second_hospital_id, PHONE_A, "Name At B", 30)
    db.create_patient_profile(second_hospital_id, PHONE_B, "Only Known At B", 30)

    _reserve_for(hospital_id, PHONE_A, "Name At A", 0)
    slot = db.get_slots(hospital_id, "doc_card_1")[0]
    db.create_appointment(hospital_id, PHONE_B, "cardiology", "doc_card_1", datetime.fromisoformat(slot["id"]))
    # at A this guest never gave a name
    conn = db.get_connection()
    conn.execute("UPDATE patients SET name = '' WHERE hospital_id = ? AND phone = ?", (hospital_id, PHONE_B))
    conn.commit()

    names = {e["phone"]: e["guest_name"] for e in _feed(hospital_id, "feed-pw-3")}
    assert names[PHONE_A] == "Name At A"
    assert names[PHONE_B] is None
    assert "Name At B" not in str(names) and "Only Known At B" not in str(names)


def test_every_status_arrives_as_a_readable_label(hospital_id):
    booked = _reserve_for(hospital_id, PHONE_A, "Booked Guest", 0)
    cancelled = _reserve_for(hospital_id, PHONE_B, "Cancelled Guest", 2)
    attended = _reserve_for(hospital_id, PHONE_C, "Attended Guest", 4)
    no_show = _reserve_for(hospital_id, "5491100000014", "NoShow Guest", 6)
    db.cancel_appointment(hospital_id, cancelled.id)
    assert db.mark_attendance(hospital_id, attended.id, True)
    assert db.mark_attendance(hospital_id, no_show.id, False)

    labels = {e["guest_name"]: e["label"] for e in _feed(hospital_id, "feed-pw-4")}
    assert labels == {
        "Booked Guest": "Booked reservation",
        "Cancelled Guest": "Cancelled reservation",
        "Attended Guest": "Attended reservation",
        "NoShow Guest": "No-show reservation",
    }
    assert booked.id  # created


def test_activity_label_never_returns_a_raw_status_value():
    assert activity_label("booked") == "Booked reservation"
    assert activity_label("rescheduled") == "Rescheduled reservation"
    assert activity_label("attended") == "Attended reservation"
    assert activity_label("no_show") == "No-show reservation"
    # a status added later, with no hand-written label yet, still reads as a sentence
    assert activity_label("waitlisted") == "Waitlisted reservation"
    assert activity_label("seated_late") == "Seated late reservation"
    for status in ("some_new_status", "checked_in", "pending_payment"):
        label = activity_label(status)
        assert "_" not in label and label.endswith(" reservation") and label[0].isupper()
