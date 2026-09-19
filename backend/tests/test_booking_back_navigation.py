# tests/test_booking_back_navigation.py
"""
Section 3.3 follow-up: "Go back" navigation at each of the booking flow's
interactive states. Stage 4 rebuild: the "new" type's own steps changed
from department -> doctor -> date -> time to party size -> table section ->
date -> time (ARCHITECTURE_REFERENCE_FOR_FORKING.md Section 4/7), so this
whole file's helpers/assertions were rewritten to drive the new steps --
structurally identical shape (still 4 interactive steps before
confirmation), same underlying history-stack mechanism (_push_history/
_HISTORY_KEY/_history_pop/_history_pop_to), only the two hospital-specific
steps changed to their restaurant equivalents.

Covers, per the task's own request:
  - Back from each state returns to the right prior state with the right
    data preserved (name/age never re-collected).
  - Back-then-forward-again produces a consistent, non-broken flow.
  - Back doesn't leak stale data into a fresh path forward (a different
    section picked after Back correctly re-scopes availability to it).
  - Composability with the reset-keyword escape hatch and the
    free-text-resends-current-message behavior.
"""
import db.repository as db
from flows.booking import (
    BACK_ID, CHANGE_APPOINTMENT_TYPE, CHANGE_DATE, CHANGE_TIME, GOTO_MAIN_MENU,
    handle_incoming,
)
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


def tap(option_id):
    return {"type": "interactive_reply", "id": option_id, "title": ""}


def text_reply(text):
    return {"type": "text", "text": text}


def _row_ids(kwargs):
    return {row["id"] for section in kwargs["sections"] for row in section["rows"]}


def _last_list(wa):
    """UX follow-up (Spec.md Section 0): "Back" moved out of the list itself
    into its own follow-up buttons message sent right after -- this finds
    the list itself regardless of a trailing Back-button message."""
    for kind, kwargs in reversed(wa.sent):
        if kind == "list":
            return kwargs
    raise AssertionError("no list message was sent")


def _first_section_id(hospital_id):
    return db.get_departments(hospital_id)[0]["id"]


async def _start_booking(wa, sessions, hospital_id, name="Ravi Kumar", age="34"):
    """Patient identity/UX follow-up (Spec.md Section 0), confirmed with the
    user: name/age is collected FIRST, right after "Book Appointment" is
    tapped -- before party size. Drives through both plus the appointment
    type step, landing on AWAITING_PARTY_SIZE."""
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_book"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply(name))
    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply(age))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_APPOINTMENT_TYPE"
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("new"))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_PARTY_SIZE"


async def _book_to_time_slot(wa, sessions, hospital_id, section_id=None):
    """Drives a fresh session through name/age -> party size -> section ->
    date, landing on AWAITING_TIME_SLOT. Returns date_str -- which table
    gets assigned isn't known until confirmation, so there's no table_id
    equivalent to return here (see create_table_reservation())."""
    await _start_booking(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("2"))
    section_row = section_id or "no_section_preference"
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(section_row))
    date_str = db.get_available_table_slots(hospital_id, 2, section_id)[0]["date"]
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(date_str))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_TIME_SLOT"
    return date_str


async def _book_to_confirmation(wa, sessions, hospital_id):
    """Name/age were already collected up front by _book_to_time_slot ->
    picking a slot now goes straight to AWAITING_CONFIRMATION."""
    date_str = await _book_to_time_slot(wa, sessions, hospital_id)
    slot_id = [s for s in db.get_available_table_slots(hospital_id, 2) if s["date"] == date_str][0]["id"]
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(slot_id))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_CONFIRMATION"
    return date_str, slot_id


async def test_back_from_table_section_returns_to_party_size(hospital_id):
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _start_booking(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("2"))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_TABLE_SECTION"

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_PARTY_SIZE"
    kwargs = _last_list(wa)
    assert {str(n) for n in range(1, 9)} <= _row_ids(kwargs)
    assert wa.sent[-1][0] == "buttons"  # the follow-up Back button


