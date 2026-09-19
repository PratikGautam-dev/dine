# tests/test_onboarding_api.py
"""
JSON API equivalent of the old tests/test_onboarding.py + test_faq_onboarding.py
(deleted) -- those tested admin/onboarding.py's server-rendered HTML wizard,
which was removed once the Next.js frontend (posting to POST /api/onboarding,
this module's actual subject) became the real onboarding UI. Ported rather
than dropped: admin/onboarding_api.py's submit_onboarding() shares its
validation logic (_validate_doctor_fields, _build_departments equivalent,
_parse_offsets) with the code the old HTML route used, so this is coverage
of currently-live, currently-used logic, not dead code.

Section 15 addition since the old tests were written: submit_onboarding()
requires BOTH a signed-in user (Authorization: Bearer, via the
user_auth_header fixture) AND a valid super-admin token (payload.super_admin_token,
via the super_admin_token fixture -- RBAC's docs/rbac-redis-plan.md
replacement for the old shared ADMIN_SECRET) -- two independent gates (see
admin/onboarding_api.py's own comment on why). Every test here carries both
unless specifically testing one of those two gates.
"""
import os

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")

import db.repository as db  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app)


def _valid_departments():
    return [{
        "name": "Pediatrics",
        "doctors": [
            {"name": "Meera Nair", "specialization": "Pediatrician", "qualification": "MBBS, MD",
             "years_experience": "10", "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
             "working_hours": ["09:00-13:00"], "slot_duration_minutes": "20"},
            {"name": "Dr. Arjun Singh", "specialization": "Pediatrician", "qualification": "MBBS",
             "years_experience": "5", "working_days": ["Mon", "Wed", "Fri"],
             "working_hours": ["14:00-17:00"], "slot_duration_minutes": "30"},
        ],
    }]


def _payload(super_admin_token, **overrides):
    data = {
        "super_admin_token": super_admin_token,
        "name": "St. Jude Community Hospital",
        "whatsapp_phone_number_id": "NEW_HOSPITAL_PHONE_ID",
        "access_token": "new-hospital-token",
        "app_secret": "new-hospital-secret",
        "welcome_message_text": "Welcome to St. Jude!",
        "reminder_offsets_hours": "24,1",
        "portal_password": "bookings-pw",
        "admin_email": "admin@stjude.example",
        "admin_password": "stjude-admin-pw",
        "enabled_features": ["book_appointment"],
        "data_tier": "tier1",
        "departments": _valid_departments(),
        "topics": [],
    }
    data.update(overrides)
    return data


def test_successful_onboarding_creates_real_rows_and_links_owner(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token), headers=user_auth_header)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["hospital_name"] == "St. Jude Community Hospital"
    assert body["portal_password_set"] is True
    assert body["admin_email"] == "admin@stjude.example"

    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")
    assert hospital is not None
    assert hospital.access_token == "new-hospital-token"
    assert sorted(hospital.reminder_offsets_hours) == [1, 24]

    departments = db.get_departments(hospital.id)
    assert len(departments) == 1
    doctors = db.get_doctors(hospital.id, departments[0]["id"])
    assert sorted(d["name"] for d in doctors) == ["Dr. Arjun Singh", "Meera Nair"]

    # Section 15: the signed-in user must actually be linked as an admin.
    # Two admins now exist for this hospital -- the signed-in Google user
    # (linked via link_hospital_owner) and the admin_email/admin_password
    # account created explicitly below -- there's no separate 'owner' role
    # to distinguish them (confirmed with the user, centralized on 'admin').
    owners = db.get_owners_for_hospital(hospital.id)
    assert {o.email for o in owners} == {"test-owner@example.com", "admin@stjude.example"}

    # RBAC (docs/rbac-redis-plan.md): the hospital's first staff_users admin
    # row + its default role_permissions matrix were seeded, not just the
    # legacy portal_password_hash.
    staff = db.get_staff_user_by_email("admin@stjude.example")
    assert staff is not None
    assert staff["role"] == "admin"
    assert staff["hospital_id"] == hospital.id
    assert db.get_role_permissions(hospital.id)  # non-empty: every (role, page) seeded


