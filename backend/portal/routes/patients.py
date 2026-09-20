from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import _authenticate, authorize
from portal.routes.bookings import _appointment_json

router = APIRouter()


@router.get("/api/portal/patients")
async def portal_patients(search: str = "", authorization: str | None = Header(default=None)):
    """Every guest of the caller's own restaurant."""
    principal, error = authorize(authorization, "patients", "view")
    if error:
        return error
    hospital = principal.hospital
    return JSONResponse({"patients": db.list_patients(hospital.id, search=search)})


@router.post("/api/portal/patients/delete")
async def portal_delete_patients(payload: dict, authorization: str | None = Header(default=None)):
    """Bulk delete for the patients list's row checkboxes + "Delete
    selected" action. Uses db.delete_patient_hard() -- dev/testing only, see
    that function's docstring for the swap to db.delete_patient_soft()
    before production. Registered ahead of the /{patient_id} routes below --
    FastAPI matches routes in registration order, and a later registration
    here would let POST /api/portal/patients/{patient_id} match "delete" as
    a patient_id string first, failing int coercion with a 422."""
    principal, error = authorize(authorization, "patients", "delete")
    if error:
        return error
    hospital = principal.hospital
    patient_ids = (payload or {}).get("patient_ids") or []
    if not isinstance(patient_ids, list) or not patient_ids:
        return JSONResponse({"error": "patient_ids is required."}, status_code=400)
    deleted = [pid for pid in patient_ids if db.delete_patient_hard(hospital.id, pid)]
    for pid in deleted:
        db.record_audit_log(
            "portal", hospital.id, "tenant portal", "patient.delete",
            entity_type="patient", entity_id=str(pid),
        )
    return JSONResponse({"deleted": deleted})


# --- Patient detail: demographics, visit history, notes, documents
# (Section 12.10) ---

def _patient_json(p: dict) -> dict:
    return {
        "id": p["id"], "phone": p["phone"], "name": p["name"],
        # Patient identity system (Spec.md Section 0): the permanent,
        # human-readable id (PAT-<hospital short code>-<seq>) -- None only
        # for a patient predating the backfill, which db/init_db.py's
        # _backfill_patient_display_ids() catches up on every startup.
        "patient_display_id": p.get("patient_display_id"),
        "mrn": p.get("mrn"),
        "date_of_birth": p.get("date_of_birth"), "gender": p.get("gender"), "address": p.get("address"),
        "created_at": p["created_at"],
        # CareConnect architecture doc alignment (Spec.md Section 0), Section
        # 18's Patient Master state model -- "active" for every patient that
        # predates this column too (db/schema.sql's own default).
        "status": p.get("status", "active"),
    }


@router.get("/api/portal/patients/{patient_id}")
async def portal_patient_detail(patient_id: int, authorization: str | None = Header(default=None)):
    """One guest of the caller's own restaurant, with their visit history."""
    principal, error = authorize(authorization, "patients", "view")
    if error:
        return error
    hospital = principal.hospital
    patient = db.get_patient(hospital.id, patient_id)
    if patient is None:
        return JSONResponse({"error": "No such patient."}, status_code=404)

    visit_history = db.get_patient_visit_history(hospital.id, patient_id)
    validity_days = db.get_followup_validity_days(hospital.id)

    return JSONResponse({
        "patient": _patient_json(patient),
        "visit_history": [_appointment_json(a, validity_days) for a in visit_history],
    })


@router.post("/api/portal/patients/{patient_id}")
async def portal_update_patient(patient_id: int, payload: dict, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "patients", "write")
    if error:
        return error
    hospital = principal.hospital
    updated = db.update_patient_demographics(
        hospital.id, patient_id,
        date_of_birth=(payload or {}).get("date_of_birth") or None,
        gender=(payload or {}).get("gender") or None,
        address=(payload or {}).get("address") or None,
    )
    if updated is None:
        return JSONResponse({"error": "No such patient."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "patient.update",
        entity_type="patient", entity_id=str(patient_id),
        after={
            "date_of_birth": updated.get("date_of_birth"),
            "gender": updated.get("gender"),
            "address": updated.get("address"),
        },
    )
    return JSONResponse({"patient": _patient_json(updated)})


@router.post("/api/portal/patients/{patient_id}/status")
async def portal_set_patient_status(patient_id: int, payload: dict, authorization: str | None = Header(default=None)):
    """CareConnect architecture doc alignment (Spec.md Section 0), Section
    18: staff-side way to block/reactivate a patient record -- a hospital-
    level fact about the PATIENT, independent of any phone's own link to
    them (db.set_patient_status()'s own docstring). "active" un-blocks."""
    principal, error = authorize(authorization, "patients", "write")
    if error:
        return error
    hospital = principal.hospital
    status = (payload or {}).get("status")
    if status not in db.PATIENT_STATUSES:
        return JSONResponse({"error": f"status must be one of {db.PATIENT_STATUSES}."}, status_code=400)
    updated = db.set_patient_status(hospital.id, patient_id, status)
    if updated is None:
        return JSONResponse({"error": "No such patient."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "patient.status_change",
        entity_type="patient", entity_id=str(patient_id), after={"status": status},
    )
    return JSONResponse({"patient": _patient_json(updated)})