async def test_back_from_date_returns_to_table_section_same_choice(hospital_id):
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    section_id = _first_section_id(hospital_id)
    await _start_booking(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("2"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(section_id))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_DATE"

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_TABLE_SECTION"
    assert session["context"]["party_size"] == 2
    kwargs = _last_list(wa)
    assert "no_section_preference" in _row_ids(kwargs)
    assert section_id in _row_ids(kwargs)
    assert wa.sent[-1][0] == "buttons"  # the follow-up Back button


async def test_back_from_time_slot_returns_to_date_list_same_party_size(hospital_id):
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    date_str = await _book_to_time_slot(wa, sessions, hospital_id)

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_DATE"
    assert session["context"]["party_size"] == 2
    assert "date" not in session["context"]
    _last_list(wa)  # confirms a list was actually sent
    assert wa.sent[-1][0] == "buttons"  # the follow-up Back button


async def test_back_from_confirmation_offers_change_submenu(hospital_id):
    """Table reservation has no department/doctor step (flow.has_step(
    STATE_AWAITING_DEPARTMENT) is False) -- _send_change_selection_menu's
    own existing single_choice logic already omits Change Department/Change
    Doctor for exactly this reason (the same path diagnostic/lab/followup
    already exercise), no new code needed for this to be correct."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _book_to_confirmation(wa, sessions, hospital_id)

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_CHANGE_SELECTION"
    kind, kwargs = wa.sent[-1]
    assert kind == "list"
    row_ids = _row_ids(kwargs)
    assert row_ids == {CHANGE_APPOINTMENT_TYPE, CHANGE_DATE, CHANGE_TIME, GOTO_MAIN_MENU}


async def test_change_time_from_submenu_returns_to_time_list_preserving_name_age(hospital_id):
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    date_str, _slot_id = await _book_to_confirmation(wa, sessions, hospital_id)

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(CHANGE_TIME))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_TIME_SLOT"
    assert session["context"]["party_size"] == 2
    assert session["context"]["date"] == date_str
    # Back must never re-trigger name/age collection.
    assert session["context"]["patient_name"] == "Ravi Kumar"
    assert session["context"]["patient_age"] == 34


async def test_back_then_forward_again_is_consistent(hospital_id):
    """Back from date to table section, then re-pick the SAME (no-
    preference) section again -> lands back on a working date list, not a
    broken/duplicated state."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _start_booking(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("2"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("no_section_preference"))

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_TABLE_SECTION"

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("no_section_preference"))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_DATE"
    assert session["context"]["party_size"] == 2
    kwargs = _last_list(wa)
    date_str = db.get_available_table_slots(hospital_id, 2)[0]["date"]
    assert date_str in _row_ids(kwargs)


async def test_back_does_not_leak_stale_slots_when_picking_a_different_section(hospital_id):
    """Back from table-section to party-size, then forward through a
    DIFFERENT section -> the resulting date list must be scoped to that new
    section's own tables, not a stale copy of the first section's dates."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    sections = db.get_departments(hospital_id)
    assert len(sections) >= 2
    first_section_id, second_section_id = sections[0]["id"], sections[1]["id"]
    db.create_table(hospital_id, second_section_id, "T-Second", 4)

    await _start_booking(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("2"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(first_section_id))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_DATE"

    # Back to table-section list, then pick the DIFFERENT section.
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_TABLE_SECTION"
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(second_section_id))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_DATE"
    assert session["context"]["department_id"] == second_section_id

    kwargs = _last_list(wa)
    expected_dates = {s["date"] for s in db.get_available_table_slots(hospital_id, 2, second_section_id)}
    assert _row_ids(kwargs) <= expected_dates


async def test_back_at_party_size_returns_to_appointment_type(hospital_id):
    """Party size is no longer the very first interactive booking step --
    appointment type (added later) now precedes it, so Back at party size
    returns there instead of falling all the way back to the main menu."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _start_booking(wa, sessions, hospital_id)

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_APPOINTMENT_TYPE"
    kwargs = _last_list(wa)
    assert "new" in _row_ids(kwargs)


async def test_back_at_appointment_type_with_no_history_falls_back_to_main_menu(hospital_id):
    """Back tapped at the very first interactive booking step (appointment
    type) has nowhere earlier to return to -- falls back to the main menu
    instead of erroring or looping."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap("menu_book"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("Ravi Kumar"))
    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("34"))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_APPOINTMENT_TYPE"

    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "IDLE"
    row_ids = _row_ids(_last_list(wa))
    assert {"menu_book", "menu_reschedule", "menu_cancel"} <= row_ids  # the tenant's real menu


async def test_reset_keyword_still_works_after_back_navigation(hospital_id):
    """Composability: the reset-keyword escape hatch (e.g. "menu"/"hi") must
    still short-circuit correctly even mid-way through a Back-modified
    session, not conflict with the history stack."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _book_to_time_slot(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_DATE"

    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("menu"))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "IDLE"
    kind, kwargs = wa.sent[-1]
    assert kind == "list"
    assert _row_ids(kwargs) == {"menu_book", "menu_reschedule", "menu_cancel", "menu_faq"}


async def test_free_text_resend_includes_back_option_after_back_navigation(hospital_id):
    """Composability with the free-text-resends-current-message behavior
    (prior round's item 8): an unrecognized tap/text at a Back-reachable
    state re-sends THAT state's own menu -- the Back option is now its own
    follow-up buttons message (Spec.md Section 0's UX follow-up), not a row
    inside the list, but it's still re-sent every time, not a separate
    generic scolding message."""
    wa = FakeWhatsAppClient()
    sessions = InMemorySessionStore()
    await _book_to_time_slot(wa, sessions, hospital_id)
    await handle_incoming(wa, sessions, PHONE, hospital_id, tap(BACK_ID))
    assert sessions.get(hospital_id, PHONE)["state"] == "AWAITING_DATE"

    await handle_incoming(wa, sessions, PHONE, hospital_id, text_reply("blah"))
    session = sessions.get(hospital_id, PHONE)
    assert session["state"] == "AWAITING_DATE"
    _last_list(wa)  # confirms a list was actually sent
    kind, kwargs = wa.sent[-1]
    assert kind == "buttons"
    assert {b["id"] for b in kwargs["buttons"]} == {BACK_ID}