def test_requires_signed_in_user(hospital_id, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token))  # no Authorization header
    assert resp.status_code == 401
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_wrong_super_admin_token_rejected_even_when_signed_in(hospital_id, user_auth_header, super_admin_token):
    bad_payload = _payload(super_admin_token)
    bad_payload["super_admin_token"] = "wrong"
    resp = client.post("/api/onboarding", json=bad_payload, headers=user_auth_header)
    assert resp.status_code == 403
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_duplicate_phone_number_id_rejected(hospital_id, user_auth_header, super_admin_token):
    before = db.find_hospital_by_phone_number_id("123")  # the already-seeded hospital's number
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, whatsapp_phone_number_id="123"), headers=user_auth_header)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["errors"][0]
    after = db.find_hospital_by_phone_number_id("123")
    assert before.id == after.id


def test_missing_departments_rejected_when_booking_enabled(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, departments=[]), headers=user_auth_header)
    assert resp.status_code == 400
    assert any("section" in e.lower() for e in resp.json()["errors"])
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_doctor_with_invalid_working_day_rejected(hospital_id, user_auth_header, super_admin_token):
    departments = [{"name": "Pediatrics", "doctors": [
        {"name": "Dr. Bad Day", "working_days": ["Mon", "Funday"], "working_hours": ["09:00-13:00"], "slot_duration_minutes": "20"},
    ]}]
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, departments=departments), headers=user_auth_header)
    assert resp.status_code == 400
    assert any("invalid working day" in e.lower() for e in resp.json()["errors"])


def test_no_features_selected_rejected(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, enabled_features=[], departments=[]), headers=user_auth_header)
    assert resp.status_code == 400
    assert any("guest-experience" in e.lower() for e in resp.json()["errors"])


def test_unrecognized_feature_rejected(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, enabled_features=["book_appointment", "teleporting"]), headers=user_auth_header)
    assert resp.status_code == 400


def test_tier2_requires_api_fields(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, data_tier="tier2", api_base_url="", api_key=""), headers=user_auth_header)
    assert resp.status_code == 400
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_tier2_fields_save_correctly(hospital_id, user_auth_header, super_admin_token):
    resp = client.post(
        "/api/onboarding",
        json=_payload(super_admin_token, data_tier="tier2", api_base_url="https://erp.stjude.example/api", api_key="tier2-secret-key"),
        headers=user_auth_header,
    )
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")
    assert hospital.data_tier == "tier2"
    assert hospital.external_api_base_url == "https://erp.stjude.example/api"


def test_faq_only_hospital_created_with_topics_not_departments(hospital_id, user_auth_header, super_admin_token):
    resp = client.post(
        "/api/onboarding",
        json=_payload(super_admin_token,
            enabled_features=["faq"], departments=[], portal_password="",
            whatsapp_phone_number_id="FAQ_HOSPITAL_PHONE_ID",
            topics=[{"topic_label": "Hours", "answer_text": "Mon-Sat, 9-6."},
                    {"topic_label": "Location", "answer_text": "123 Main St."}],
        ),
        headers=user_auth_header,
    )
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("FAQ_HOSPITAL_PHONE_ID")
    assert hospital.enabled_features == ["faq"]
    topics = db.get_faq_topics(hospital.id)
    assert {(t["topic_label"], t["answer_text"]) for t in topics} == {
        ("Hours", "Mon-Sat, 9-6."), ("Location", "123 Main St."),
    }
    assert db.get_departments(hospital.id) == []


def test_faq_missing_topics_rejected(hospital_id, user_auth_header, super_admin_token):
    resp = client.post(
        "/api/onboarding",
        json=_payload(super_admin_token, enabled_features=["faq"], departments=[], portal_password="", topics=[],
                       whatsapp_phone_number_id="FAQ_HOSPITAL_PHONE_ID"),
        headers=user_auth_header,
    )
    assert resp.status_code == 400
    assert any("topic" in e.lower() for e in resp.json()["errors"])


