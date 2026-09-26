# portal/routes/attendance.py
"""Staff attendance: clock in / out, breaks, a person's own history, the Owner/Manager's team overview and
monthly summary, corrections of forgotten clock-outs, and the attendance rules (shift window, late grace,
location check).

Pages: check_in_out (everyone: clock in/out + own history), attendance (the team view and corrections),
attendance_settings (the rules). Rules worth knowing:
  * A record is filed under the restaurant's LOCAL date and lateness is judged in its timezone.
  * Late = arriving after shift start + grace; overtime = worked time beyond the scheduled shift.
  * The location check (GPS radius and/or allowed IPs) applies to clock-IN only, is optional, and is a
    deterrent, not proof.
  * There is no auto-checkout: a forgotten clock-out shows up as "missing clock-out" and a Manager
    corrects it (audited, and the person is told).
  * "Absent" is never stored: it is a scheduled day (the person's working days) with no record and no
    approved leave."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db.repository as db
from db.connection import IntegrityError
from portal import attendance_rules as rules
from portal.deps import authorize

router = APIRouter()

_OPEN_WINDOW = timedelta(hours=20)  # how long after clocking in a record can still be closed by its owner


def _utcnow() -> datetime:
    """The clock (patched in tests)."""
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def _actor(principal) -> str:
    return f"{principal.name} <staff:{principal.staff_id}>"


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _started_on(staff: dict) -> date | None:
    """The day this person joined (their account's creation date): days before it never count as absent."""
    try:
        return date.fromisoformat(str(staff.get("created_at"))[:10])
    except ValueError:
        return None


def _iso_date(value: str | None, default: date) -> date | None:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


# ---------------------------------------------------------------- serialisation

def _rec_json(rec: dict | None, tz_name: str, now: datetime) -> dict | None:
    if rec is None:
        return None
    local_in = rules.to_local(rec["check_in_at"], tz_name)
    local_out = rules.to_local(rec["check_out_at"], tz_name) if rec["check_out_at"] else None
    stale = rec["check_out_at"] is None and (now - datetime.fromisoformat(rec["check_in_at"])) > _OPEN_WINDOW
    return {
        "id": rec["id"], "work_date": rec["work_date"], "status": rec["status"], "late_minutes": rec["late_minutes"],
        "check_in_at": rec["check_in_at"], "check_in_local": local_in.strftime("%H:%M"),
        "check_out_at": rec["check_out_at"], "check_out_local": local_out.strftime("%H:%M") if local_out else None,
        "check_in_method": rec["check_in_method"], "break_started_at": rec["break_started_at"],
        "break_minutes": rec["break_minutes"], "working_minutes": rec["working_minutes"],
        "overtime_minutes": rec["overtime_minutes"], "missing_clock_out": stale,
        "corrected": rec["corrected_by"] is not None, "correction_note": rec["correction_note"],
    }


def _shift_info(staff: dict, settings: dict) -> dict:
    start, end = rules.expected_shift(staff, settings)
    own = rules.valid_hhmm(staff.get("shift_start")) and rules.valid_hhmm(staff.get("shift_end"))
    return {"start": start, "end": end, "source": "own" if own else ("restaurant" if start else "none")}


def _current_record(h, staff_id: int, now: datetime) -> dict | None:
    """The open record if there is one, else today's finished one."""
    open_rec = db.get_open_attendance(h.id, staff_id, _iso(now - _OPEN_WINDOW))
    if open_rec:
        return open_rec
    return db.get_attendance(h.id, staff_id, now.astimezone(rules.tz(h.timezone)).date().isoformat())


# ---------------------------------------------------------------- clocking in and out

@router.get("/api/portal/attendance/today")
async def attendance_today(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "check_in_out", "view")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    settings = db.get_hr_settings(h.id)
    staff = db.get_staff_user_by_id(principal.staff_id) or {}
    rec = _current_record(h, principal.staff_id, now)
    state = "not_in"
    if rec:
        state = "out" if rec["check_out_at"] else ("on_break" if rec["break_started_at"] else "in")
    local = now.astimezone(rules.tz(h.timezone))
    today_iso = local.date().isoformat()
    on_leave = any(r["staff_id"] == principal.staff_id for r in db.approved_leave_between(h.id, today_iso, today_iso))
    return JSONResponse({
        "now": local.isoformat(), "work_date": local.date().isoformat(), "timezone": h.timezone, "state": state,
        "record": _rec_json(rec, h.timezone, now), "shift": _shift_info(staff, settings),
        "location_required": rules.check_location(settings, None, None, None).method != "unrestricted",
        "grace_minutes": settings["late_grace_minutes"], "on_leave": on_leave,
    })


class ClockPayload(BaseModel):
    latitude: float | None = None
    longitude: float | None = None


@router.post("/api/portal/attendance/check-in")
async def check_in(request: Request, payload: ClockPayload | None = None, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "check_in_out", "write")
    if error:
        return error
    h = principal.hospital
    payload = payload or ClockPayload()
    if payload.latitude is not None and not (-90 <= payload.latitude <= 90) or payload.longitude is not None and not (-180 <= payload.longitude <= 180):
        return JSONResponse({"error": "That location isn't valid."}, status_code=400)

    now = _utcnow()
    local = now.astimezone(rules.tz(h.timezone))
    work_date = local.date().isoformat()
    open_rec = db.get_open_attendance(h.id, principal.staff_id, _iso(now - _OPEN_WINDOW))
    if open_rec:
        return JSONResponse({"error": f"You're already clocked in (since {rules.to_local(open_rec['check_in_at'], h.timezone):%H:%M})."}, status_code=409)
    if db.get_attendance(h.id, principal.staff_id, work_date):
        return JSONResponse({"error": "You've already clocked in and out today. Ask a Manager if that needs fixing."}, status_code=409)

    settings = db.get_hr_settings(h.id)
    ip = _client_ip(request)
    where = rules.check_location(settings, payload.latitude, payload.longitude, ip)
    if not where.ok:
        return JSONResponse({"error": where.message}, status_code=403)

    staff = db.get_staff_user_by_id(principal.staff_id) or {}
    start, _end = rules.expected_shift(staff, settings)
    status, late = rules.compute_lateness(local, start, settings["late_grace_minutes"])
    try:
        rec = db.create_check_in(h.id, principal.staff_id, work_date, _iso(now), payload.latitude, payload.longitude, ip, where.method, status, late)
    except IntegrityError:
        return JSONResponse({"error": "You've already clocked in today."}, status_code=409)
    return JSONResponse({"record": _rec_json(rec, h.timezone, now)}, status_code=201)


@router.post("/api/portal/attendance/check-out")
async def check_out(request: Request, payload: ClockPayload | None = None, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "check_in_out", "write")
    if error:
        return error
    h = principal.hospital
    payload = payload or ClockPayload()
    now = _utcnow()
    open_rec = db.get_open_attendance(h.id, principal.staff_id, _iso(now - _OPEN_WINDOW))
    if open_rec is None:
        return JSONResponse({"error": "You're not clocked in."}, status_code=409)

    break_minutes = open_rec["break_minutes"]
    if open_rec["break_started_at"]:  # leaving while on a break ends the break
        break_minutes += max(0, int((now - datetime.fromisoformat(open_rec["break_started_at"])).total_seconds() // 60))
    settings = db.get_hr_settings(h.id)
    staff = db.get_staff_user_by_id(principal.staff_id) or {}
    scheduled = rules.scheduled_minutes(*rules.expected_shift(staff, settings))
    working, overtime = rules.compute_worked(open_rec["check_in_at"], _iso(now), break_minutes, scheduled)
    rec = db.set_check_out(h.id, open_rec["id"], principal.staff_id, _iso(now), payload.latitude, payload.longitude, _client_ip(request), break_minutes, working, overtime)
    if rec is None:
        return JSONResponse({"error": "You're not clocked in."}, status_code=409)
    return JSONResponse({"record": _rec_json(rec, h.timezone, now)})


@router.post("/api/portal/attendance/break/start")
async def break_start(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "check_in_out", "write")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    open_rec = db.get_open_attendance(h.id, principal.staff_id, _iso(now - _OPEN_WINDOW))
    if open_rec is None:
        return JSONResponse({"error": "You're not clocked in."}, status_code=409)
    rec = db.start_break(h.id, open_rec["id"], principal.staff_id, _iso(now))
    if rec is None:
        return JSONResponse({"error": "You're already on a break."}, status_code=409)
    return JSONResponse({"record": _rec_json(rec, h.timezone, now)})


@router.post("/api/portal/attendance/break/end")
async def break_end(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "check_in_out", "write")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    open_rec = db.get_open_attendance(h.id, principal.staff_id, _iso(now - _OPEN_WINDOW))
    if open_rec is None or not open_rec["break_started_at"]:
        return JSONResponse({"error": "You're not on a break."}, status_code=409)
    minutes = max(0, int((now - datetime.fromisoformat(open_rec["break_started_at"])).total_seconds() // 60))
    rec = db.end_break(h.id, open_rec["id"], principal.staff_id, minutes)
    if rec is None:
        return JSONResponse({"error": "You're not on a break."}, status_code=409)
    return JSONResponse({"record": _rec_json(rec, h.timezone, now)})


@router.get("/api/portal/attendance/history")
async def attendance_history(days: int = 30, authorization: str | None = Header(default=None)):
    """The caller's OWN records for the last `days` days, with totals."""
    principal, error = authorize(authorization, "check_in_out", "view")
    if error:
        return error
    h = principal.hospital
    days = max(1, min(days, 365))
    now = _utcnow()
    today = now.astimezone(rules.tz(h.timezone)).date()
    records = db.attendance_between(h.id, (today - timedelta(days=days - 1)).isoformat(), today.isoformat(), principal.staff_id)
    finished = [r for r in records if r["check_out_at"]]
    return JSONResponse({
        "days": days,
        "records": [_rec_json(r, h.timezone, now) for r in reversed(records)],
        "stats": {
            "days_present": len(records), "late_days": sum(1 for r in records if r["status"] == "late"),
            "total_working_minutes": sum(r["working_minutes"] for r in finished),
            "average_working_minutes": (sum(r["working_minutes"] for r in finished) // len(finished)) if finished else 0,
            "total_overtime_minutes": sum(r["overtime_minutes"] for r in finished),
            "missing_clock_outs": sum(1 for r in records if _rec_json(r, h.timezone, now)["missing_clock_out"]),
        },
    })


# ---------------------------------------------------------------- the team view (Owner / Manager)

def day_state(staff: dict, d: date, rec: dict | None, on_leave: bool, settings: dict, now_local: datetime, tz_name: str) -> str:
    """One person's state on one date: on_time | late | clocked_in | missing_clock_out | on_leave | absent |
    not_in (scheduled today, past start + grace, no clock-in yet) | upcoming | off (not scheduled)."""
    today = now_local.date()
    if rec:
        if rec["check_out_at"] is None:
            aged = (now_local.astimezone(timezone.utc) - datetime.fromisoformat(rec["check_in_at"])) > _OPEN_WINDOW
            return "missing_clock_out" if aged else "clocked_in"
        return rec["status"]
    if on_leave:
        return "on_leave"
    started = _started_on(staff)
    if (started and d < started) or not rules.is_scheduled(staff, d):
        return "off"
    if d < today:
        return "absent"
    if d > today:
        return "upcoming"
    start, _ = rules.expected_shift(staff, settings)
    if start:
        due = rules.local_midnight(now_local) + timedelta(minutes=rules.to_minutes(start) + settings["late_grace_minutes"])
        if now_local > due:
            return "not_in"
    return "upcoming"


def _leave_days(rows: list[dict]) -> dict[int, list[tuple[date, date]]]:
    by_staff: dict[int, list[tuple[date, date]]] = {}
    for r in rows:
        by_staff.setdefault(r["staff_id"], []).append((date.fromisoformat(r["from_date"]), date.fromisoformat(r["to_date"])))
    return by_staff


def _on_leave(spans: list[tuple[date, date]] | None, d: date) -> bool:
    return any(a <= d <= b for a, b in (spans or []))


@router.get("/api/portal/attendance/my-summary")
async def attendance_my_summary(month: str = "", authorization: str | None = Header(default=None)):
    """The caller's OWN present/late/absent/leave days for one month (YYYY-MM, default this month), a
    day-by-day row per scheduled/leave/worked day (for the history table), and a weekly present-rate
    trend -- reuses day_state(), the same per-day classifier the Owner/Manager team view is built on,
    just scoped to a single person on their own check_in_out permission instead of "attendance"."""
    principal, error = authorize(authorization, "check_in_out", "view")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    now_local = now.astimezone(rules.tz(h.timezone))
    try:
        first = date.fromisoformat((month or now_local.strftime("%Y-%m")) + "-01")
    except ValueError:
        return JSONResponse({"error": "Choose a valid month (YYYY-MM)."}, status_code=400)
    nxt = date(first.year + (first.month == 12), first.month % 12 + 1, 1)
    last = min(nxt - timedelta(days=1), now_local.date())

    staff = db.get_staff_user_by_id(principal.staff_id) or {}
    settings = db.get_hr_settings(h.id)
    records: dict[str, dict] = {}
    if last >= first:
        records = {r["work_date"]: r for r in db.attendance_between(h.id, first.isoformat(), last.isoformat(), principal.staff_id)}
    leave_spans = _leave_days(db.approved_leave_between(h.id, first.isoformat(), last.isoformat())).get(principal.staff_id, [])

    present = late = absent = on_leave = 0
    day_rows: list[dict] = []
    weeks: list[dict] = []
    joined = _started_on(staff)
    d = max(first, joined) if joined else first
    week_start = d
    week_present = week_scheduled = 0
    while d <= last:
        rec = records.get(d.isoformat())
        covered = _on_leave(leave_spans, d)
        state = day_state(staff, d, rec, covered, settings, now_local, h.timezone)
        if state in ("on_time", "clocked_in", "missing_clock_out"):
            present += 1
        elif state == "late":
            present += 1
            late += 1
        elif state == "on_leave":
            on_leave += 1
        elif state == "absent":
            absent += 1
        if state not in ("off", "upcoming"):
            r = _rec_json(rec, h.timezone, now) if rec else None
            day_rows.append({
                "work_date": d.isoformat(), "status": state,
                "check_in_local": r["check_in_local"] if r else None,
                "check_out_local": r["check_out_local"] if r else None,
                "break_minutes": r["break_minutes"] if r else 0,
                "working_minutes": r["working_minutes"] if r else 0,
                "overtime_minutes": r["overtime_minutes"] if r else 0,
            })
        if rules.is_scheduled(staff, d):
            week_scheduled += 1
            if state in ("on_time", "late", "clocked_in", "missing_clock_out"):
                week_present += 1
        if (d - week_start).days == 6 or d == last:
            pct = round((week_present / week_scheduled) * 100) if week_scheduled else 0
            weeks.append({"label": f"Week {len(weeks) + 1}", "pct": pct})
            week_present = week_scheduled = 0
            week_start = d + timedelta(days=1)
        d += timedelta(days=1)

    finished = [r for r in records.values() if r["check_out_at"]]
    return JSONResponse({
        "month": first.strftime("%Y-%m"),
        "stats": {
            "present_days": present, "late_days": late, "absent_days": absent, "leave_days": on_leave,
            "working_minutes": sum(r["working_minutes"] for r in finished),
            "overtime_minutes": sum(r["overtime_minutes"] for r in finished),
            "missing_clock_outs": sum(1 for r in records.values() if _rec_json(r, h.timezone, now)["missing_clock_out"]),
        },
        "weekly_trend": weeks,
        "records": list(reversed(day_rows)),
    })


@router.get("/api/portal/attendance/overview")
async def attendance_overview(date_: str = Query("", alias="date"), authorization: str | None = Header(default=None)):
    """Everyone's state for one date (default today): who's in, late, absent, on leave, off."""
    principal, error = authorize(authorization, "attendance", "view")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    now_local = now.astimezone(rules.tz(h.timezone))
    d = _iso_date(date_, now_local.date())
    if d is None:
        return JSONResponse({"error": "Choose a valid date."}, status_code=400)
    settings = db.get_hr_settings(h.id)
    records = {r["staff_id"]: r for r in db.attendance_between(h.id, d.isoformat(), d.isoformat())}
    leave = _leave_days(db.approved_leave_between(h.id, d.isoformat(), d.isoformat()))
    rows, counts = [], {}
    for member in db.list_staff_users_for_hospital(h.id):
        if not member["is_active"]:
            continue
        rec = records.get(member["id"])
        state = day_state(member, d, rec, _on_leave(leave.get(member["id"]), d), settings, now_local, h.timezone)
        counts[state] = counts.get(state, 0) + 1
        start, end = rules.expected_shift(member, settings)
        rows.append({
            "staff_id": member["id"], "name": member["name"], "role": member["role"], "employee_id": member.get("employee_id"),
            "state": state, "shift_start": start, "shift_end": end, "record": _rec_json(rec, h.timezone, now),
        })
    return JSONResponse({"date": d.isoformat(), "rows": rows, "counts": counts, "is_today": d == now_local.date()})


@router.get("/api/portal/attendance/summary")
async def attendance_summary(month: str = "", authorization: str | None = Header(default=None)):
    """Per-person totals for one month (YYYY-MM, default this month), counting days up to today."""
    principal, error = authorize(authorization, "attendance", "view")
    if error:
        return error
    h = principal.hospital
    now = _utcnow()
    now_local = now.astimezone(rules.tz(h.timezone))
    try:
        first = date.fromisoformat((month or now_local.strftime("%Y-%m")) + "-01")
    except ValueError:
        return JSONResponse({"error": "Choose a valid month (YYYY-MM)."}, status_code=400)
    nxt = date(first.year + (first.month == 12), first.month % 12 + 1, 1)
    last = min(nxt - timedelta(days=1), now_local.date())
    records: dict[int, dict[str, dict]] = {}
    if last >= first:
        for r in db.attendance_between(h.id, first.isoformat(), last.isoformat()):
            records.setdefault(r["staff_id"], {})[r["work_date"]] = r
    leave = _leave_days(db.approved_leave_between(h.id, first.isoformat(), last.isoformat())) if last >= first else {}
    rows = []
    for member in db.list_staff_users_for_hospital(h.id):
        if not member["is_active"]:
            continue
        mine = records.get(member["id"], {})
        present = late = absent = on_leave = 0
        joined = _started_on(member)
        d = max(first, joined) if joined else first
        while d <= last:
            rec = mine.get(d.isoformat())
            covered = _on_leave(leave.get(member["id"]), d)
            if rec:
                present += 1
                late += rec["status"] == "late"
            elif covered and (rules.is_scheduled(member, d) or not rules.parse_days(member.get("working_days"))):
                on_leave += 1
            elif not covered and rules.is_scheduled(member, d) and d < now_local.date():
                absent += 1
            d += timedelta(days=1)
        finished = [r for r in mine.values() if r["check_out_at"]]
        rows.append({
            "staff_id": member["id"], "name": member["name"], "role": member["role"], "employee_id": member.get("employee_id"),
            "present_days": present, "late_days": late, "absent_days": absent, "leave_days": on_leave,
            "working_minutes": sum(r["working_minutes"] for r in finished), "overtime_minutes": sum(r["overtime_minutes"] for r in finished),
            "missing_clock_outs": sum(1 for r in mine.values() if _rec_json(r, h.timezone, now)["missing_clock_out"]),
        })
    return JSONResponse({"month": first.strftime("%Y-%m"), "rows": rows})


class CorrectPayload(BaseModel):
    check_out_time: str = ""  # HH:MM, in the restaurant's timezone
    note: str = ""


@router.post("/api/portal/attendance/{record_id}/correct")
async def correct_clock_out(record_id: int, payload: CorrectPayload, authorization: str | None = Header(default=None)):
    """A Manager filling in a forgotten clock-out. Only an open record can be corrected; the person is told."""
    principal, error = authorize(authorization, "attendance", "write")
    if error:
        return error
    h = principal.hospital
    rec = db.get_attendance_by_id(h.id, record_id)
    if rec is None:
        return JSONResponse({"error": "Attendance record not found."}, status_code=404)
    if rec["check_out_at"] is not None:
        return JSONResponse({"error": "This record already has a clock-out."}, status_code=409)
    note = payload.note.strip()
    if not rules.valid_hhmm(payload.check_out_time):
        return JSONResponse({"error": "Enter the clock-out time like 22:30."}, status_code=400)
    if len(note) < 3:
        return JSONResponse({"error": "Please note why you're correcting this."}, status_code=400)

    local_in = rules.to_local(rec["check_in_at"], h.timezone)
    out_local = rules.local_time(local_in, payload.check_out_time)
    if out_local <= local_in:
        out_local = rules.local_time(local_in, payload.check_out_time, extra_days=1)  # earlier than the clock-in time = after midnight
    if out_local.astimezone(timezone.utc) > _utcnow():
        return JSONResponse({"error": "The clock-out can't be in the future."}, status_code=400)
    staff = db.get_staff_user_by_id(rec["staff_id"]) or {}
    scheduled = rules.scheduled_minutes(*rules.expected_shift(staff, db.get_hr_settings(h.id)))
    out_utc = _iso(out_local)
    break_minutes = rec["break_minutes"]
    working, overtime = rules.compute_worked(rec["check_in_at"], out_utc, break_minutes, scheduled)
    fixed = db.correct_check_out(h.id, record_id, principal.staff_id, out_utc, working, overtime, note)
    if fixed is None:
        return JSONResponse({"error": "This record already has a clock-out."}, status_code=409)
    db.record_audit_log(
        "portal", h.id, _actor(principal), "attendance.correct_clock_out", entity_type="staff_attendance", entity_id=str(record_id),
        before={"check_out_at": None}, after={"check_out_at": out_utc, "staff_id": rec["staff_id"], "note": note},
    )
    if rec["staff_id"] != principal.staff_id:
        db.create_notification(
            h.id, rec["staff_id"], "attendance_correction", "Your clock-out was corrected",
            f"{rec['work_date']}: clock-out set to {payload.check_out_time}. Note: {note}", "/portal/attendance",
        )
    return JSONResponse({"record": _rec_json(fixed, h.timezone, _utcnow())})


# ---------------------------------------------------------------- the rules (Owner / Manager)

def _settings_json(s: dict) -> dict:
    return {
        "shift_start": s["shift_start"], "shift_end": s["shift_end"], "late_grace_minutes": s["late_grace_minutes"],
        "latitude": s["latitude"], "longitude": s["longitude"], "radius_meters": s["radius_meters"],
        "allowed_ips": rules.parse_ip_list(s["allowed_ips"]),
    }


@router.get("/api/portal/attendance/settings")
async def get_attendance_settings(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "attendance_settings", "view")
    if error:
        return error
    return JSONResponse(_settings_json(db.get_hr_settings(principal.hospital.id)))


class AttendanceSettingsPayload(BaseModel):
    shift_start: str | None = None
    shift_end: str | None = None
    late_grace_minutes: int = 10
    latitude: float | None = None
    longitude: float | None = None
    radius_meters: int | None = None
    allowed_ips: list[str] | None = None


@router.post("/api/portal/attendance/settings")
async def set_attendance_settings(payload: AttendanceSettingsPayload, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "attendance_settings", "write")
    if error:
        return error
    h = principal.hospital
    errors = []
    start, end = (payload.shift_start or "").strip() or None, (payload.shift_end or "").strip() or None
    if (start is None) != (end is None):
        errors.append("Set both a shift start and a shift end (or neither).")
    for label, value in (("Shift start", start), ("Shift end", end)):
        if value and not rules.valid_hhmm(value):
            errors.append(f"{label} must be a time like 09:00.")
    if start and start == end:
        errors.append("Shift start and end can't be the same time.")
    if not (0 <= payload.late_grace_minutes <= 240):
        errors.append("The late grace period must be between 0 and 240 minutes.")
    gps = (payload.latitude, payload.longitude, payload.radius_meters)
    if any(v is not None for v in gps) and any(v is None for v in gps):
        errors.append("Set the latitude, longitude and radius together (or leave all three blank).")
    elif all(v is not None for v in gps):
        if not (-90 <= payload.latitude <= 90) or not (-180 <= payload.longitude <= 180):
            errors.append("That latitude/longitude isn't valid.")
        if not (10 <= payload.radius_meters <= 50_000):
            errors.append("The radius must be between 10 m and 50,000 m.")
    ips = [i.strip() for i in (payload.allowed_ips or []) if i.strip()]
    bad = [i for i in ips if not rules.valid_ip_or_cidr(i)]
    if bad:
        errors.append(f"Not a valid IP address or range: {', '.join(bad)}.")
    if errors:
        return JSONResponse({"error": " ".join(errors)}, status_code=400)

    before = _settings_json(db.get_hr_settings(h.id))
    saved = db.update_attendance_settings(
        h.id, start, end, payload.late_grace_minutes, payload.latitude, payload.longitude, payload.radius_meters, ", ".join(ips) or None,
    )
    db.record_audit_log(
        "portal", h.id, _actor(principal), "attendance.update_settings", entity_type="staff_hr_settings", entity_id=str(h.id),
        before=before, after=_settings_json(saved),
    )
    return JSONResponse(_settings_json(saved))
