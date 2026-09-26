#!/usr/bin/env python3
"""Backfills ~30 days of realistic attendance history (and one approved leave span) for Daaprime's
real staff (hospital #3), so the Attendance / Check-in-out dashboards have real data to show instead
of empty states. Idempotent: only fills a (staff, date) that has no row yet, and only sets
working_days/shift on a staff row that doesn't already have one -- never overwrites or deletes an
existing attendance row, except the two records an earlier manual test left open on 2026-09-23
(staff 5 and 7), which are closed out with a normal check-out so they don't read as "still clocked
in" for days afterward.

Deliberately stops the day BEFORE today: today is left for a real, live clock-in test.

Usage:
    DATABASE_URL="..." python -m scripts.seed_attendance_history
"""
import random
from datetime import date, datetime, timedelta

from sqlalchemy import text

from db.connection import get_session
from portal import attendance_rules as rules

HOSPITAL_ID = 3
DAYS_BACK = 30
DECIDED_BY = 9  # owner@daaprimetech.com -- the leave approval's "decided_by"

# identity_id -> working pattern. Kavya/Arjun/Suresh/Divya already have one set (their real schedule);
# Test Staff/Test Cashier don't yet, so COALESCE below only fills those two.
STAFF = {
    5: {"working_days": "Mon,Tue,Wed,Thu,Fri", "shift": ("10:00", "19:00")},
    6: {"working_days": "Wed,Thu,Fri,Sat,Sun", "shift": ("12:00", "21:00")},
    7: {"working_days": "Mon,Tue,Wed,Thu,Fri,Sat", "shift": ("09:00", "18:00")},
    8: {"working_days": "Tue,Wed,Thu,Fri,Sat,Sun", "shift": ("13:00", "22:00")},
    10: {"working_days": "Mon,Tue,Wed,Thu,Fri,Sat", "shift": ("09:00", "18:00")},
    11: {"working_days": "Mon,Tue,Wed,Thu,Fri,Sat", "shift": ("09:00", "18:00")},
}


def shift_minutes(start: str, end: str) -> int:
    sh, sm = map(int, start.split(":"))
    eh, em = map(int, end.split(":"))
    mins = (eh * 60 + em) - (sh * 60 + sm)
    return mins if mins > 0 else mins + 24 * 60


def to_iso(d: date, hhmm: str, offset_min: int = 0) -> str:
    h, m = map(int, hhmm.split(":"))
    dt = datetime(d.year, d.month, d.day, h, m) + timedelta(minutes=offset_min)
    return dt.isoformat() + "+00:00"


