# db/repositories/patient_records.py
"""Patient visit history (Section 12.10). Split out of db/repository.py --
see ARCHITECTURE_PLAN.md Phase 1.

Dine Connect fork: this module used to also hold patient visit notes and
document uploads (clinical notes/prescriptions/lab reports) -- deleted
entirely (ARCHITECTURE_REFERENCE_FOR_FORKING.md Section 5), no dining
equivalent. get_patient_visit_history() below is reusable ("this guest's
past bookings") and stays."""
from sqlalchemy import select

from db.connection import get_session
from db.models import Appointment, _row_to_appointment
from db.orm_models import AppointmentRow, PatientRow
from db.repositories.appointments import _appointment_select_stmt


def get_patient_visit_history(hospital_id: int, patient_id: int) -> list[Appointment]:
    """Every appointment for this patient (any status, most recent first) --
    reuses the exact same `appointments` data the rest of the app already
    has; no new table needed for "visit history" itself, only for notes/
    documents attached to a visit. Returns [] for an unknown/foreign
    patient_id rather than raising -- callers that need to distinguish
    "no visits" from "no such patient" should call get_patient() first.

    Now ORM-based, reusing appointments.py's _appointment_select_stmt() --
    that domain's migration landed, closing the deferral this function's
    docstring used to describe."""
    session = get_session()
    patient = session.execute(
        select(PatientRow.phone).where(PatientRow.hospital_id == hospital_id, PatientRow.id == patient_id)
    ).first()
    if patient is None:
        return []
    rows = session.execute(
        _appointment_select_stmt()
        .where(AppointmentRow.hospital_id == hospital_id, AppointmentRow.phone == patient.phone)
        .order_by(AppointmentRow.scheduled_at.desc())
    ).all()
    return [_row_to_appointment(r._mapping) for r in rows]

