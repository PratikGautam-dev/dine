# portal/routes/staff.py
"""Staff management API -- list, create, edit, change role, reset password and activate/deactivate
the staff logins of the caller's own restaurant.

Gated by authorize(..., "staff", view|write) like every other page. There is deliberately no DELETE:
a person is switched off (their sessions die at once), never removed, so history that names them
stays intact. Every write is scoped to the caller's restaurant twice -- the lookup that finds the
person, and the WHERE of the update itself -- and is audit-logged.

Roles are the three a restaurant has: Owner/Manager (admin), Front of House (receptionist) and
Kitchen Staff (kitchen). The restaurant always comes from the signed-in caller, never the request.
"""
import re

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from db.repositories.hospitals import hash_portal_password
from portal.deps import authorize
from portal.permissions import ASSIGNABLE_ROLES

router = APIRouter()

_MIN_PASSWORD = 8
_PHONE = re.compile(r"^\+?[0-9][0-9 ()-]{5,19}$")
_MAX_ADDRESS = 300
_EDITABLE = ("name", "phone", "address", "department_id", "reports_to_id")


def _staff_row(staff: dict) -> dict:
    return {
        "id": staff["id"], "name": staff["name"], "email": staff["email"], "role": staff["role"],
        "is_active": staff["is_active"], "employee_id": staff.get("employee_id"), "phone": staff.get("phone"),
        "address": staff.get("address"), "department_id": staff.get("department_id"),
        "department_name": staff.get("department_name"), "reports_to_id": staff.get("reports_to_id"),
        "reports_to_name": staff.get("reports_to_name"),
    }


def _find(hospital_id: int, staff_id: int) -> dict | None:
    """The staff member if (and only if) they belong to this restaurant."""
    return next((s for s in db.list_staff_users_for_hospital(hospital_id) if s["id"] == staff_id), None)


def _actor(principal) -> str:
    return f"{principal.name} <staff:{principal.staff_id}>"


def _clean_profile(hospital_id: int, staff_id: int | None, fields: dict) -> tuple[dict, list[str]]:
    """Validates and normalises the optional profile fields present in `fields` (a key set to
    None/blank clears it). Returns (clean values, errors)."""
    clean: dict = {}
    errors: list[str] = []
    if "name" in fields:
        name = (fields["name"] or "").strip()
        if len(name) < 2:
            errors.append("Name is required.")
        else:
            clean["name"] = name
    if "phone" in fields:
        phone = (fields["phone"] or "").strip()
        if phone and not _PHONE.match(phone):
            errors.append("Phone number looks wrong (digits, spaces, + ( ) - only).")
        else:
            clean["phone"] = phone or None
    if "address" in fields:
        address = (fields["address"] or "").strip()
        if len(address) > _MAX_ADDRESS:
            errors.append(f"Address must be at most {_MAX_ADDRESS} characters.")
        else:
            clean["address"] = address or None
    if "department_id" in fields:
        dept = (fields["department_id"] or "").strip()
        if dept and db.find_department(hospital_id, dept) is None:
            errors.append("Choose one of your own sections.")
        else:
            clean["department_id"] = dept or None
    if "reports_to_id" in fields:
        manager_id = fields["reports_to_id"]
        if manager_id in (None, ""):
            clean["reports_to_id"] = None
        else:
            manager = _find(hospital_id, int(manager_id)) if str(manager_id).lstrip("-").isdigit() else None
            if manager is None or not manager["is_active"]:
                errors.append("Choose an active member of your own team to report to.")
            elif staff_id is not None and manager["id"] == staff_id:
                errors.append("Someone cannot report to themselves.")
            elif staff_id is not None and _reports_up_to(hospital_id, manager["id"], staff_id):
                errors.append("That would make two people report to each other.")
            else:
                clean["reports_to_id"] = manager["id"]
    return clean, errors


def _reports_up_to(hospital_id: int, start_id: int, target_id: int) -> bool:
    """True if following reports-to links from `start_id` reaches `target_id` (a cycle)."""
    by_id = {s["id"]: s for s in db.list_staff_users_for_hospital(hospital_id)}
    seen = set()
    current = start_id
    while current is not None and current not in seen:
        if current == target_id:
            return True
        seen.add(current)
        current = (by_id.get(current) or {}).get("reports_to_id")
    return False


@router.get("/api/portal/staff")
async def list_staff(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "staff", "view")
    if error:
        return error
    return JSONResponse([_staff_row(s) for s in db.list_staff_users_for_hospital(principal.hospital.id)])


@router.get("/api/portal/staff/options")
async def staff_options(authorization: str | None = Header(default=None)):
    """{id, name} of every ACTIVE team member -- feeds the "reports to" picker."""
    principal, error = authorize(authorization, "staff", "view")
    if error:
        return error
    return JSONResponse([
        {"id": s["id"], "name": s["name"], "role": s["role"]}
        for s in db.list_staff_users_for_hospital(principal.hospital.id) if s["is_active"]
    ])