def test_booking_and_faq_both_enabled_creates_both(hospital_id, user_auth_header, super_admin_token):
    resp = client.post(
        "/api/onboarding",
        json=_payload(super_admin_token,
            enabled_features=["book_appointment", "faq"], whatsapp_phone_number_id="BOTH_PHONE_ID",
            topics=[{"topic_label": "Hours", "answer_text": "Mon-Sat, 9-6."}],
        ),
        headers=user_auth_header,
    )
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("BOTH_PHONE_ID")
    assert set(hospital.enabled_features) == {"book_appointment", "faq"}
    assert len(db.get_departments(hospital.id)) == 1
    assert len(db.get_faq_topics(hospital.id)) == 1


# --- Feature-key alignment: the wizard's keys must match flows' real ones ---

def test_wizard_default_feature_keys_are_accepted_and_stored(hospital_id, user_auth_header, super_admin_token):
    """The onboarding wizard's default selection (frontend types.ts) -- these
    exact keys used to be rejected outright as 'Unrecognized' because the
    wizard still sent pre-_FEATURE_MENU names."""
    features = ["book_appointment", "reschedule", "cancel", "view_appointments", "faq"]
    resp = client.post(
        "/api/onboarding",
        json=_payload(super_admin_token, enabled_features=features, topics=[{"topic_label": "Hours", "answer_text": "9-5"}]),
        headers=user_auth_header,
    )
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")
    assert hospital.enabled_features == features
    assert len(db.get_departments(hospital.id)) == 1  # booking on -> the department/table rows were created too


def test_legacy_feature_keys_from_an_old_frontend_are_mapped_not_rejected(hospital_id, user_auth_header, super_admin_token):
    legacy = ["book_doctor_appointment", "tests_diagnostics", "reschedule", "hospital_info", "reception_handoff"]
    resp = client.post("/api/onboarding", json=_payload(super_admin_token, enabled_features=legacy), headers=user_auth_header)
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")
    assert hospital.enabled_features == ["book_appointment", "reschedule"]


def test_backfill_rewrites_stale_stored_feature_keys(hospital_id):
    import json

    from db.connection import get_connection
    from db.init_db import _backfill_stale_feature_keys

    conn = get_connection()
    conn.execute(
        "UPDATE hospitals SET enabled_features = ?, feature_labels = ? WHERE id = ?",
        (
            json.dumps(["book_doctor_appointment", "tests_diagnostics", "cancel", "hospital_info"]),
            json.dumps({"book_doctor_appointment": "Reserve", "hospital_info": "Info", "cancel": "Cancel it"}),
            hospital_id,
        ),
    )
    conn.commit()

    _backfill_stale_feature_keys(conn)
    hospital = db.get_hospital(hospital_id)
    assert hospital.enabled_features == ["book_appointment", "cancel"]
    assert hospital.feature_labels == {"book_appointment": "Reserve", "cancel": "Cancel it"}

    _backfill_stale_feature_keys(conn)  # idempotent
    assert db.get_hospital(hospital_id).enabled_features == ["book_appointment", "cancel"]


# --- Restaurant setup: onboarding creates REAL tables + operating hours ---

def _restaurant_payload(super_admin_token, **overrides):
    """What the current wizard sends: sections/tables + hours, no doctors."""
    data = _payload(
        super_admin_token,
        enabled_features=["book_appointment", "reschedule", "cancel", "view_appointments"],
        departments=[],
        sections=[
            {"name": "Main Hall", "tables": [{"name": "T1", "capacity": "2"}, {"name": "T2", "capacity": "4"}]},
            {"name": "Patio", "tables": [{"name": "P1", "capacity": 6}]},
        ],
        operating_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        operating_hours=["11:00-22:30"],
        default_turnover_minutes="90",
        booking_interval_minutes="30",
    )
    data.update(overrides)
    return data


