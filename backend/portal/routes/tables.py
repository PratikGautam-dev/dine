# portal/routes/tables.py
"""Table reservations, portal follow-up: real CRUD for the `tables` table
(physical dining tables, migration 0030) -- db/repositories/tables.py's
create_table()/update_table()/get_all_tables_for_hospital() existed since
Stage 4 Sub-stage 2 but were never wired to a connector method or portal
route; the sidebar's "Tables" nav item was Stage 2's vocabulary-only remap
of the OLD doctor-management page, not a real interface to this data.
Gated by the dedicated manage_tables capability, structurally cloned from
portal/routes/food_ordering.py's menu-item CRUD pattern."""
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from portal.capabilities import MANAGE_TABLES
from portal.deps import _authenticate, require_capability, authorize

router = APIRouter()


class TablePayload(BaseModel):
    name: str = ""
    department_id: str = ""
    capacity: int = 1
    is_active: bool = True
    notes: str | None = None
    shape: str = "rect"


class PositionPayload(BaseModel):
    pos_x: float = 0
    pos_y: float = 0


def _require_tables(authorization: str | None, action: str):
    """Signed in, holds `action` on the Tables page, and the tenant has table management."""
    principal, error = authorize(authorization, "tables", action)
    if error:
        return None, error
    forbidden = require_capability(principal.hospital, MANAGE_TABLES)
    if forbidden:
        return None, forbidden
    return principal.hospital, None


@router.get("/api/portal/tables")
async def portal_tables(authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "view")
    if error:
        return error
    # get_all_tables_for_hospital() -- the management list, intentionally
    # still shows inactive tables (unlike get_tables(), the WhatsApp
    # booking-flow read). departments are shared with the existing
    # doctors/departments page -- one section list, not duplicated.
    departments = db.get_departments(hospital.id)
    tables = db.get_all_tables_for_hospital(hospital.id)
    # Tables page follow-up: "Reserved" (derived, not a stored status) and current_occupant (a real
    # join over today's attended appointments / assigned waitlist entries, not a fabricated field).
    reserved_soon_ids = db.get_reserved_soon_table_ids(hospital.id)
    occupied_ids = [t["id"] for t in tables if t["status"] == db.STATUS_OCCUPIED]
    occupants = db.get_current_occupants(hospital.id, occupied_ids)
    enriched_tables = [
        {**t, "is_reserved_soon": t["id"] in reserved_soon_ids, "current_occupant": occupants.get(t["id"])}
        for t in tables
    ]
    return JSONResponse({"departments": departments, "tables": enriched_tables, "sections": db.list_sections(hospital.id)})


class SectionPayload(BaseModel):
    name: str = ""


class SectionMovePayload(BaseModel):
    direction: str = ""


_MAX_SECTION_NAME = 60


def _clean_section_name(raw: str) -> tuple[str, JSONResponse | None]:
    name = " ".join(raw.split())
    if not name:
        return "", JSONResponse({"error": "Section name is required."}, status_code=400)
    if len(name) > _MAX_SECTION_NAME:
        return "", JSONResponse({"error": f"Section name must be {_MAX_SECTION_NAME} characters or fewer."}, status_code=400)
    return name, None


@router.post("/api/portal/sections")
async def portal_create_section(payload: SectionPayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    name, bad = _clean_section_name(payload.name)
    if bad:
        return bad
    section = db.create_section(hospital.id, name)
    if section is None:
        return JSONResponse({"error": f"A section called '{name}' already exists."}, status_code=409)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "section.create",
        entity_type="department", entity_id=section["id"], after={"name": name},
    )
    return JSONResponse({"section": section})


@router.put("/api/portal/sections/{section_id}")
async def portal_rename_section(section_id: str, payload: SectionPayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    name, bad = _clean_section_name(payload.name)
    if bad:
        return bad
    before = db.find_department(hospital.id, section_id)
    result = db.rename_section(hospital.id, section_id, name)
    if result == "not_found":
        return JSONResponse({"error": "Section not found."}, status_code=404)
    if result == "duplicate":
        return JSONResponse({"error": f"A section called '{name}' already exists."}, status_code=409)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "section.rename",
        entity_type="department", entity_id=section_id, before=before, after={"name": name},
    )
    return JSONResponse({"section": {"id": section_id, "name": name}})


@router.post("/api/portal/sections/{section_id}/move")
async def portal_move_section(section_id: str, payload: SectionMovePayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    if payload.direction not in ("up", "down"):
        return JSONResponse({"error": "Direction must be 'up' or 'down'."}, status_code=400)
    result = db.move_section(hospital.id, section_id, payload.direction)
    if result == "not_found":
        return JSONResponse({"error": "Section not found."}, status_code=404)
    return JSONResponse({"sections": db.list_sections(hospital.id)})


@router.delete("/api/portal/sections/{section_id}")
async def portal_delete_section(section_id: str, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "delete")
    if error:
        return error
    before = db.find_department(hospital.id, section_id)
    result = db.delete_section(hospital.id, section_id)
    if result == "not_found":
        return JSONResponse({"error": "Section not found."}, status_code=404)
    if result == "in_use":
        return JSONResponse(
            {"error": "This section still has tables or staff. Move or remove them first, then delete the section."},
            status_code=409,
        )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "section.delete",
        entity_type="department", entity_id=section_id, before=before,
    )
    return JSONResponse({"ok": True})


