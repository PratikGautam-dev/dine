# db/repositories/staff_attendance.py
"""Staff attendance (clock in/out) and the HR/attendance settings row.

One staff_attendance row per person per WORK DATE (the restaurant's local date; UNIQUE(staff_id, work_date)).
Times are UTC ISO text. Every write names hospital_id (and staff_id where it's the person's own action) in
its WHERE, so nothing can reach another restaurant's or another person's row. Absent / on-leave are never
stored -- they're computed by the routes from the working pattern, approved leave and the presence of a row."""
from db.connection import get_connection

_SETTINGS_DEFAULTS = {
    "annual_leave_days": 20, "shift_start": None, "shift_end": None, "late_grace_minutes": 10,
    "latitude": None, "longitude": None, "radius_meters": None, "allowed_ips": None,
}
_RECORD_COLUMNS = (
    "id, hospital_id, staff_id, work_date, check_in_at, check_in_lat, check_in_lng, check_in_ip, check_in_method, "
    "check_out_at, break_started_at, break_minutes, status, late_minutes, working_minutes, overtime_minutes, "
    "corrected_by, correction_note"
)


# ---------------------------------------------------------------- settings

def get_hr_settings(hospital_id: int) -> dict:
    row = get_connection().execute(
        "SELECT annual_leave_days, shift_start, shift_end, late_grace_minutes, latitude, longitude, radius_meters, allowed_ips "
        "FROM staff_hr_settings WHERE hospital_id = ?",
        (hospital_id,),
    ).fetchone()
    return dict(row) if row else dict(_SETTINGS_DEFAULTS)


def update_attendance_settings(
    hospital_id: int, shift_start: str | None, shift_end: str | None, late_grace_minutes: int,
    latitude: float | None, longitude: float | None, radius_meters: int | None, allowed_ips: str | None,
) -> dict:
    get_connection().execute(
        "INSERT INTO staff_hr_settings (hospital_id, shift_start, shift_end, late_grace_minutes, latitude, longitude, radius_meters, allowed_ips) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (hospital_id) DO UPDATE SET shift_start = EXCLUDED.shift_start, "
        "shift_end = EXCLUDED.shift_end, late_grace_minutes = EXCLUDED.late_grace_minutes, latitude = EXCLUDED.latitude, "
        "longitude = EXCLUDED.longitude, radius_meters = EXCLUDED.radius_meters, allowed_ips = EXCLUDED.allowed_ips",
        (hospital_id, shift_start, shift_end, late_grace_minutes, latitude, longitude, radius_meters, allowed_ips),
    )
    return get_hr_settings(hospital_id)


# ---------------------------------------------------------------- records

def get_attendance(hospital_id: int, staff_id: int, work_date: str) -> dict | None:
    row = get_connection().execute(
        f"SELECT {_RECORD_COLUMNS} FROM staff_attendance WHERE hospital_id = ? AND staff_id = ? AND work_date = ?",
        (hospital_id, staff_id, work_date),
    ).fetchone()
    return dict(row) if row else None


def get_attendance_by_id(hospital_id: int, record_id: int) -> dict | None:
    row = get_connection().execute(
        f"SELECT {_RECORD_COLUMNS} FROM staff_attendance WHERE hospital_id = ? AND id = ?", (hospital_id, record_id),
    ).fetchone()
    return dict(row) if row else None


def get_open_attendance(hospital_id: int, staff_id: int, not_before_iso: str) -> dict | None:
    """The person's most recent clock-in with no clock-out that started at/after `not_before_iso`
    (so an overnight shift can still be closed the next morning, while a forgotten clock-out from
    days ago is left for a Manager to correct instead of blocking today)."""
    row = get_connection().execute(
        f"SELECT {_RECORD_COLUMNS} FROM staff_attendance WHERE hospital_id = ? AND staff_id = ? "
        "AND check_out_at IS NULL AND check_in_at >= ? ORDER BY check_in_at DESC LIMIT 1",
        (hospital_id, staff_id, not_before_iso),
    ).fetchone()
    return dict(row) if row else None


