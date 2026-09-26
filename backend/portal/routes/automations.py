from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import authorize

router = APIRouter()


@router.get("/api/portal/automations")
async def portal_automations(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "automations", "view")
    if error:
        return error
    return JSONResponse({
        "automations": db.list_automations(principal.hospital.id),
        "trigger_events": list(db.TRIGGER_EVENTS),
    })


@router.post("/api/portal/automations")
async def portal_create_automation(payload: dict, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "automations", "write")
    if error:
        return error
    hospital = principal.hospital
    p = payload or {}
    try:
        created = db.create_automation(
            hospital.id, name=p.get("name", ""), trigger_event=p.get("trigger_event", ""),
            message_text=p.get("message_text", ""), delay_minutes=int(p.get("delay_minutes") or 0),
        )
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "automation.create", entity_type="automation", entity_id=str(created["id"]),
        after={"name": created["name"], "trigger_event": created["trigger_event"]},
    )
    return JSONResponse({"automation": created})


@router.post("/api/portal/automations/{automation_id}")
async def portal_update_automation(automation_id: int, payload: dict, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "automations", "write")
    if error:
        return error
    hospital = principal.hospital
    is_active = (payload or {}).get("is_active")
    if is_active is None or not isinstance(is_active, bool):
        return JSONResponse({"error": "is_active (true/false) is required."}, status_code=400)
    updated = db.update_automation(hospital.id, automation_id, is_active=is_active)
    if updated is None:
        return JSONResponse({"error": "No such automation."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "automation.toggle_active", entity_type="automation",
        entity_id=str(automation_id), after={"is_active": is_active},
    )
    return JSONResponse({"automation": updated})
