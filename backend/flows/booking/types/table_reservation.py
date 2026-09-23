# flows/booking/types/table_reservation.py
"""Stage 4 (table-availability, ARCHITECTURE_REFERENCE_FOR_FORKING.md
Section 4/7), Stage 3 of 4: the WhatsApp flow itself. Replaces
new_consultation.py (deleted) as the "new" type's own flow -- confirmed with
the user: party size -> optional section preference -> date -> time ->
auto-assigned table -> confirm, instead of department -> doctor -> date ->
slot -> confirm. The guest never picks a specific table by name; which table
gets assigned is resolved inside connector.create_table_reservation()'s own
advisory lock at confirm time (book.py), nearest-fit by capacity.

No validate_booking/validate_department hooks (unlike new_consultation.py's
old same-department/same-day conflict rules) -- those were healthcare-
specific reasoning ("one active consultation per department") with no
restaurant equivalent; a guest reasonably CAN hold two separate reservations."""
import db.repository as db
from core.translations import t
from core.translations.booking import (
    ASK_PARTY_SIZE,
    ASK_TABLE_SECTION,
    CANCEL_BUTTON,
    CONFIRM_BUTTON,
    CONSULTATION_FEE_LINE,
    LARGE_PARTY_HANDOFF_TEXT,
    NO_SECTION_PREFERENCE_OPTION,
    NO_TABLES_AVAILABLE,
    PARTY_SIZE_LARGE_OPTION,
    PARTY_SIZE_SECTION_TITLE,
    TABLE_RESERVATION_CONFIRMATION_SUMMARY,
    TABLE_RESERVATION_CONFIRMED,
    TABLE_RESERVATION_PENDING_CONFIRMATION,
    TABLE_SECTIONS_SECTION_TITLE,
    VIEW_PARTY_SIZES_BUTTON,
    VIEW_TABLE_SECTIONS_BUTTON,
)
from core.translations.common import BACK_OPTION
from core.whatsapp import WhatsAppClient

from flows.booking.state import (
    BACK_ID, CONFIRM_NO, CONFIRM_YES, STATE_AWAITING_APPOINTMENT_TYPE, STATE_AWAITING_DATE,
    STATE_AWAITING_PARTY_SIZE, STATE_AWAITING_TABLE_SECTION,
    _HISTORY_KEY, _push_history,
)
from flows.booking.types.base import TypeFlow

_STEPS = (STATE_AWAITING_PARTY_SIZE, STATE_AWAITING_TABLE_SECTION, STATE_AWAITING_DATE)
# STATE_AWAITING_TIME_SLOT/STATE_AWAITING_CONFIRMATION aren't listed -- same
# "not THIS type's own extra steps" precedent procedure.py's _STEPS comment
# establishes; they're the shared generic states every type flows through.

_LARGE_PARTY_ROW_ID = "party_size_large"
_NO_SECTION_PREFERENCE_ROW_ID = "no_section_preference"
_MAX_PARTY_SIZE = 8  # 9+ routes to the reception handoff -- no table-combining in v1


async def _send_party_size_menu(wa: WhatsAppClient, phone: str, language: str = "en") -> None:
    from flows.booking.messages import _send_back_button

    rows = [{"id": str(n), "title": str(n)} for n in range(1, _MAX_PARTY_SIZE + 1)]
    rows.append({"id": _LARGE_PARTY_ROW_ID, "title": t(PARTY_SIZE_LARGE_OPTION, language)})
    await wa.send_list(
        to=phone,
        body_text=t(ASK_PARTY_SIZE, language),
        button_text=t(VIEW_PARTY_SIZES_BUTTON, language),
        sections=[{"title": t(PARTY_SIZE_SECTION_TITLE, language), "rows": rows}],
    )
    await _send_back_button(wa, phone, language=language)


async def _on_table_reservation_selected(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, connector, context: dict, language: str = "en",
) -> None:
    """TypeFlow.on_selected: Step 1 asks party size instead of department."""
    history = _push_history(context, STATE_AWAITING_APPOINTMENT_TYPE)
    new_context = {**context, _HISTORY_KEY: history}
    sessions.set(hospital_id, phone, STATE_AWAITING_PARTY_SIZE, new_context)
    await _send_party_size_menu(wa, phone, language=language)


async def _handle_awaiting_party_size(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    from flows.booking.messages import _handle_back_navigation, _send_main_menu

    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            await _handle_back_navigation(wa, sessions, phone, hospital_id, context, connector, language=language)
            return
        if reply["id"] == _LARGE_PARTY_ROW_ID:
            # No table-combining in v1 (confirmed with the user) -- a party
            # this size needs a human to arrange seating, same "hand off to
            # staff" pattern flows/router.py's own reception_handoff branch
            # uses for the main-menu "Talk to Host" option.
            db.create_handoff_request(
                # "large_party" isn't one of handoff_requests.reason's two
                # allowed CHECK values ('patient_requested'/'system_error') --
                # reusing 'patient_requested' rather than a new migration for
                # one more reason value; message_text already says why.
                hospital_id, phone, reason="patient_requested",
                message_text="Guest requested a table for a party of 9 or more via WhatsApp.",
            )
            await wa.send_text(phone, t(LARGE_PARTY_HANDOFF_TEXT, language))
            sessions.reset(hospital_id, phone)
            return
        if reply["id"].isdigit() and 1 <= int(reply["id"]) <= _MAX_PARTY_SIZE:
            party_size = int(reply["id"])
            new_context = {
                **context, "party_size": party_size,
                _HISTORY_KEY: _push_history(context, STATE_AWAITING_PARTY_SIZE),
            }
            sessions.set(hospital_id, phone, STATE_AWAITING_TABLE_SECTION, new_context)
            await _send_table_section_menu(wa, phone, hospital_id, connector, language=language)
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_PARTY_SIZE, context)
    await _send_party_size_menu(wa, phone, language=language)


