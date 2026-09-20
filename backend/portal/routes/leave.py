# portal/routes/leave.py
"""Staff HR leave: a person applies (My Leave), an Owner/Manager reviews (Leave Requests), and the yearly
allowance is set. Plus in-portal notifications, which tell people about it.

Pages: my_leave (everyone -- their own requests, balance and notifications) and leave_requests (the
review queue and the allowance, Owner/Manager by default). Every write goes through authorize(); the
restaurant always comes from the caller. Decisions are guarded UPDATEs (only a still-pending request), a
person can never decide their own request -- except the sole active Owner/Manager, who has nobody else
to ask -- and every decision is audit-logged and notified."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from db.repositories.staff_leave import LEAVE_TYPES, LeaveOverlapError
from portal.attendance_rules import tz
from portal.deps import authorize
from portal.permissions import has_permission

router = APIRouter()

_MAX_SPAN_DAYS = 366
_MAX_BACKDATE_DAYS = 30
_MAX_REASON = 500
_MAX_NOTE = 500


def _today(hospital) -> date:
    return datetime.now(tz(hospital.timezone)).date()


def _iso(value: str) -> date | None:
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError:
        return None


def _actor(principal) -> str:
    return f"{principal.name} <staff:{principal.staff_id}>"


def _leave_json(r: dict) -> dict:
    return {
        "id": r["id"], "staff_id": r["staff_id"], "staff_name": r.get("staff_name"), "staff_role": r.get("staff_role"),
        "leave_type": r["leave_type"], "from_date": r["from_date"], "to_date": r["to_date"],
        "is_half_day": r["is_half_day"], "days": r["days"], "reason": r["reason"], "status": r["status"],
        "decided_by": r["decided_by"], "decided_at": r["decided_at"], "decision_note": r["decision_note"],
        "created_at": r["created_at"],
    }


def _notify_reviewers(hospital_id: int, exclude_staff_id: int, title: str, body: str) -> None:
    """Tell everyone who can review leave (leave_requests:write) that something needs them."""
    for member in db.list_staff_users_for_hospital(hospital_id):
        if not member["is_active"] or member["id"] == exclude_staff_id:
            continue
        if has_permission(hospital_id, member["role"], "leave_requests", "write"):
            db.create_notification(hospital_id, member["id"], "leave_request", title, body, "/portal/leave-requests")


# ---------------------------------------------------------------- my leave

@router.get("/api/portal/leave/mine")
async def my_leave(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "my_leave", "view")
    if error:
        return error
    h = principal.hospital
    return JSONResponse({
        "balance": db.leave_balance(h.id, principal.staff_id, _today(h).year),
        "requests": [_leave_json(r) for r in db.list_leave_requests(h.id, staff_id=principal.staff_id)],
        "leave_types": list(LEAVE_TYPES),
    })


class ApplyLeavePayload(BaseModel):
    leave_type: str = ""
    from_date: str = ""
    to_date: str = ""
    is_half_day: bool = False
    reason: str = ""


@router.post("/api/portal/leave/mine")
async def apply_for_leave(payload: ApplyLeavePayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "my_leave", "write")
    if error:
        return error
    h = principal.hospital
    today = _today(h)
    start, end = _iso(payload.from_date), _iso(payload.to_date or payload.from_date)
    reason = payload.reason.strip()
    errors = []
    if payload.leave_type not in LEAVE_TYPES:
        errors.append("Choose a leave type.")
    if start is None or end is None:
        errors.append("Choose valid from and to dates.")
    else:
        if end < start:
            errors.append("The end date can't be before the start date.")
        if (end - start).days + 1 > _MAX_SPAN_DAYS:
            errors.append("Leave can't span more than a year.")
        if start < today - timedelta(days=_MAX_BACKDATE_DAYS):
            errors.append(f"Leave can't start more than {_MAX_BACKDATE_DAYS} days in the past.")
        if payload.is_half_day and start != end:
            errors.append("A half-day must be a single day.")
    if not reason:
        errors.append("Please give a reason.")
    elif len(reason) > _MAX_REASON:
        errors.append(f"The reason must be at most {_MAX_REASON} characters.")
    if errors:
        return JSONResponse({"error": " ".join(errors)}, status_code=400)

    try:
        created = db.create_leave_request(
            h.id, principal.staff_id, payload.leave_type, start.isoformat(), end.isoformat(), payload.is_half_day, reason,
        )
    except LeaveOverlapError:
        return JSONResponse({"error": "You already have leave requested or approved on some of those dates."}, status_code=409)

    pretty = f"{created['from_date']}" if created["from_date"] == created["to_date"] else f"{created['from_date']} to {created['to_date']}"
    _notify_reviewers(h.id, principal.staff_id, f"{principal.name} asked for leave", f"{payload.leave_type.title()} leave, {pretty}.")
    balance = db.leave_balance(h.id, principal.staff_id, start.year)
    return JSONResponse({"request": _leave_json(created), "balance": balance, "over_allowance": _over(created, balance)}, status_code=201)


def _over(request: dict, balance: dict) -> bool:
    """Would approving this take the person past their yearly allowance?"""
    return request["leave_type"] != "unpaid" and (balance["used"] + balance["pending"]) > balance["allowance"]


@router.post("/api/portal/leave/mine/{request_id}/cancel")
async def cancel_my_leave(request_id: int, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "my_leave", "write")
    if error:
        return error
    h = principal.hospital
    existing = db.get_leave_request(h.id, request_id)
    if existing is None or existing["staff_id"] != principal.staff_id:
        return JSONResponse({"error": "Leave request not found."}, status_code=404)
    cancelled = db.cancel_leave_request(h.id, request_id, principal.staff_id)
    if cancelled is None:
        return JSONResponse({"error": f"Only a pending request can be withdrawn (this one is {existing['status']})."}, status_code=409)
    return JSONResponse({"request": _leave_json(cancelled)})


# ---------------------------------------------------------------- the review queue

@router.get("/api/portal/leave/requests")
async def leave_requests(status: str = "", authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "leave_requests", "view")
    if error:
        return error
    h = principal.hospital
    rows = db.list_leave_requests(h.id, status=status or None)
    everything = db.list_leave_requests(h.id)
    today = _today(h).isoformat()
    out = []
    for r in rows:
        item = _leave_json(r)
        if r["status"] == "pending":
            item["conflicts"] = db.role_conflicts(h.id, r)
            item["balance"] = db.leave_balance(h.id, r["staff_id"], int(r["from_date"][:4]))
        out.append(item)
    return JSONResponse({
        "requests": out,
        "summary": {
            "pending": sum(1 for r in everything if r["status"] == "pending"),
            "approved": sum(1 for r in everything if r["status"] == "approved"),
            "rejected": sum(1 for r in everything if r["status"] == "rejected"),
            "on_leave_today": len({r["staff_id"] for r in everything if r["status"] == "approved" and r["from_date"] <= today <= r["to_date"]}),
        },
        "annual_leave_days": db.get_annual_leave_days(h.id),
    })


class DecisionPayload(BaseModel):
    note: str = ""


def _decide(request_id: int, new_status: str, payload: DecisionPayload, authorization: str | None):
    principal, error = authorize(authorization, "leave_requests", "write")
    if error:
        return error
    h = principal.hospital
    existing = db.get_leave_request(h.id, request_id)
    if existing is None:
        return JSONResponse({"error": "Leave request not found."}, status_code=404)
    note = payload.note.strip()
    if len(note) > _MAX_NOTE:
        return JSONResponse({"error": f"The note must be at most {_MAX_NOTE} characters."}, status_code=400)
    if existing["staff_id"] == principal.staff_id and not (principal.role == "admin" and db.count_active_admins(h.id) == 1):
        return JSONResponse({"error": "You can't decide your own request -- another Owner / Manager needs to."}, status_code=403)

    decided = db.decide_leave_request(h.id, request_id, new_status, principal.staff_id, note or None)
    if decided is None:
        return JSONResponse({"error": f"This request was already {existing['status']}."}, status_code=409)

    db.record_audit_log(
        "portal", h.id, _actor(principal), f"leave.{new_status}", entity_type="staff_leave_request", entity_id=str(request_id),
        before={"status": existing["status"]}, after={"status": new_status, "staff_id": existing["staff_id"], "days": existing["days"]},
    )
    verb = "approved" if new_status == "approved" else "declined"
    span = decided["from_date"] if decided["from_date"] == decided["to_date"] else f"{decided['from_date']} to {decided['to_date']}"
    if existing["staff_id"] != principal.staff_id:
        db.create_notification(
            h.id, existing["staff_id"], "leave_decision", f"Your leave was {verb}",
            f"{decided['leave_type'].title()} leave, {span}." + (f" Note: {note}" if note else ""), "/portal/leave",
        )
    return JSONResponse({
        "request": _leave_json(decided),
        "balance": db.leave_balance(h.id, existing["staff_id"], int(decided["from_date"][:4])),
    })


@router.post("/api/portal/leave/requests/{request_id}/approve")
async def approve_leave(request_id: int, payload: DecisionPayload | None = None, authorization: str | None = Header(default=None)):
    return _decide(request_id, "approved", payload or DecisionPayload(), authorization)


@router.post("/api/portal/leave/requests/{request_id}/reject")
async def reject_leave(request_id: int, payload: DecisionPayload | None = None, authorization: str | None = Header(default=None)):
    return _decide(request_id, "rejected", payload or DecisionPayload(), authorization)


# ---------------------------------------------------------------- the yearly allowance

@router.get("/api/portal/leave/policy")
async def leave_policy(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "leave_requests", "view")
    if error:
        return error
    return JSONResponse({"annual_leave_days": db.get_annual_leave_days(principal.hospital.id)})


class PolicyPayload(BaseModel):
    annual_leave_days: int | None = None


@router.post("/api/portal/leave/policy")
async def set_leave_policy(payload: PolicyPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "leave_requests", "write")
    if error:
        return error
    h = principal.hospital
    days = payload.annual_leave_days
    if days is None or not (0 <= days <= 366):
        return JSONResponse({"error": "The yearly allowance must be between 0 and 366 days."}, status_code=400)
    before = db.get_annual_leave_days(h.id)
    db.set_annual_leave_days(h.id, days)
    db.record_audit_log(
        "portal", h.id, _actor(principal), "leave.set_allowance", entity_type="staff_hr_settings", entity_id=str(h.id),
        before={"annual_leave_days": before}, after={"annual_leave_days": days},
    )
    return JSONResponse({"annual_leave_days": days})


# ---------------------------------------------------------------- notifications (the caller's own)

@router.get("/api/portal/notifications")
async def notifications(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "my_leave", "view")
    if error:
        return error
    h = principal.hospital
    return JSONResponse({
        "notifications": db.list_notifications(h.id, principal.staff_id),
        "unread": db.count_unread_notifications(h.id, principal.staff_id),
    })


class ReadPayload(BaseModel):
    ids: list[int] | None = None  # None / omitted = mark everything read


@router.post("/api/portal/notifications/read")
async def mark_notifications_read(payload: ReadPayload | None = None, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "my_leave", "write")
    if error:
        return error
    h = principal.hospital
    marked = db.mark_notifications_read(h.id, principal.staff_id, (payload or ReadPayload()).ids)
    return JSONResponse({"marked": marked, "unread": db.count_unread_notifications(h.id, principal.staff_id)})
