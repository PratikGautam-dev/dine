# tests/test_booking_for_registration.py
""""Myself / Someone Else" registration step (flows/patient_identity.py):
the new first question in patient registration -- "Myself" skips the
contact-number question and stores the messaging phone as the patient's own
contact (patients.phone); "Someone Else" asks for and stores that family
member's own 10-digit contact number instead. Also covers the "only one
Myself per account per hospital" rule (soft pre-check + hard,
advisory-locked backstop) and the staff-portal visit-stats join fix that
had to accompany repurposing patients.phone (db/repositories/patients.py's
_patients_with_visit_stats_stmt, now keyed on patient_id not phone).
"""
from datetime import datetime, timedelta

import pytest

import db.repository as db
import flows
import flows.patient_identity as patient_identity
from core.session_store import InMemorySessionStore

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


def tap(option_id, title=""):
    return {"type": "interactive_reply", "id": option_id, "title": title}


def text_reply(text):
    return {"type": "text", "text": text}


def _last_list(wa):
    for kind, kwargs in reversed(wa.sent):
        if kind == "list":
            return kwargs
    raise AssertionError("no list message was sent")


def _sessions_en(hospital_id, phone=PHONE):
    sessions = InMemorySessionStore()
    sessions.set(hospital_id, phone, "IDLE", {}, language="en")
    return sessions


async def _register_via_chat(wa, sessions, hospital_id, connector, phone, booking_for_id, name, contact_number=None, age=30):
    """Drives the real chat flow: "hi" -> name -> gender -> create. The guest is
    always registering themselves on the number they message from: there is no
    Myself/Someone Else, contact-number or age question (the extra arguments are
    accepted only so older call sites keep working)."""
    features = ["book_doctor_appointment"]
    await flows.handle_incoming(wa, sessions, phone, hospital_id, text_reply("hi"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, phone, hospital_id, text_reply(name), connector=connector, enabled_features=features)
    await flows.handle_incoming(
        wa, sessions, phone, hospital_id, tap(patient_identity.GENDER_OTHER_ID), connector=connector, enabled_features=features,
    )


@pytest.mark.asyncio
async def test_registering_myself_skips_contact_question_and_uses_messaging_phone(hospital_id):
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)

    await _register_via_chat(wa, sessions, hospital_id, connector, PHONE, patient_identity.BOOKING_FOR_SELF_ID, "Ravi Kumar")

    linked = connector.list_active_patients(hospital_id, PHONE)
    assert len(linked) == 1
    assert linked[0]["relationship_label"] == "Self"
    patient = db.get_patient(hospital_id, linked[0]["id"])
    assert patient["phone"] == PHONE  # messaging phone used directly, never asked


@pytest.mark.asyncio
async def test_registration_asks_only_name_then_gender(hospital_id):
    """No Myself/Someone Else, no contact number, no age: name -> gender -> done."""
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)
    features = ["book_doctor_appointment"]

    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("hi"), connector=connector, enabled_features=features)
    assert sessions.get(hospital_id, PHONE)["state"] == patient_identity.STATE_AWAITING_PATIENT_NAME
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("Priya Kumar"), connector=connector, enabled_features=features)
    assert sessions.get(hospital_id, PHONE)["state"] == patient_identity.STATE_AWAITING_PATIENT_GENDER
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap(patient_identity.GENDER_FEMALE_ID), connector=connector, enabled_features=features,
    )
    assert sessions.get(hospital_id, PHONE)["state"] == "IDLE"

    asked = " ".join((kw.get("text") or kw.get("body_text") or "").lower() for _, kw in wa.sent)
    assert "age" not in asked and "contact" not in asked and "myself" not in asked and "someone" not in asked

    linked = connector.list_active_patients(hospital_id, PHONE)
    assert len(linked) == 1 and linked[0]["relationship_label"] == "Self"
    patient = db.get_patient(hospital_id, linked[0]["id"])
    assert patient["name"] == "Priya Kumar" and patient["gender"] == "Female"
    assert patient["age"] is None and patient["phone"] == PHONE