async def _send_table_section_menu(wa: WhatsAppClient, phone: str, hospital_id: int, connector, language: str = "en") -> None:
    from flows.booking.messages import _send_back_button

    sections = connector.get_departments(hospital_id)
    rows = [{"id": _NO_SECTION_PREFERENCE_ROW_ID, "title": t(NO_SECTION_PREFERENCE_OPTION, language)}]
    rows.extend({"id": s["id"], "title": s["name"]} for s in sections)
    await wa.send_list(
        to=phone,
        body_text=t(ASK_TABLE_SECTION, language),
        button_text=t(VIEW_TABLE_SECTIONS_BUTTON, language),
        sections=[{"title": t(TABLE_SECTIONS_SECTION_TITLE, language), "rows": rows}],
    )
    await _send_back_button(wa, phone, language=language)


async def _handle_awaiting_table_section(
    wa: WhatsAppClient, sessions, phone: str, hospital_id: int, reply: dict, context: dict, connector,
    language: str = "en", closing_message_text: str | None = None,
) -> None:
    from flows.booking.messages import _handle_back_navigation, _send_date_menu, _send_main_menu

    party_size = context.get("party_size")
    if party_size is None:
        sessions.reset(hospital_id, phone)
        await _send_main_menu(wa, phone, "the restaurant", language=language, hospital_id=hospital_id)
        return

    if reply["type"] == "interactive_reply":
        if reply["id"] == BACK_ID:
            await _handle_back_navigation(wa, sessions, phone, hospital_id, context, connector, language=language)
            return
        section_id = None if reply["id"] == _NO_SECTION_PREFERENCE_ROW_ID else reply["id"]
        sections = connector.get_departments(hospital_id)
        if section_id is None or any(s["id"] == section_id for s in sections):
            section_name = None
            if section_id is not None:
                section_name = next((s["name"] for s in sections if s["id"] == section_id), None)
            new_context = {
                **context, "department_id": section_id, "department_name": section_name,
                _HISTORY_KEY: _push_history(context, STATE_AWAITING_TABLE_SECTION),
            }
            if not connector.get_available_table_slots(hospital_id, party_size, section_id):
                sessions.reset(hospital_id, phone)
                await wa.send_text(phone, t(NO_TABLES_AVAILABLE, language))
                await _send_main_menu(wa, phone, "the restaurant", language=language, hospital_id=hospital_id)
                return
            sessions.set(hospital_id, phone, STATE_AWAITING_DATE, new_context)
            await _send_date_menu(
                wa, phone, hospital_id, None, "", connector, language=language,
                party_size=party_size, table_department_id=section_id,
            )
            return
    sessions.set(hospital_id, phone, STATE_AWAITING_TABLE_SECTION, context)
    await _send_table_section_menu(wa, phone, hospital_id, connector, language=language)


def _build_table_reservation_confirmation_summary(context: dict, hospital_id: int) -> str:
    """TypeFlow.build_confirmation_summary hook -- no "Table: X" line, since
    which table gets assigned isn't known until connector.create_table_
    reservation() actually runs, inside its own advisory lock (book.py).

    fee_line: same "New Consultation"-only, omit-rather-than-fake-₹0
    discipline messages.py's own generic _send_confirmation already
    established for hospital_settings.new_consultation_fee -- reused here
    (not dropped) since this hook fully replaces that generic card."""
    language = context.get("language", "en")
    department_name = context.get("department_name")
    if not department_name:
        section_line = ""
    elif language == "hi":
        section_line = f"📍 सेक्शन: {department_name}\n"
    else:
        section_line = f"📍 Section: {department_name}\n"
    fee_line = ""
    new_consultation_fee = db.get_hospital_settings(hospital_id)["new_consultation_fee"]
    if new_consultation_fee is not None:
        amount = int(new_consultation_fee) if new_consultation_fee == int(new_consultation_fee) else new_consultation_fee
        fee_line = t(CONSULTATION_FEE_LINE, language, amount=amount)
    return t(
        TABLE_RESERVATION_CONFIRMATION_SUMMARY, language,
        patient_name=context.get("patient_name"),
        party_size=context.get("party_size"),
        section_line=section_line,
        date_label=context.get("date_label"), time_label=context.get("slot_time"),
        fee_line=fee_line,
    )


def _build_table_reservation_success_summary(appointment, context: dict, hospital_id: int) -> str:
    """TypeFlow.build_success_summary hook. Table Bookings follow-up: a 'pending' appointment (only
    reachable when this hospital opted into require_booking_confirmation) gets the "request received"
    text instead -- staff confirming it from the portal sends the real TABLE_RESERVATION_CONFIRMED
    text at that later point (portal/routes/bookings.py)."""
    language = context.get("language", "en")
    key = TABLE_RESERVATION_PENDING_CONFIRMATION if appointment.status == "pending" else TABLE_RESERVATION_CONFIRMED
    return t(
        key, language,
        reference_id=appointment.reference_id,
        patient_name=context.get("patient_name"),
        party_size=appointment.party_size or context.get("party_size"),
        date_label=appointment.scheduled_at.strftime("%d %b %Y"),
        time_label=appointment.scheduled_at.strftime("%I:%M %p"),
    )


FLOW = TypeFlow(
    type_id="new",
    steps=_STEPS,
    on_selected=_on_table_reservation_selected,
    build_confirmation_summary=_build_table_reservation_confirmation_summary,
    build_success_summary=_build_table_reservation_success_summary,
)