def create_check_in(
    hospital_id: int, staff_id: int, work_date: str, check_in_at: str, lat: float | None, lng: float | None,
    ip: str | None, method: str, status: str, late_minutes: int,
) -> dict:
    """Raises db.connection.IntegrityError if this person already has a record for that work date."""
    row = get_connection().execute(
        "INSERT INTO staff_attendance (hospital_id, staff_id, work_date, check_in_at, check_in_lat, check_in_lng, "
        "check_in_ip, check_in_method, status, late_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        (hospital_id, staff_id, work_date, check_in_at, lat, lng, ip, method, status, late_minutes),
    ).fetchone()
    return get_attendance_by_id(hospital_id, row["id"])  # type: ignore[return-value]


def set_check_out(
    hospital_id: int, record_id: int, staff_id: int, check_out_at: str, lat: float | None, lng: float | None,
    ip: str | None, break_minutes: int, working: int, overtime: int,
) -> dict | None:
    """The person's own clock-out of a record that is still open."""
    row = get_connection().execute(
        "UPDATE staff_attendance SET check_out_at = ?, check_out_lat = ?, check_out_lng = ?, check_out_ip = ?, "
        "break_started_at = NULL, break_minutes = ?, working_minutes = ?, overtime_minutes = ? "
        "WHERE hospital_id = ? AND id = ? AND staff_id = ? AND check_out_at IS NULL RETURNING id",
        (check_out_at, lat, lng, ip, break_minutes, working, overtime, hospital_id, record_id, staff_id),
    ).fetchone()
    return get_attendance_by_id(hospital_id, record_id) if row else None


def start_break(hospital_id: int, record_id: int, staff_id: int, at_iso: str) -> dict | None:
    row = get_connection().execute(
        "UPDATE staff_attendance SET break_started_at = ? WHERE hospital_id = ? AND id = ? AND staff_id = ? "
        "AND check_out_at IS NULL AND break_started_at IS NULL RETURNING id",
        (at_iso, hospital_id, record_id, staff_id),
    ).fetchone()
    return get_attendance_by_id(hospital_id, record_id) if row else None


def end_break(hospital_id: int, record_id: int, staff_id: int, add_minutes: int) -> dict | None:
    row = get_connection().execute(
        "UPDATE staff_attendance SET break_started_at = NULL, break_minutes = break_minutes + ? "
        "WHERE hospital_id = ? AND id = ? AND staff_id = ? AND check_out_at IS NULL AND break_started_at IS NOT NULL RETURNING id",
        (add_minutes, hospital_id, record_id, staff_id),
    ).fetchone()
    return get_attendance_by_id(hospital_id, record_id) if row else None


def correct_check_out(
    hospital_id: int, record_id: int, corrected_by: int, check_out_at: str, working: int, overtime: int, note: str,
) -> dict | None:
    """A Manager filling in a forgotten clock-out. Only a record that really has none can be corrected."""
    row = get_connection().execute(
        "UPDATE staff_attendance SET check_out_at = ?, break_started_at = NULL, working_minutes = ?, overtime_minutes = ?, "
        "corrected_by = ?, correction_note = ? WHERE hospital_id = ? AND id = ? AND check_out_at IS NULL RETURNING id",
        (check_out_at, working, overtime, corrected_by, note, hospital_id, record_id),
    ).fetchone()
    return get_attendance_by_id(hospital_id, record_id) if row else None


def attendance_between(hospital_id: int, start: str, end: str, staff_id: int | None = None) -> list[dict]:
    """Records whose work date is in [start, end] (ISO dates), oldest first; one person's or the whole team's."""
    sql = f"SELECT {_RECORD_COLUMNS} FROM staff_attendance WHERE hospital_id = ? AND work_date >= ? AND work_date <= ?"
    params: list = [hospital_id, start, end]
    if staff_id is not None:
        sql += " AND staff_id = ?"
        params.append(staff_id)
    return [dict(r) for r in get_connection().execute(sql + " ORDER BY work_date, check_in_at", tuple(params)).fetchall()]