@router.post("/api/portal/tables")
async def portal_create_table(payload: TablePayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Table name is required."}, status_code=400)
    if not db.find_department(hospital.id, payload.department_id):
        return JSONResponse({"error": "Choose a valid section."}, status_code=400)
    if payload.capacity < 1:
        return JSONResponse({"error": "Capacity must be at least 1."}, status_code=400)
    table = db.create_table(hospital.id, payload.department_id, name, payload.capacity)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "table.create",
        entity_type="table", entity_id=table["id"], after={"name": name, "capacity": payload.capacity},
    )
    return JSONResponse({"table": table})


@router.put("/api/portal/tables/{table_id}")
async def portal_update_table(table_id: str, payload: TablePayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    existing = db.find_table(hospital.id, table_id)
    if existing is None:
        return JSONResponse({"error": "Table not found."}, status_code=404)
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Table name is required."}, status_code=400)
    if not db.find_department(hospital.id, payload.department_id):
        return JSONResponse({"error": "Choose a valid section."}, status_code=400)
    if payload.capacity < 1:
        return JSONResponse({"error": "Capacity must be at least 1."}, status_code=400)
    table = db.update_table(
        hospital.id, table_id, name, payload.department_id, payload.capacity, payload.is_active,
        notes=(payload.notes or "").strip() or None, shape=payload.shape if payload.shape in ("rect", "round") else "rect",
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "table.update",
        entity_type="table", entity_id=table_id, before=existing, after=table,
    )
    return JSONResponse({"table": table})


# --- Live occupancy (Live Operations follow-up) ---
# action -> (expected_prior_status, new_status), same straight-line-transition table
# food_ordering.py's _STRAIGHT_TRANSITIONS uses. Real staff actions only -- never inferred
# from a reservation's turnover_minutes.
_TABLE_STATUS_TRANSITIONS = {
    "seat": (db.STATUS_FREE, db.STATUS_OCCUPIED),
    "needs_cleaning": (db.STATUS_OCCUPIED, db.STATUS_NEEDS_CLEANING),
    # Tables page follow-up: a table deliberately taken out of service (maintenance, etc.) --
    # distinct from needs_cleaning. "unblock" always returns it to free (never straight back to
    # occupied/needs_cleaning -- whatever state it's in once usable again starts fresh).
    "unblock": (db.STATUS_BLOCKED, db.STATUS_FREE),
    # "clear"/"block" are each reachable from more than one prior status -- handled separately
    # below, not in this straight-line table.
}
_CLEARABLE_FROM = (db.STATUS_OCCUPIED, db.STATUS_NEEDS_CLEANING)
_BLOCKABLE_FROM = (db.STATUS_FREE, db.STATUS_NEEDS_CLEANING)


@router.post("/api/portal/tables/{table_id}/position")
async def portal_update_table_position(table_id: str, payload: PositionPayload, authorization: str | None = Header(default=None)):
    """Tables page follow-up: registered BEFORE the generic {action} route below -- FastAPI matches
    routes in registration order, and "position" would otherwise be swallowed by {action} as an
    unknown-action 400, same ordering pitfall portal/routes/bookings.py's own "delete" route docstring
    already flags for this exact codebase."""
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    if not (0 <= payload.pos_x <= 100 and 0 <= payload.pos_y <= 100):
        return JSONResponse({"error": "pos_x and pos_y must be between 0 and 100."}, status_code=400)
    updated = db.update_table_position(hospital.id, table_id, payload.pos_x, payload.pos_y)
    if updated is None:
        return JSONResponse({"error": "Table not found."}, status_code=404)
    return JSONResponse({"table": updated})


@router.post("/api/portal/tables/{table_id}/{action}")
async def portal_set_table_status(table_id: str, action: str, authorization: str | None = Header(default=None)):
    hospital, error = _require_tables(authorization, "write")
    if error:
        return error
    table = db.find_table(hospital.id, table_id)
    if table is None:
        return JSONResponse({"error": "Table not found."}, status_code=404)

    if action == "clear":
        updated = None
        for expected in _CLEARABLE_FROM:
            updated = db.set_table_status(hospital.id, table_id, db.STATUS_FREE, expected_status=expected)
            if updated is not None:
                break
    elif action == "block":
        updated = None
        for expected in _BLOCKABLE_FROM:
            updated = db.set_table_status(hospital.id, table_id, db.STATUS_BLOCKED, expected_status=expected)
            if updated is not None:
                break
    elif action in _TABLE_STATUS_TRANSITIONS:
        expected_status, new_status = _TABLE_STATUS_TRANSITIONS[action]
        updated = db.set_table_status(hospital.id, table_id, new_status, expected_status=expected_status)
    else:
        return JSONResponse({"error": f"Unknown action: {action!r}"}, status_code=400)

    if updated is None:
        return JSONResponse(
            {"error": f"Table is not in a state where '{action}' applies (current status: {table['status']!r})."},
            status_code=409,
        )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", f"table.{action}",
        entity_type="table", entity_id=table_id, before={"status": table["status"]}, after={"status": updated["status"]},
    )
    return JSONResponse({"table": updated})
