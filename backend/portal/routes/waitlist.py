# portal/routes/waitlist.py
"""Table Bookings follow-up: the walk-in/waitlist queue. Gated on the existing `appointments` page
permission -- this is part of the Table Bookings page, not a separate sidebar entry, so it needs no
new page-permission key."""
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from portal.deps import _authenticate, authorize

router = APIRouter()


class WaitlistEntryPayload(BaseModel):
    guest_name: str = ""
    phone: str | None = None
    party_size: int = 1


class AssignPayload(BaseModel):
    table_id: str = ""


@router.get("/api/portal/waitlist")
async def portal_waitlist(status: str | None = "waiting", authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "appointments", "view")
    if error:
        return error
    resolved_status = None if status == "all" else status
    return JSONResponse({"waitlist": db.list_waitlist(principal.hospital.id, status=resolved_status)})


@router.post("/api/portal/waitlist")
async def portal_add_to_waitlist(payload: WaitlistEntryPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "appointments", "write")
    if error:
        return error
    hospital = principal.hospital
    guest_name = payload.guest_name.strip()
    if not guest_name:
        return JSONResponse({"error": "Guest name is required."}, status_code=400)
    if payload.party_size < 1:
        return JSONResponse({"error": "Party size must be at least 1."}, status_code=400)
    entry = db.add_to_waitlist(hospital.id, guest_name, payload.party_size, phone=(payload.phone or "").strip() or None)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "waitlist.add",
        entity_type="waitlist_entry", entity_id=str(entry["id"]), after=entry,
    )
    return JSONResponse({"entry": entry})


@router.post("/api/portal/waitlist/{entry_id}/assign")
async def portal_assign_waitlist_entry(entry_id: int, payload: AssignPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "appointments", "write")
    if error:
        return error
    hospital = principal.hospital
    table_id = payload.table_id.strip()
    if not table_id:
        return JSONResponse({"error": "Choose a table to assign."}, status_code=400)
    entry = db.assign_waitlist_entry(hospital.id, entry_id, table_id, assigned_by=str(principal.staff_id))
    if entry is None:
        return JSONResponse(
            {"error": "That table or waitlist entry isn't available anymore — refresh and try again."},
            status_code=409,
        )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "waitlist.assign",
        entity_type="waitlist_entry", entity_id=str(entry_id), after=entry,
    )
    return JSONResponse({"entry": entry})


@router.post("/api/portal/waitlist/{entry_id}/cancel")
async def portal_cancel_waitlist_entry(entry_id: int, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "appointments", "write")
    if error:
        return error
    hospital = principal.hospital
    ok = db.cancel_waitlist_entry(hospital.id, entry_id)
    if not ok:
        return JSONResponse({"error": "No such waiting entry to cancel."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "waitlist.cancel",
        entity_type="waitlist_entry", entity_id=str(entry_id),
    )
    return JSONResponse({"ok": True})
