# portal/routes/branches.py
"""Multi-branch support (migration 0053), portal follow-up: Settings > Branches CRUD, plus the
`multi_branch_enabled` toggle. Gated by the same `manage_settings` capability/`settings` page_key
portal/routes/settings.py's own sub-forms already use -- branch management is a Settings concern,
not a separate permission page."""
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from portal.deps import require_capability, authorize

router = APIRouter()


class BranchPayload(BaseModel):
    name: str = ""
    address_line: str | None = None
    city: str | None = None
    phone: str | None = None
    operating_days: list[str] | None = None
    operating_hours: list[str] | None = None
    turnover_minutes: int | None = None
    booking_interval_minutes: int | None = None


class MultiBranchTogglePayload(BaseModel):
    multi_branch_enabled: bool


def _require_settings(authorization: str | None, action: str):
    principal, error = authorize(authorization, "settings", action)
    if error:
        return None, error
    forbidden = require_capability(principal.hospital, "manage_settings")
    if forbidden:
        return None, forbidden
    return principal.hospital, None


def _days_csv(days: list[str] | None) -> str | None:
    return ",".join(days) if days else None


def _hours_csv(hours: list[str] | None) -> str | None:
    return ",".join(hours) if hours else None


@router.get("/api/portal/branches")
async def portal_list_branches(authorization: str | None = Header(default=None)):
    hospital, error = _require_settings(authorization, "view")
    if error:
        return error
    return JSONResponse({
        "multi_branch_enabled": db.get_multi_branch_enabled(hospital.id),
        "branches": db.list_branches(hospital.id, active_only=False),
    })


@router.post("/api/portal/branches/toggle")
async def portal_toggle_multi_branch(payload: MultiBranchTogglePayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_settings(authorization, "write")
    if error:
        return error
    before = db.get_multi_branch_enabled(hospital.id)
    enabled = db.set_multi_branch_enabled(hospital.id, payload.multi_branch_enabled)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "multi_branch.toggle",
        entity_type="hospital", entity_id=str(hospital.id),
        before={"multi_branch_enabled": before}, after={"multi_branch_enabled": enabled},
    )
    return JSONResponse({"multi_branch_enabled": enabled})


@router.post("/api/portal/branches")
async def portal_create_branch(payload: BranchPayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_settings(authorization, "write")
    if error:
        return error
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Branch name is required."}, status_code=400)
    branch = db.create_branch(
        hospital.id, name, address_line=(payload.address_line or "").strip() or None,
        city=(payload.city or "").strip() or None, phone=(payload.phone or "").strip() or None,
        operating_days=_days_csv(payload.operating_days), operating_hours=_hours_csv(payload.operating_hours),
        turnover_minutes=payload.turnover_minutes, booking_interval_minutes=payload.booking_interval_minutes,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "branch.create",
        entity_type="branch", entity_id=branch["id"], after=branch,
    )
    return JSONResponse({"branch": branch})


@router.put("/api/portal/branches/{branch_id}")
async def portal_update_branch(branch_id: str, payload: BranchPayload, authorization: str | None = Header(default=None)):
    hospital, error = _require_settings(authorization, "write")
    if error:
        return error
    existing = db.get_branch(hospital.id, branch_id)
    if existing is None:
        return JSONResponse({"error": "Branch not found."}, status_code=404)
    name = payload.name.strip()
    if not name:
        return JSONResponse({"error": "Branch name is required."}, status_code=400)
    branch = db.update_branch(
        hospital.id, branch_id, name=name, address_line=(payload.address_line or "").strip() or None,
        city=(payload.city or "").strip() or None, phone=(payload.phone or "").strip() or None,
        operating_days=_days_csv(payload.operating_days), operating_hours=_hours_csv(payload.operating_hours),
        turnover_minutes=payload.turnover_minutes, booking_interval_minutes=payload.booking_interval_minutes,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "branch.update",
        entity_type="branch", entity_id=branch_id, before=existing, after=branch,
    )
    return JSONResponse({"branch": branch})


@router.post("/api/portal/branches/{branch_id}/{action}")
async def portal_set_branch_active(branch_id: str, action: str, authorization: str | None = Header(default=None)):
    hospital, error = _require_settings(authorization, "write")
    if error:
        return error
    if action not in ("activate", "deactivate"):
        return JSONResponse({"error": f"Unknown action: {action!r}"}, status_code=400)
    existing = db.get_branch(hospital.id, branch_id)
    if existing is None:
        return JSONResponse({"error": "Branch not found."}, status_code=404)
    try:
        branch = db.set_branch_active(hospital.id, branch_id, action == "activate")
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", f"branch.{action}",
        entity_type="branch", entity_id=branch_id, before={"is_active": existing["is_active"]}, after={"is_active": branch["is_active"]},
    )
    return JSONResponse({"branch": branch})