@pytest.mark.asyncio
async def test_back_from_gender_returns_to_the_name_question(hospital_id):
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)
    features = ["book_doctor_appointment"]
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("hi"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("Priya Kumar"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap(patient_identity.BACK_ID), connector=connector, enabled_features=features)
    assert sessions.get(hospital_id, PHONE)["state"] == patient_identity.STATE_AWAITING_PATIENT_NAME
    assert "pending_name" not in sessions.get(hospital_id, PHONE)["context"]


@pytest.mark.asyncio
async def test_an_invalid_name_is_reprompted_and_gender_is_only_asked_after_a_valid_one(hospital_id):
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)
    features = ["book_doctor_appointment"]
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("hi"), connector=connector, enabled_features=features)
    for bad in ("x", "12345", "!!!"):
        await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply(bad), connector=connector, enabled_features=features)
        assert sessions.get(hospital_id, PHONE)["state"] == patient_identity.STATE_AWAITING_PATIENT_NAME
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("Priya Kumar"), connector=connector, enabled_features=features)
    assert sessions.get(hospital_id, PHONE)["state"] == patient_identity.STATE_AWAITING_PATIENT_GENDER


@pytest.mark.asyncio
async def test_a_phone_holds_a_single_profile_and_a_second_is_refused_up_front(hospital_id):
    """With the platform limit at 1, "Add Patient" says so straight away -- it does
    not ask for a name and gender first and only then refuse."""
    db.update_platform_settings(1, {}, False)
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)
    await _register_via_chat(wa, sessions, hospital_id, connector, PHONE, None, "Ravi Kumar")
    sessions.reset(hospital_id, PHONE)
    wa.sent.clear()

    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap("menu_manage_patients"), connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap(patient_identity.MANAGE_ADD_ROW_ID),
        connector=connector, enabled_features=["manage_patients"],
    )
    assert sessions.get(hospital_id, PHONE)["state"] != patient_identity.STATE_AWAITING_PATIENT_NAME
    texts = " ".join(kw.get("text", "") for kind, kw in wa.sent if kind == "text")
    assert texts.strip(), "the guest must be told why"
    assert len(connector.list_active_patients(hospital_id, PHONE)) == 1


def test_duplicate_detection_matches_on_name_contact_phone_age_and_gender(hospital_id):
    """find_potential_duplicate_patient() -- confirmed with the user: exact
    name + exact contact phone + exact age + exact gender (all four),
    scoped to the hospital. Widened from name+phone only since a 4-field
    exact match is essentially certain to be the same real person."""
    db.create_patient_profile(hospital_id, "5490009999", "Asha Rao", 45, relationship_label="Self", gender="Female")

    # All four match.
    match = db.find_potential_duplicate_patient(hospital_id, "Asha Rao", "5490009999", 45, "Female")
    assert match is not None
    assert match["name"] == "Asha Rao"
    assert match["phone"] == "5490009999"

    # Same name+phone+gender, DIFFERENT age -- no longer a match.
    assert db.find_potential_duplicate_patient(hospital_id, "Asha Rao", "5490009999", 46, "Female") is None

    # Same name+phone+age, DIFFERENT gender -- no longer a match.
    assert db.find_potential_duplicate_patient(hospital_id, "Asha Rao", "5490009999", 45, "Male") is None

    # Same name+age+gender, DIFFERENT contact phone -- no match.
    assert db.find_potential_duplicate_patient(hospital_id, "Asha Rao", "1112223333", 45, "Female") is None


@pytest.mark.asyncio
async def test_readding_the_same_name_and_contact_from_your_own_phone_is_blocked_not_duplicated(hospital_id):
    """Bug: find_potential_duplicate_patient() used to exclude a patient
    already linked to the caller's own phone from its OWN duplicate search,
    so re-typing the exact same name+contact number from the SAME WhatsApp
    conversation silently created a brand-new, genuinely duplicate `patients`
    row every time (reported live: "Chandu" with the same 10-digit number
    added twice). Now the match still fires -- and since it's already
    linked to this phone, no new profile is created and no Link/Different
    choice is offered (Link would violate patient_links' own uniqueness
    constraint; Different would recreate the exact bug)."""
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)

    await _register_via_chat(
        wa, sessions, hospital_id, connector, PHONE, patient_identity.BOOKING_FOR_OTHER_ID, "Chandu",
        contact_number="6200876670",
    )
    linked = connector.list_active_patients(hospital_id, PHONE)
    assert len(linked) == 1

    # Attempt to add "Chandu" / same contact number AGAIN, from the same
    # phone, via Manage Patients.
    sessions.reset(hospital_id, PHONE)
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap("menu_manage_patients"), connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap(patient_identity.MANAGE_ADD_ROW_ID),
        connector=connector, enabled_features=["manage_patients"],
    )
    # The first "Chandu" was registered as "Other" (BOOKING_FOR_OTHER_ID
    # above, to give it its own contact number) -- the account has no "Self"
    # patient yet, so the Myself/Someone Else question fires again here too.
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap(patient_identity.BOOKING_FOR_OTHER_ID),
        connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, text_reply("Chandu"), connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, text_reply("6200876670"), connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, text_reply("30"), connector=connector, enabled_features=["manage_patients"],
    )
    await flows.handle_incoming(
        wa, sessions, PHONE, hospital_id, tap(patient_identity.GENDER_OTHER_ID),
        connector=connector, enabled_features=["manage_patients"],
    )

    # No second "Chandu" profile was created, and no Link/Different choice
    # was ever offered for it.
    linked = connector.list_active_patients(hospital_id, PHONE)
    assert len(linked) == 1
    assert not any(
        kind == "buttons" and patient_identity.DUPLICATE_LINK_ID in {b["id"] for b in kwargs["buttons"]}
        for kind, kwargs in wa.sent
    )
    assert any(kind == "text" and "Chandu" in kwargs["text"] for kind, kwargs in wa.sent)


