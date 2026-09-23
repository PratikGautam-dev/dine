# portal/routes/chef_notes.py
"""Kitchen Orders (KDS) follow-up: the real notes board -- gated on the existing `food_orders` page
permission (same domain, no new page key needed)."""
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from portal.deps import _authenticate, authorize

router = APIRouter()


class ChefNotePayload(BaseModel):
    text: str = ""


@router.get("/api/portal/chef-notes")
async def portal_chef_notes(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "food_orders", "view")
    if error:
        return error
    return JSONResponse({"notes": db.list_chef_notes(principal.hospital.id)})


@router.post("/api/portal/chef-notes")
async def portal_add_chef_note(payload: ChefNotePayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "food_orders", "write")
    if error:
        return error
    text = payload.text.strip()
    if not text:
        return JSONResponse({"error": "Note text is required."}, status_code=400)
    note = db.add_chef_note(principal.hospital.id, text, principal.name)
    db.record_audit_log(
        "portal", principal.hospital.id, "tenant portal", "chef_note.add",
        entity_type="chef_note", entity_id=str(note["id"]), after=note,
    )
    return JSONResponse({"note": note})


@router.post("/api/portal/chef-notes/{note_id}/delete")
async def portal_delete_chef_note(note_id: int, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "food_orders", "write")
    if error:
        return error
    ok = db.delete_chef_note(principal.hospital.id, note_id)
    if not ok:
        return JSONResponse({"error": "No such note."}, status_code=404)
    db.record_audit_log(
        "portal", principal.hospital.id, "tenant portal", "chef_note.delete",
        entity_type="chef_note", entity_id=str(note_id),
    )
    return JSONResponse({"ok": True})