class CreateStaffPayload(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""
    role: str = ""
    phone: str | None = None
    address: str | None = None
    department_id: str | None = None
    reports_to_id: int | None = None


@router.post("/api/portal/staff")
async def create_staff(payload: CreateStaffPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "staff", "write")
    if error:
        return error
    hospital_id = principal.hospital.id

    email = payload.email.strip()
    errors = []
    if not email or "@" not in email:
        errors.append("A valid email is required.")
    if len(payload.password) < _MIN_PASSWORD:
        errors.append(f"A password of at least {_MIN_PASSWORD} characters is required.")
    if payload.role not in ASSIGNABLE_ROLES:
        errors.append("Choose a role: Owner / Manager, Front of House or Kitchen Staff.")
    clean, profile_errors = _clean_profile(hospital_id, None, {k: getattr(payload, k) for k in _EDITABLE})
    errors += profile_errors
    if errors:
        # a single {"error": "..."} string -- what the frontend reads
        return JSONResponse({"error": " ".join(errors)}, status_code=400)

    try:
        staff = db.create_staff_user(
            hospital_id, payload.role, email, hash_portal_password(payload.password), clean["name"],
            phone=clean.get("phone"), address=clean.get("address"), department_id=clean.get("department_id"),
            reports_to_id=clean.get("reports_to_id"),
        )
    except db.IntegrityError:
        return JSONResponse({"error": f'"{email}" is already in use by another account.'}, status_code=400)

    db.record_audit_log(
        "portal", hospital_id, _actor(principal), "staff.create", entity_type="staff_users",
        entity_id=str(staff["id"]), after={"email": email, "role": payload.role, "employee_id": staff["employee_id"]},
    )
    return JSONResponse(_staff_row(_find(hospital_id, staff["id"])), status_code=201)


class UpdateStaffPayload(BaseModel):
    is_active: bool | None = None
    role: str | None = None
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    department_id: str | None = None
    reports_to_id: int | None = None


@router.patch("/api/portal/staff/{staff_id}")
async def update_staff(staff_id: int, payload: UpdateStaffPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "staff", "write")
    if error:
        return error
    hospital_id = principal.hospital.id

    target = _find(hospital_id, staff_id)
    if target is None:
        return JSONResponse({"error": "Staff member not found."}, status_code=404)

    sent = payload.model_fields_set  # a key sent as null clears that field; a key not sent is left alone
    if not sent:
        return JSONResponse({"error": "Nothing to update."}, status_code=400)
    is_self = staff_id == principal.staff_id
    errors: list[str] = []

    new_role = payload.role if "role" in sent else None
    if "role" in sent:
        if payload.role not in ASSIGNABLE_ROLES:
            errors.append("Choose a role: Owner / Manager, Front of House or Kitchen Staff.")
        elif is_self and payload.role != target["role"]:
            errors.append("You can't change your own role -- ask another Owner / Manager.")
    new_active = payload.is_active if "is_active" in sent else None
    if "is_active" in sent and payload.is_active is None:
        errors.append("is_active must be true or false.")
    if new_active is False and is_self:
        errors.append("You can't deactivate your own account.")
    losing_admin = target["role"] == "admin" and target["is_active"] and (
        new_active is False or (new_role is not None and new_role != "admin")
    )
    if losing_admin and db.count_active_admins(hospital_id) <= 1:
        errors.append("The restaurant needs at least one active Owner / Manager.")

    clean, profile_errors = _clean_profile(hospital_id, staff_id, {k: getattr(payload, k) for k in _EDITABLE if k in sent})
    errors += profile_errors
    if errors:
        return JSONResponse({"error": " ".join(errors)}, status_code=400)

    before = {k: target.get(k) for k in ("role", "is_active", *_EDITABLE)}
    if clean:
        db.update_staff_profile(hospital_id, staff_id, clean)
    if new_role is not None and new_role != target["role"]:
        db.update_staff_user_role(staff_id, new_role, hospital_id=hospital_id)  # revokes their sessions
    if new_active is not None and new_active != target["is_active"]:
        db.set_staff_user_active(staff_id, new_active)  # revokes their sessions

    updated = _find(hospital_id, staff_id)
    action = "staff.update"
    if new_active is not None and new_active != target["is_active"]:
        action = "staff.set_active" if new_active else "staff.deactivate"
    elif new_role is not None and new_role != target["role"]:
        action = "staff.change_role"
    db.record_audit_log(
        "portal", hospital_id, _actor(principal), action, entity_type="staff_users", entity_id=str(staff_id),
        before=before, after={k: updated.get(k) for k in before},
    )
    return JSONResponse(_staff_row(updated))


class SetPasswordPayload(BaseModel):
    new_password: str = ""


@router.post("/api/portal/staff/{staff_id}/password")
async def reset_staff_password(staff_id: int, payload: SetPasswordPayload, authorization: str | None = Header(default=None)):
    """Admin-set password. Every session of that person is ended at once (token_version bump)."""
    principal, error = authorize(authorization, "staff", "write")
    if error:
        return error
    hospital_id = principal.hospital.id
    if _find(hospital_id, staff_id) is None:
        return JSONResponse({"error": "Staff member not found."}, status_code=404)
    if len(payload.new_password) < _MIN_PASSWORD:
        return JSONResponse({"error": f"A password of at least {_MIN_PASSWORD} characters is required."}, status_code=400)
    db.update_staff_user_password(staff_id, hash_portal_password(payload.new_password))
    db.record_audit_log(
        "portal", hospital_id, _actor(principal), "staff.reset_password", entity_type="staff_users", entity_id=str(staff_id),
    )
    return JSONResponse({"ok": True})
