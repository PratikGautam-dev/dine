# db/repositories/staff_leave.py
"""Staff HR leave: requests, the yearly balance, the restaurant's allowance, and in-portal notifications.

A request covers calendar days, inclusive (0.5 for a half-day, which must be a single day). Balance for a
calendar year = allowance - approved days falling in that year; a request spanning New Year counts each
year's share in its own year. 'unpaid' leave never uses the allowance. Every decision is a guarded UPDATE
(only a still-pending request can be decided/cancelled), so a double click or two managers deciding at
once can't apply twice."""
from datetime import date, datetime, timedelta, timezone

from db.connection import get_connection

LEAVE_TYPES = ("casual", "sick", "annual", "unpaid", "personal")
DEFAULT_ANNUAL_LEAVE_DAYS = 20
STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_CANCELLED = "pending", "approved", "rejected", "cancelled"

_COLUMNS = (
    "r.id, r.hospital_id, r.staff_id, r.leave_type, r.from_date, r.to_date, r.is_half_day, r.days, r.reason, "
    "r.status, r.decided_by, r.decided_at, r.decision_note, r.created_at"
)


def _row(r) -> dict:
    d = dict(r)
    d["days"] = float(d["days"])
    return d


def days_between(from_date: str, to_date: str, half_day: bool) -> float:
    if half_day:
        return 0.5
    return float((date.fromisoformat(to_date) - date.fromisoformat(from_date)).days + 1)


def _overlap_days(from_date: str, to_date: str, half_day: bool, win_start: date, win_end: date) -> float:
    """Days of a request that fall inside [win_start, win_end] (both inclusive)."""
    start, end = max(date.fromisoformat(from_date), win_start), min(date.fromisoformat(to_date), win_end)
    if end < start:
        return 0.0
    return 0.5 if half_day else float((end - start).days + 1)


# ---------------------------------------------------------------- policy

def get_annual_leave_days(hospital_id: int) -> int:
    row = get_connection().execute("SELECT annual_leave_days FROM staff_hr_settings WHERE hospital_id = ?", (hospital_id,)).fetchone()
    return row["annual_leave_days"] if row else DEFAULT_ANNUAL_LEAVE_DAYS


def set_annual_leave_days(hospital_id: int, days: int) -> int:
    if not (0 <= days <= 366):
        raise ValueError("annual_leave_days must be between 0 and 366")
    get_connection().execute(
        "INSERT INTO staff_hr_settings (hospital_id, annual_leave_days) VALUES (?, ?) "
        "ON CONFLICT (hospital_id) DO UPDATE SET annual_leave_days = EXCLUDED.annual_leave_days",
        (hospital_id, days),
    )
    return days


# ---------------------------------------------------------------- requests

class LeaveOverlapError(Exception):
    pass


def create_leave_request(
    hospital_id: int, staff_id: int, leave_type: str, from_date: str, to_date: str, is_half_day: bool, reason: str,
) -> dict:
    """Raises LeaveOverlapError if this person already has a pending/approved request touching these dates."""
    conn = get_connection()
    clash = conn.execute(
        "SELECT id FROM staff_leave_requests WHERE hospital_id = ? AND staff_id = ? AND status IN ('pending', 'approved') "
        "AND from_date <= ? AND to_date >= ? LIMIT 1",
        (hospital_id, staff_id, to_date, from_date),
    ).fetchone()
    if clash is not None:
        raise LeaveOverlapError()
    row = conn.execute(
        "INSERT INTO staff_leave_requests (hospital_id, staff_id, leave_type, from_date, to_date, is_half_day, days, reason) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        (hospital_id, staff_id, leave_type, from_date, to_date, is_half_day, days_between(from_date, to_date, is_half_day), reason),
    ).fetchone()
    return get_leave_request(hospital_id, row["id"])  # type: ignore[return-value]


def get_leave_request(hospital_id: int, request_id: int) -> dict | None:
    row = get_connection().execute(
        f"SELECT {_COLUMNS}, i.name AS staff_name, s.role AS staff_role FROM staff_leave_requests r "
        "JOIN identities i ON i.id = r.staff_id JOIN staff_details s ON s.identity_id = r.staff_id "
        "WHERE r.hospital_id = ? AND r.id = ?",
        (hospital_id, request_id),
    ).fetchone()
    return _row(row) if row else None


def list_leave_requests(hospital_id: int, status: str | None = None, staff_id: int | None = None) -> list[dict]:
    sql = (
        f"SELECT {_COLUMNS}, i.name AS staff_name, s.role AS staff_role FROM staff_leave_requests r "
        "JOIN identities i ON i.id = r.staff_id JOIN staff_details s ON s.identity_id = r.staff_id WHERE r.hospital_id = ?"
    )
    params: list = [hospital_id]
    if status:
        sql += " AND r.status = ?"
        params.append(status)
    if staff_id is not None:
        sql += " AND r.staff_id = ?"
        params.append(staff_id)
    sql += " ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.from_date DESC, r.id DESC"
    return [_row(r) for r in get_connection().execute(sql, tuple(params)).fetchall()]


def decide_leave_request(hospital_id: int, request_id: int, new_status: str, decided_by: int, note: str | None) -> dict | None:
    """approve/reject a request that is STILL pending. None when it isn't (already decided/cancelled)."""
    if new_status not in (STATUS_APPROVED, STATUS_REJECTED):
        raise ValueError(new_status)
    row = get_connection().execute(
        "UPDATE staff_leave_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? "
        "WHERE hospital_id = ? AND id = ? AND status = 'pending' RETURNING id",
        (new_status, decided_by, datetime.now(timezone.utc).isoformat(), note, hospital_id, request_id),
    ).fetchone()
    return get_leave_request(hospital_id, request_id) if row else None