def main() -> None:
    today = date.today()
    leave_spans = {6: [(today - timedelta(days=12), today - timedelta(days=11))]}  # Arjun: 2 days off, ~2 weeks ago
    random.seed(20260926)
    s = get_session()

    for staff_id, cfg in STAFF.items():
        s.execute(
            text(
                "UPDATE staff_details SET working_days = COALESCE(working_days, :wd), "
                "shift_start = COALESCE(shift_start, :ss), shift_end = COALESCE(shift_end, :se) "
                "WHERE identity_id = :sid AND hospital_id = :hid"
            ),
            {"wd": cfg["working_days"], "ss": cfg["shift"][0], "se": cfg["shift"][1], "sid": staff_id, "hid": HOSPITAL_ID},
        )

    for staff_id in (5, 7):
        row = s.execute(
            text(
                "SELECT id, check_in_at, break_minutes FROM staff_attendance "
                "WHERE hospital_id = :hid AND staff_id = :sid AND work_date = :wd AND check_out_at IS NULL"
            ),
            {"hid": HOSPITAL_ID, "sid": staff_id, "wd": "2026-09-23"},
        ).fetchone()
        if row:
            shift_end = STAFF[staff_id]["shift"][1]
            check_out = to_iso(date(2026, 9, 23), shift_end, random.randint(-10, 20))
            working = int((datetime.fromisoformat(check_out) - datetime.fromisoformat(row.check_in_at)).total_seconds() // 60) - row.break_minutes
            overtime = max(0, working - shift_minutes(*STAFF[staff_id]["shift"]))
            s.execute(
                text("UPDATE staff_attendance SET check_out_at = :co, working_minutes = :w, overtime_minutes = :o WHERE id = :id"),
                {"co": check_out, "w": max(working, 0), "o": overtime, "id": row.id},
            )
            print(f"Closed stale open record: staff {staff_id} on 2026-09-23.")

    created = 0
    for staff_id, cfg in STAFF.items():
        working_days = rules.parse_days(cfg["working_days"])
        shift_start, shift_end = cfg["shift"]
        scheduled = shift_minutes(shift_start, shift_end)
        spans = leave_spans.get(staff_id, [])
        d = today - timedelta(days=DAYS_BACK)
        while d < today:
            if rules.weekday_abbr(d) in working_days and not any(a <= d <= b for a, b in spans):
                exists = s.execute(
                    text("SELECT 1 FROM staff_attendance WHERE hospital_id = :hid AND staff_id = :sid AND work_date = :wd"),
                    {"hid": HOSPITAL_ID, "sid": staff_id, "wd": d.isoformat()},
                ).fetchone()
                if not exists:
                    roll = random.random()
                    if roll >= 0.06:  # ~6% absent (no row at all)
                        late = roll > 0.85
                        late_minutes = random.randint(11, 35) if late else 0
                        check_in = to_iso(d, shift_start, late_minutes + random.randint(-4, 4))
                        break_minutes = random.choice([0, 30, 30, 45])
                        end_offset = random.randint(20, 60) if random.random() > 0.2 else random.randint(-10, 15)
                        check_out = to_iso(d, shift_end, end_offset)
                        working = int((datetime.fromisoformat(check_out) - datetime.fromisoformat(check_in)).total_seconds() // 60) - break_minutes
                        overtime = max(0, working - scheduled)
                        s.execute(
                            text(
                                "INSERT INTO staff_attendance (hospital_id, staff_id, work_date, check_in_at, check_in_method, "
                                "check_out_at, break_minutes, status, late_minutes, working_minutes, overtime_minutes, created_at) "
                                "VALUES (:hid, :sid, :wd, :ci, 'unrestricted', :co, :brk, :st, :lm, :wm, :om, :ca)"
                            ),
                            {
                                "hid": HOSPITAL_ID, "sid": staff_id, "wd": d.isoformat(), "ci": check_in, "co": check_out,
                                "brk": break_minutes, "st": "late" if late else "on_time", "lm": late_minutes,
                                "wm": max(working, 0), "om": overtime, "ca": check_in,
                            },
                        )
                        created += 1
            d += timedelta(days=1)

    leave_created = 0
    for staff_id, spans in leave_spans.items():
        for frm, to in spans:
            exists = s.execute(
                text("SELECT 1 FROM staff_leave_requests WHERE hospital_id = :hid AND staff_id = :sid AND from_date = :f AND to_date = :t"),
                {"hid": HOSPITAL_ID, "sid": staff_id, "f": frm.isoformat(), "t": to.isoformat()},
            ).fetchone()
            if not exists:
                now_iso = datetime.utcnow().isoformat() + "+00:00"
                s.execute(
                    text(
                        "INSERT INTO staff_leave_requests (hospital_id, staff_id, leave_type, from_date, to_date, "
                        "is_half_day, days, reason, status, decided_by, decided_at, created_at) "
                        "VALUES (:hid, :sid, 'casual', :f, :t, false, :days, 'Personal time off', 'approved', :db, :now, :now)"
                    ),
                    {"hid": HOSPITAL_ID, "sid": staff_id, "f": frm.isoformat(), "t": to.isoformat(), "days": (to - frm).days + 1, "db": DECIDED_BY, "now": now_iso},
                )
                leave_created += 1
                print(f"Added approved leave: staff {staff_id}, {frm} to {to}")

    s.commit()
    print(f"Created {created} attendance rows and {leave_created} leave requests for hospital {HOSPITAL_ID}.")


if __name__ == "__main__":
    main()