def test_onboarding_creates_real_tables_and_operating_hours(hospital_id, user_auth_header, super_admin_token):
    resp = client.post("/api/onboarding", json=_restaurant_payload(super_admin_token), headers=user_auth_header)
    assert resp.status_code == 200, resp.text
    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")

    tables = db.get_all_tables_for_hospital(hospital.id)
    assert sorted((t["name"], t["capacity"]) for t in tables) == [("P1", 6), ("T1", 2), ("T2", 4)]
    assert {d["name"] for d in db.get_departments(hospital.id)} == {"Main Hall", "Patio"}
    # No placeholder doctor rows are created for a restaurant any more.
    assert all(db.get_doctors(hospital.id, d["id"]) == [] for d in db.get_departments(hospital.id))

    settings = db.get_hospital_settings(hospital.id)
    assert settings["operating_days"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert settings["operating_hours"] == ["11:00-22:30"]
    assert settings["default_turnover_minutes"] == 90 and settings["booking_interval_minutes"] == 30


def test_freshly_onboarded_restaurant_has_real_availability_with_no_manual_setup(hospital_id, user_auth_header, super_admin_token):
    """The demo scenario: nothing touched in the portal after onboarding."""
    client.post("/api/onboarding", json=_restaurant_payload(super_admin_token), headers=user_auth_header)
    hospital = db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID")

    assert db.get_available_table_slots(hospital.id, 4), "party of 4 must have seating times"
    assert db.get_available_table_slots(hospital.id, 6), "the 6-top on the patio must be bookable"
    assert db.get_available_table_slots(hospital.id, 7) == []  # nothing seats 7

    slot = db.get_available_table_slots(hospital.id, 4)[0]
    from datetime import datetime
    reservation = db.create_table_reservation(hospital.id, "919800000001", 4, datetime.fromisoformat(slot["id"]), patient_name="First Guest")
    assert reservation.table_id is not None and reservation.party_size == 4


def test_onboarding_rejects_booking_without_tables_or_hours(hospital_id, user_auth_header, super_admin_token):
    no_tables = client.post(
        "/api/onboarding", json=_restaurant_payload(super_admin_token, sections=[{"name": "Main Hall", "tables": []}]),
        headers=user_auth_header,
    )
    assert no_tables.status_code == 400
    assert any("table" in e.lower() for e in no_tables.json()["errors"])

    no_hours = client.post(
        "/api/onboarding", json=_restaurant_payload(super_admin_token, operating_days=[], operating_hours=[]),
        headers=user_auth_header,
    )
    assert no_hours.status_code == 400
    errors = " ".join(no_hours.json()["errors"]).lower()
    assert "day" in errors and "opening" in errors
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_onboarding_rejects_bad_table_capacity_and_impossible_hours(hospital_id, user_auth_header, super_admin_token):
    bad_capacity = client.post(
        "/api/onboarding",
        json=_restaurant_payload(super_admin_token, sections=[{"name": "Hall", "tables": [{"name": "T1", "capacity": "lots"}]}]),
        headers=user_auth_header,
    )
    assert bad_capacity.status_code == 400
    assert any("capacity" in e.lower() for e in bad_capacity.json()["errors"])

    zero = client.post(
        "/api/onboarding",
        json=_restaurant_payload(super_admin_token, sections=[{"name": "Hall", "tables": [{"name": "T1", "capacity": "0"}]}]),
        headers=user_auth_header,
    )
    assert zero.status_code == 400

    backwards = client.post(
        "/api/onboarding", json=_restaurant_payload(super_admin_token, operating_hours=["22:00-10:00"]), headers=user_auth_header,
    )
    assert backwards.status_code == 400
    assert any("before closing" in e.lower() for e in backwards.json()["errors"])

    too_short = client.post(
        "/api/onboarding",
        json=_restaurant_payload(super_admin_token, operating_hours=["10:00-10:30"], default_turnover_minutes="90"),
        headers=user_auth_header,
    )
    assert too_short.status_code == 400
    assert any("turnover" in e.lower() for e in too_short.json()["errors"])
    assert db.find_hospital_by_phone_number_id("NEW_HOSPITAL_PHONE_ID") is None


def test_onboarding_rejects_duplicate_table_names_in_a_section(hospital_id, user_auth_header, super_admin_token):
    resp = client.post(
        "/api/onboarding",
        json=_restaurant_payload(super_admin_token, sections=[{"name": "Hall", "tables": [{"name": "T1", "capacity": "2"}, {"name": "t1", "capacity": "4"}]}]),
        headers=user_auth_header,
    )
    assert resp.status_code == 400
    assert any("twice" in e.lower() for e in resp.json()["errors"])
