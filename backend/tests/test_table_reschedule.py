# tests/test_table_reschedule.py
"""Rescheduling a TABLE reservation, over WhatsApp and at the repository level.

Regression coverage for a hard crash: tapping "Reschedule" on any reservation
raised AttributeError ('Appointment' object has no attribute 'resource_id'),
the guest got a generic error and, because a system-error handoff is queued,
the bot then went silent on them. Also covers the guest-facing "None" leaks
(cancel confirmation, selection rows, reminders) that a table reservation --
which has no doctor -- used to produce."""
import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db
from main import app  # noqa: E402,F401  (imported at collection time like every other API test)
from core.session_store import InMemorySessionStore
from db.connection import IntegrityError
from flows.booking import handle_incoming
from reminders.scheduler import send_reminders
from tests.portal_login import portal_login  # noqa: E402

PHONE = "5491112345678"


class FakeWhatsAppClient:
    def __init__(self):
        self.sent = []

    async def send_text(self, to, text):
        self.sent.append(("text", {"to": to, "text": text}))

    async def send_list(self, to, body_text, button_text, sections, header_text=None, footer_text=None):
        self.sent.append(("list", {"to": to, "body_text": body_text, "sections": sections}))

    async def send_buttons(self, to, body_text, buttons, header_text=None, footer_text=None):
        self.sent.append(("buttons", {"to": to, "body_text": body_text, "buttons": buttons}))


def tap(option_id):
    return {"type": "interactive_reply", "id": option_id, "title": ""}


def _rows(kwargs):
    return [row for section in kwargs["sections"] for row in section["rows"]]


def _last_list(wa):
    for kind, kwargs in reversed(wa.sent):
        if kind == "list":
            return kwargs
    raise AssertionError("no list sent")


def _all_text(wa) -> str:
    parts = []
    for kind, kwargs in wa.sent:
        parts.append(kwargs.get("text") or kwargs.get("body_text") or "")
        for row in _rows(kwargs) if kind == "list" else []:
            parts.append(f"{row['title']} {row.get('description', '')}")
    return "\n".join(parts)


def _reserve(hospital_id, party_size, slot_index=0, phone=PHONE, **kwargs):
    slots = db.get_available_table_slots(hospital_id, party_size)
    return db.create_table_reservation(
        hospital_id, phone, party_size, datetime.fromisoformat(slots[slot_index]["id"]),
        patient_name="Reschedule Guest", **kwargs,
    )


@pytest.mark.asyncio
async def test_whatsapp_reschedule_of_a_table_reservation_works_end_to_end(hospital_id):
    wa, sessions = FakeWhatsAppClient(), InMemorySessionStore()
    appt = _reserve(hospital_id, 3)

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_reschedule"))
    rows = _rows(_last_list(wa))
    row = next(r for r in rows if r["id"] == f"appt_{appt.id}")
    assert "None" not in row["title"] and row["title"] == "Table for 3"  # no doctor -> no "None"

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(f"appt_{appt.id}"))  # used to crash here
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_RESCHEDULE_DATE"
    date_rows = _rows(_last_list(wa))
    assert date_rows, "table availability dates must be offered"

    target = next(
        s for s in db.get_available_table_slots(hospital_id, 3, exclude_appointment_id=appt.id)
        if s["id"] != appt.scheduled_at.isoformat()
    )
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(target["date"]))
    assert target["id"] in {r["id"] for r in _rows(_last_list(wa))}
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(target["id"]))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_RESCHEDULE_CONFIRM"
    kind, kwargs = wa.sent[-1]
    assert kind == "buttons" and "None" not in kwargs["body_text"]

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("confirm"))
    assert "None" not in _all_text(wa)

    assert db.get_appointment(hospital_id, appt.id).status == "rescheduled"
    moved = [a for a in db.get_all_appointments_for_hospital(hospital_id) if a.status == "booked" and a.phone == PHONE]
    assert len(moved) == 1
    assert moved[0].scheduled_at.isoformat() == target["id"]
    assert moved[0].party_size == 3 and moved[0].table_id is not None


@pytest.mark.asyncio
async def test_reschedule_does_not_go_silent_or_queue_a_handoff(hospital_id):
    wa, sessions = FakeWhatsAppClient(), InMemorySessionStore()
    appt = _reserve(hospital_id, 2)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_reschedule"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(f"appt_{appt.id}"))
    assert db.get_handoff_requests(hospital_id, status="open") == []


def test_a_table_reservation_can_shift_onto_time_it_currently_occupies(hospital_id):
    """Only one table seats 8, so moving 30 minutes later overlaps the
    reservation's OWN current slot -- must be allowed (and offered)."""
    appt = _reserve(hospital_id, 8)
    later = appt.scheduled_at + timedelta(minutes=30)

    assert later.isoformat() not in {s["id"] for s in db.get_available_table_slots(hospital_id, 8)}
    assert later.isoformat() in {s["id"] for s in db.get_available_table_slots(hospital_id, 8, exclude_appointment_id=appt.id)}

    moved = db.reschedule_table_reservation(hospital_id, appt.id, later)
    assert moved.scheduled_at == later and moved.table_id == appt.table_id
    assert db.get_appointment(hospital_id, appt.id).status == "rescheduled"


