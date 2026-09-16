# tests/test_appointment_type_flows.py
"""Unit tests for flows/booking/types/registry.py -- docs/per-appointment-type-flow-plan.md
Phase 1. No DB/connector needed, pure lookup logic.

Dine Connect fork: tele/second_opinion/diagnostic/lab types (and their
TypeFlow modules) were deleted (ARCHITECTURE_REFERENCE_FOR_FORKING.md
Section 5) -- only new/followup/procedure survive."""
from flows.booking.state import (
    STATE_AWAITING_CONFIRMATION, STATE_AWAITING_DATE, STATE_AWAITING_DEPARTMENT, STATE_AWAITING_PARTY_SIZE,
    STATE_AWAITING_PROCEDURE, STATE_AWAITING_TABLE_SECTION, STATE_AWAITING_TIME_SLOT,
)
from flows.booking.types.base import FULL_FLOW, NO_DOCTOR_FLOW
from flows.booking.types.registry import get_type_flow


def test_known_types_resolve_to_their_own_flow():
    # Stage 4 (table-availability): "new" no longer runs FULL_FLOW --
    # party size -> table section replaces department -> doctor (see
    # flows/booking/types/table_reservation.py's own _STEPS comment).
    assert get_type_flow("new").steps == (STATE_AWAITING_PARTY_SIZE, STATE_AWAITING_TABLE_SECTION, STATE_AWAITING_DATE)
    assert not get_type_flow("new").has_step(STATE_AWAITING_DEPARTMENT)
    assert get_type_flow("new").on_selected is not None
    # docs/per-appointment-type-flow-plan.md Phase 2 Step 2: Follow-up
    # auto-selects department/doctor via its own on_selected hook (the
    # patient's last attended appointment) instead of asking -- `steps`
    # reads the same as NO_DOCTOR_FLOW so shared bookkeeping (messages.py's
    # change-selection menu) correctly hides "Change Department"/"Change
    # Doctor" for it too.
    assert get_type_flow("followup").steps == NO_DOCTOR_FLOW
    assert get_type_flow("followup").on_selected is not None
    # Procedure booking rebuild: "procedure" no longer runs FULL_FLOW at all --
    # Step 1 picks a procedure from its own catalog (on_selected), and
    # everything after (instant date/time, or the approval-required
    # request-confirm detour) happens through procedure.py's own handlers,
    # deliberately left OUT of `steps` (same "detour states" precedent
    # lab.py's basket steps used to establish) -- `steps` is just the one
    # entry step.
    assert get_type_flow("procedure").steps == (STATE_AWAITING_PROCEDURE,)
    assert not get_type_flow("procedure").has_step(STATE_AWAITING_DEPARTMENT)
    assert get_type_flow("procedure").on_selected is not None
    for type_id in ("new", "followup"):
        assert get_type_flow(type_id).on_booking_confirmed is None


def test_unknown_type_id_falls_back_to_full_flow():
    """A hospital-custom appointment type not in the built-in catalog must
    get the safe, fully-generic pipeline rather than crashing."""
    flow = get_type_flow("some_future_custom_type")
    assert flow.steps == FULL_FLOW


def test_none_type_id_falls_back_to_full_flow():
    assert get_type_flow(None).steps == FULL_FLOW


def test_first_step_and_has_step():
    table_reservation = get_type_flow("new")
    assert table_reservation.first_step() == STATE_AWAITING_PARTY_SIZE
    assert table_reservation.has_step(STATE_AWAITING_PARTY_SIZE)
    assert not table_reservation.has_step(STATE_AWAITING_DEPARTMENT)

    # followup.py's own steps are still NO_DOCTOR_FLOW verbatim.
    no_doctor = get_type_flow("followup")
    assert no_doctor.first_step() == STATE_AWAITING_DATE
    assert not no_doctor.has_step(STATE_AWAITING_DEPARTMENT)
    assert no_doctor.has_step(STATE_AWAITING_CONFIRMATION)

    procedure = get_type_flow("procedure")
    assert procedure.first_step() == STATE_AWAITING_PROCEDURE
    assert not procedure.has_step(STATE_AWAITING_DEPARTMENT)
    assert not procedure.has_step(STATE_AWAITING_CONFIRMATION)


def test_next_step():
    # Every FULL_FLOW type: time-slot -> confirmation directly.
    assert get_type_flow("new").next_step(STATE_AWAITING_TIME_SLOT) == STATE_AWAITING_CONFIRMATION
    # Already at/past the last step, or an unrecognized state: safe fallback.
    assert get_type_flow("new").next_step(STATE_AWAITING_CONFIRMATION) == STATE_AWAITING_CONFIRMATION
    assert get_type_flow("new").next_step("SOME_UNKNOWN_STATE") == STATE_AWAITING_CONFIRMATION