def cancel_leave_request(hospital_id: int, request_id: int, staff_id: int) -> dict | None:
    """A person withdraws THEIR OWN pending request."""
    row = get_connection().execute(
        "UPDATE staff_leave_requests SET status = 'cancelled' "
        "WHERE hospital_id = ? AND id = ? AND staff_id = ? AND status = 'pending' RETURNING id",
        (hospital_id, request_id, staff_id),
    ).fetchone()
    return get_leave_request(hospital_id, request_id) if row else None


# ---------------------------------------------------------------- balance + conflicts

def leave_balance(hospital_id: int, staff_id: int, year: int) -> dict:
    """{allowance, used, pending, remaining, year}. Unpaid leave never counts against the allowance."""
    allowance = get_annual_leave_days(hospital_id)
    win_start, win_end = date(year, 1, 1), date(year, 12, 31)
    used = pending = 0.0
    for r in get_connection().execute(
        "SELECT leave_type, from_date, to_date, is_half_day, status FROM staff_leave_requests "
        "WHERE hospital_id = ? AND staff_id = ? AND status IN ('pending', 'approved') AND from_date <= ? AND to_date >= ?",
        (hospital_id, staff_id, win_end.isoformat(), win_start.isoformat()),
    ).fetchall():
        if r["leave_type"] == "unpaid":
            continue
        share = _overlap_days(r["from_date"], r["to_date"], r["is_half_day"], win_start, win_end)
        if r["status"] == STATUS_APPROVED:
            used += share
        else:
            pending += share
    return {"year": year, "allowance": allowance, "used": used, "pending": pending, "remaining": allowance - used}


def approved_leave_between(hospital_id: int, start: str, end: str) -> list[dict]:
    """Approved requests touching [start, end] (ISO dates), for the whole restaurant."""
    return [dict(r) for r in get_connection().execute(
        "SELECT staff_id, from_date, to_date, is_half_day FROM staff_leave_requests "
        "WHERE hospital_id = ? AND status = 'approved' AND from_date <= ? AND to_date >= ?",
        (hospital_id, end, start),
    ).fetchall()]


def role_conflicts(hospital_id: int, request: dict) -> dict:
    """"2 of 3 Kitchen staff already off" -- how many active people in the requester's role already have
    approved leave overlapping these dates (the requester excluded from both counts)."""
    conn = get_connection()
    total = conn.execute(
        "SELECT COUNT(*) AS c FROM staff_details s JOIN identities i ON i.id = s.identity_id "
        "WHERE s.hospital_id = ? AND s.role = ? AND i.is_active AND s.identity_id <> ?",
        (hospital_id, request["staff_role"], request["staff_id"]),
    ).fetchone()["c"]
    off = conn.execute(
        "SELECT COUNT(DISTINCT r.staff_id) AS c FROM staff_leave_requests r JOIN staff_details s ON s.identity_id = r.staff_id "
        "WHERE r.hospital_id = ? AND s.role = ? AND r.status = 'approved' AND r.staff_id <> ? "
        "AND r.from_date <= ? AND r.to_date >= ?",
        (hospital_id, request["staff_role"], request["staff_id"], request["to_date"], request["from_date"]),
    ).fetchone()["c"]
    return {"role_total": total, "role_off": off}


# ---------------------------------------------------------------- in-portal notifications

def create_notification(hospital_id: int, staff_id: int, kind: str, title: str, body: str | None = None, link: str | None = None) -> None:
    get_connection().execute(
        "INSERT INTO staff_notifications (hospital_id, staff_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)",
        (hospital_id, staff_id, kind, title, body, link),
    )


def list_notifications(hospital_id: int, staff_id: int, limit: int = 30) -> list[dict]:
    return [dict(r) for r in get_connection().execute(
        "SELECT id, kind, title, body, link, is_read, created_at FROM staff_notifications "
        "WHERE hospital_id = ? AND staff_id = ? ORDER BY id DESC LIMIT ?",
        (hospital_id, staff_id, limit),
    ).fetchall()]


def count_unread_notifications(hospital_id: int, staff_id: int) -> int:
    return get_connection().execute(
        "SELECT COUNT(*) AS c FROM staff_notifications WHERE hospital_id = ? AND staff_id = ? AND NOT is_read",
        (hospital_id, staff_id),
    ).fetchone()["c"]


def mark_notifications_read(hospital_id: int, staff_id: int, ids: list[int] | None) -> int:
    """Marks the caller's OWN notifications read (all of them when ids is None)."""
    if ids is None:
        rows = get_connection().execute(
            "UPDATE staff_notifications SET is_read = TRUE WHERE hospital_id = ? AND staff_id = ? AND NOT is_read RETURNING id",
            (hospital_id, staff_id),
        ).fetchall()
    else:
        if not ids:
            return 0
        marks = ", ".join("?" for _ in ids)
        rows = get_connection().execute(
            f"UPDATE staff_notifications SET is_read = TRUE WHERE hospital_id = ? AND staff_id = ? AND NOT is_read AND id IN ({marks}) RETURNING id",
            (hospital_id, staff_id, *ids),
        ).fetchall()
    return len(rows)