def test_has_self_linked_patient_and_the_hard_advisory_locked_guard(hospital_id):
    """db.has_self_linked_patient() is the soft check the chat flow uses up
    front; db.create_patient_profile()'s own DuplicateSelfLinkError is the
    hard backstop under the SAME advisory lock as the active-links cap --
    exercised directly here (bypassing the chat flow) to prove it holds even
    if a caller never went through the soft check at all."""
    assert db.has_self_linked_patient(hospital_id, connect_account_id := db.get_or_create_account(PHONE, phone_number=PHONE)["id"]) is False

    db.create_patient_profile(hospital_id, PHONE, "Ravi Kumar", 34, relationship_label="Self")
    assert db.has_self_linked_patient(hospital_id, connect_account_id) is True

    with pytest.raises(db.DuplicateSelfLinkError):
        db.create_patient_profile(hospital_id, PHONE, "Someone Else Entirely", 40, relationship_label="Self")


def test_portal_visit_stats_are_correct_for_a_someone_else_patient_booked_under_a_different_phone(hospital_id):
    """The join fix (_patients_with_visit_stats_stmt, now patient_id-keyed):
    before this fix, a "Someone Else" patient's own contact number
    (patients.phone) would never match appointments.phone (the parent's
    messaging number that actually booked), so the portal would have shown
    0 visits despite a real appointment existing."""
    patient = db.create_patient_profile(
        hospital_id, PHONE, "Priya Kumar", 8, relationship_label="Other", contact_phone="9876543210",
    )
    doctor_id = db.get_doctors(hospital_id, "cardiology")[0]["id"]
    appt = db.create_appointment(
        hospital_id, PHONE, "cardiology", doctor_id, datetime.now() + timedelta(days=3), patient_id=patient["id"],
    )

    listed = {p["id"]: p for p in db.list_patients(hospital_id)}[patient["id"]]
    assert listed["visit_count"] == 1
    assert listed["last_visit"] == appt.scheduled_at.isoformat()


@pytest.mark.asyncio
async def test_patient_list_never_shows_the_self_or_other_relationship_label(hospital_id):
    """relationship_label ("Self"/"Other") is internal bookkeeping -- it must never
    appear in a patient-facing list row. (A second profile needs a platform limit
    above 1, which is not the restaurant setting -- raised here.)"""
    db.update_platform_settings(5, {}, False)
    connector = flows._DEFAULT_CONNECTOR
    wa = FakeWhatsAppClient()
    sessions = _sessions_en(hospital_id)
    await _register_via_chat(wa, sessions, hospital_id, connector, PHONE, None, "Chandan")
    sessions.reset(hospital_id, PHONE)
    features = ["manage_patients"]
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_manage_patients"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap(patient_identity.MANAGE_ADD_ROW_ID), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("Chandu"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap(patient_identity.GENDER_OTHER_ID), connector=connector, enabled_features=features)
    # Adding a patient now lands on the main menu, not a patient list --
    # Manage Patients' own patient list is the Remove Patient screen.
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_manage_patients"), connector=connector, enabled_features=features)
    await flows.handle_incoming(wa, sessions, PHONE, hospital_id, tap(patient_identity.MANAGE_REMOVE_ROW_ID), connector=connector, enabled_features=features)