def test_lost_race_on_reschedule_leaves_the_original_reservation_intact(hospital_id):
    mine = _reserve(hospital_id, 8, slot_index=0)
    target = db.get_available_table_slots(hospital_id, 8, exclude_appointment_id=mine.id)[-1]
    # Someone else takes the only 8-top for that exact time first.
    db.create_table_reservation(hospital_id, "5490000000001", 8, datetime.fromisoformat(target["id"]), patient_name="Rival")

    with pytest.raises(IntegrityError):
        db.reschedule_table_reservation(hospital_id, mine.id, datetime.fromisoformat(target["id"]))
    assert db.get_appointment(hospital_id, mine.id).status == "booked"


def test_reschedule_table_reservation_rejects_other_tenants_and_non_table_rows(hospital_id, second_hospital_id):
    mine = _reserve(hospital_id, 2)
    with pytest.raises(ValueError, match="not found"):
        db.reschedule_table_reservation(second_hospital_id, mine.id, mine.scheduled_at + timedelta(days=1))

    doctor_appt = db.create_appointment(
        hospital_id, "5490000000002", "cardiology", "doc_card_1", db.get_slots(hospital_id, "doc_card_1")[0]["id"]
        and datetime.fromisoformat(db.get_slots(hospital_id, "doc_card_1")[0]["id"]),
    )
    with pytest.raises(ValueError, match="not a table reservation"):
        db.reschedule_table_reservation(hospital_id, doctor_appt.id, mine.scheduled_at + timedelta(days=1))


@pytest.mark.asyncio
async def test_cancel_of_a_table_reservation_never_says_none(hospital_id):
    wa, sessions = FakeWhatsAppClient(), InMemorySessionStore()
    appt = _reserve(hospital_id, 4, department_id="cardiology")

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_cancel"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(f"appt_{appt.id}"))
    confirm_text = wa.sent[-1][1]["body_text"]
    assert "None" not in confirm_text and "Cardiology" in confirm_text

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("confirm"))
    cancelled_text = next(kw["text"] for kind, kw in wa.sent if kind == "text" and "Cancelled" in kw["text"])
    assert "None" not in cancelled_text
    assert db.get_appointment(hospital_id, appt.id).status == "cancelled"


@pytest.mark.asyncio
async def test_reminder_for_a_table_reservation_never_says_none(hospital_id):
    db.create_table_reservation(
        hospital_id, PHONE, 4, datetime.now() + timedelta(hours=5), department_id="cardiology", patient_name="Guest",
    )
    wa = MagicMock()
    wa.send_text = AsyncMock()

    assert await send_reminders(wa, hospital_id, offsets_hours=[24]) == 1
    message = wa.send_text.call_args[0][1]
    assert "None" not in message
    assert "table reservation" in message and "for 4" in message and "Cardiology" in message


# --- Portal (staff) reschedule of a table reservation ---

def _portal_login(hosp_id: int, password: str):
    from fastapi.testclient import TestClient

    client = TestClient(app)
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
    return client, {"Authorization": f"Bearer {resp.json()['token']}"}


def test_portal_reschedule_of_a_table_reservation_needs_only_a_new_slot(hospital_id):
    """Used to 400 with 'Choose a valid department. / Choose a valid doctor.'"""
    client, headers = _portal_login(hospital_id, "resched-pw")
    appt = _reserve(hospital_id, 3)
    target = next(
        s for s in db.get_available_table_slots(hospital_id, 3, exclude_appointment_id=appt.id)
        if s["id"] != appt.scheduled_at.isoformat()
    )

    resp = client.post(f"/api/portal/bookings/{appt.id}/reschedule", headers=headers, json={"slot_id": target["id"]})
    assert resp.status_code == 200, resp.text
    assert db.get_appointment(hospital_id, appt.id).status == "rescheduled"
    booked = [a for a in db.get_all_appointments_for_hospital(hospital_id) if a.status == "booked"]
    assert [(a.scheduled_at.isoformat(), a.party_size) for a in booked] == [(target["id"], 3)]


def test_portal_reschedule_of_a_table_reservation_rejects_a_taken_slot_and_keeps_the_original(hospital_id):
    client, headers = _portal_login(hospital_id, "resched-pw-2")
    mine = _reserve(hospital_id, 8, slot_index=0)
    target = db.get_available_table_slots(hospital_id, 8, exclude_appointment_id=mine.id)[-1]
    db.create_table_reservation(hospital_id, "5490000000003", 8, datetime.fromisoformat(target["id"]), patient_name="Rival")

    resp = client.post(f"/api/portal/bookings/{mine.id}/reschedule", headers=headers, json={"slot_id": target["id"]})
    assert resp.status_code == 400
    assert "taken" in resp.json()["errors"][0].lower()
    assert db.get_appointment(hospital_id, mine.id).status == "booked"


def test_table_slots_endpoint_can_exclude_the_reservation_being_moved(hospital_id):
    client, headers = _portal_login(hospital_id, "resched-pw-3")
    appt = _reserve(hospital_id, 8)
    later = (appt.scheduled_at + timedelta(minutes=30)).isoformat()

    without = client.get("/api/portal/new-booking/table-slots", headers=headers, params={"party_size": 8}).json()["slots"]
    with_exclusion = client.get(
        "/api/portal/new-booking/table-slots", headers=headers,
        params={"party_size": 8, "exclude_appointment_id": appt.id},
    ).json()["slots"]
    assert later not in {s["id"] for s in without}
    assert later in {s["id"] for s in with_exclusion}
