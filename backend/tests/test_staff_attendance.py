# tests/test_staff_attendance.py
"""Staff attendance: clock in/out, breaks, late / overtime, the location check, forgotten clock-outs and a
Manager's correction, the team overview (present / late / absent / on leave / off), the monthly summary and
the attendance settings -- with real staff logins, real requests and a frozen clock.

The restaurant is in Asia/Kolkata (UTC+5:30, no DST) with a 09:00-17:00 shift and a 10-minute grace.
2026-09-21 is a Monday."""
from datetime import date

import pytest

import db.repository as db
from db.connection import get_connection
from tests.hr_helpers import client, freeze, ist, login, make_staff, set_timezone  # noqa: F401

MON = (2026, 9, 21)
TUE = (2026, 9, 22)
HERE = {"latitude": 12.9716, "longitude": 77.5946}


@pytest.fixture
def team(hospital_id, monkeypatch):
    set_timezone(hospital_id)
    t = {
        "owner": login(hospital_id, "admin", "owner@example.com", "Olive Owner"),
        "foh": login(hospital_id, "receptionist", "foh@example.com", "Fay Host"),
        "cook": login(hospital_id, "kitchen", "cook@example.com", "Kit Cook"),
    }
    assert _settings(t["owner"]).status_code == 200
    return t


def _settings(h, **over):
    body = {"shift_start": "09:00", "shift_end": "17:00", "late_grace_minutes": 10, **over}
    return client.post("/api/portal/attendance/settings", headers=h, json=body)


def _in(h, clock, when, **body):
    clock.now = ist(*when)
    return client.post("/api/portal/attendance/check-in", headers=h, json=body)


def _out(h, clock, when):
    clock.now = ist(*when)
    return client.post("/api/portal/attendance/check-out", headers=h, json={})


def _row(email, work_date):
    staff = db.get_staff_user_by_email(email)
    return get_connection().execute(
        "SELECT * FROM staff_attendance WHERE staff_id = ? AND work_date = ?", (staff["id"], work_date)).fetchone()


# ---------------------------------------------------------------- late, on time, overtime

def test_arrival_within_the_grace_is_on_time_and_after_it_is_late(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    on_time = _in(team["cook"], clock, (*MON, 9, 10, 59))
    late = _in(team["foh"], clock, (*MON, 9, 11, 0))
    assert on_time.status_code == 201 and late.status_code == 201
    assert on_time.json()["record"]["status"] == "on_time" and on_time.json()["record"]["late_minutes"] == 0
    assert late.json()["record"]["status"] == "late" and late.json()["record"]["late_minutes"] == 11

    row = _row("foh@example.com", "2026-09-21")  # verified in the database, not just the response
    assert row["status"] == "late" and row["late_minutes"] == 11 and row["check_in_method"] == "unrestricted"
    assert row["check_in_at"] == "2026-09-21T03:41:00+00:00"  # 09:11 IST stored as UTC


def test_a_persons_own_shift_beats_the_restaurants(hospital_id, team, monkeypatch):
    make_staff(hospital_id, "receptionist", "late.shift@example.com", "Lena Late", shift_start="11:00", shift_end="19:00", working_days="Mon")
    h = login_existing("late.shift@example.com")
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    assert _in(h, clock, (*MON, 11, 5)).json()["record"]["status"] == "on_time"   # 11:05 vs an 11:00 shift
    assert _in(team["cook"], clock, (*MON, 11, 5)).json()["record"]["status"] == "late"  # 11:05 vs the 09:00 default


def login_existing(email):
    from tests.hr_helpers import headers_for
    return headers_for(email)


def test_with_no_shift_configured_nobody_is_late_and_there_is_no_overtime(hospital_id, team, monkeypatch):
    _settings(team["owner"], shift_start=None, shift_end=None)
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    assert _in(team["cook"], clock, (*MON, 15, 0)).json()["record"]["status"] == "on_time"
    out = _out(team["cook"], clock, (*MON, 23, 0))
    assert out.json()["record"]["working_minutes"] == 480 and out.json()["record"]["overtime_minutes"] == 0


def test_working_time_and_overtime_after_a_break(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    _in(team["cook"], clock, (*MON, 9, 5))
    clock.now = ist(*MON, 12, 0)
    assert client.post("/api/portal/attendance/break/start", headers=team["cook"]).status_code == 200
    clock.now = ist(*MON, 12, 30)
    ended = client.post("/api/portal/attendance/break/end", headers=team["cook"])
    assert ended.json()["record"]["break_minutes"] == 30 and ended.json()["record"]["break_started_at"] is None

    out = _out(team["cook"], clock, (*MON, 18, 35)).json()["record"]   # 9h30 on site - 30m break = 540; shift is 480
    assert out["working_minutes"] == 540 and out["overtime_minutes"] == 60 and out["check_out_local"] == "18:35"
    row = _row("cook@example.com", "2026-09-21")
    assert (row["working_minutes"], row["overtime_minutes"], row["break_minutes"]) == (540, 60, 30)
    assert row["check_out_at"] == "2026-09-21T13:05:00+00:00"


def test_leaving_early_is_not_overtime_and_leaving_during_a_break_ends_it(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    _in(team["cook"], clock, (*MON, 9, 0))
    clock.now = ist(*MON, 13, 0)
    client.post("/api/portal/attendance/break/start", headers=team["cook"])
    out = _out(team["cook"], clock, (*MON, 13, 20)).json()["record"]  # 4h20 on site, 20m of it on the break still open
    assert out["break_minutes"] == 20 and out["working_minutes"] == 240 and out["overtime_minutes"] == 0
    assert out["break_started_at"] is None


def test_an_overnight_shift_is_filed_under_the_day_it_started(hospital_id, team, monkeypatch):
    make_staff(hospital_id, "kitchen", "night@example.com", "Nina Night", shift_start="22:00", shift_end="02:00", working_days="Mon")
    h = login_existing("night@example.com")
    clock = freeze(monkeypatch, ist(*MON, 21, 0))
    assert _in(h, clock, (*MON, 22, 5)).json()["record"]["work_date"] == "2026-09-21"
    out = _out(h, clock, (*TUE, 2, 10))  # after midnight, next calendar day
    assert out.status_code == 200 and out.json()["record"]["working_minutes"] == 245 and out.json()["record"]["overtime_minutes"] == 5
    assert _row("night@example.com", "2026-09-21") is not None and _row("night@example.com", "2026-09-22") is None


def test_the_work_date_is_the_restaurants_local_date_not_the_servers(hospital_id, team, monkeypatch):
    """00:10 IST on the 21st is still the 20th in UTC."""
    clock = freeze(monkeypatch, ist(*MON, 0, 5))
    rec = _in(team["cook"], clock, (*MON, 0, 10)).json()["record"]
    assert rec["work_date"] == "2026-09-21" and rec["check_in_at"] == "2026-09-20T18:40:00+00:00"


# ---------------------------------------------------------------- refusals

def test_clocking_state_errors(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    cook = team["cook"]
    assert _out(cook, clock, (*MON, 9, 0)).status_code == 409                      # not clocked in
    assert client.post("/api/portal/attendance/break/start", headers=cook).status_code == 409
    assert client.post("/api/portal/attendance/break/end", headers=cook).status_code == 409
    assert _in(cook, clock, (*MON, 9, 0)).status_code == 201
    again = _in(cook, clock, (*MON, 9, 30))
    assert again.status_code == 409 and "already clocked in" in again.json()["error"]
    assert client.post("/api/portal/attendance/break/end", headers=cook).status_code == 409  # not on a break
    assert client.post("/api/portal/attendance/break/start", headers=cook).status_code == 200
    assert client.post("/api/portal/attendance/break/start", headers=cook).status_code == 409  # already on one
    assert _out(cook, clock, (*MON, 17, 0)).status_code == 200
    back = _in(cook, clock, (*MON, 18, 0))
    assert back.status_code == 409 and "already clocked in and out today" in back.json()["error"]
    assert get_connection().execute("SELECT COUNT(*) AS c FROM staff_attendance WHERE hospital_id = ?", (hospital_id,)).fetchone()["c"] == 1


# ---------------------------------------------------------------- the location check

def _set_place(owner, **over):
    body = {**HERE, "radius_meters": 100, **over}
    resp = _settings(owner, **body)
    assert resp.status_code == 200, resp.text


def test_gps_inside_the_radius_passes_and_outside_is_refused_with_the_distance(hospital_id, team, monkeypatch):
    _set_place(team["owner"])
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    far = _in(team["cook"], clock, (*MON, 9, 0), latitude=12.9800, longitude=77.5946)
    assert far.status_code == 403 and "m from the restaurant" in far.json()["error"] and "limit is 100 m" in far.json()["error"]
    assert _row("cook@example.com", "2026-09-21") is None  # nothing was recorded
    near = _in(team["cook"], clock, (*MON, 9, 1), latitude=12.9718, longitude=77.5946)
    assert near.status_code == 201 and near.json()["record"]["check_in_method"] == "gps"
    assert _row("cook@example.com", "2026-09-21")["check_in_lat"] == pytest.approx(12.9718)


def test_a_refusal_when_location_was_not_shared_and_invalid_coordinates(hospital_id, team, monkeypatch):
    _set_place(team["owner"])
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    none = _in(team["cook"], clock, (*MON, 9, 0))
    assert none.status_code == 403 and "wasn't shared" in none.json()["error"]
    assert _in(team["cook"], clock, (*MON, 9, 0), latitude=95, longitude=10).status_code == 400


def test_the_network_rule_lets_you_in_without_gps(hospital_id, team, monkeypatch):
    _settings(team["owner"], allowed_ips=["203.0.113.7", "198.51.100.0/24"])
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    clock.now = ist(*MON, 9, 0)
    blocked = client.post("/api/portal/attendance/check-in", headers=team["cook"], json={}, )
    assert blocked.status_code == 403 and "network" in blocked.json()["error"]
    ok = client.post("/api/portal/attendance/check-in", headers={**team["cook"], "X-Forwarded-For": "198.51.100.44, 10.0.0.1"}, json={})
    assert ok.status_code == 201 and ok.json()["record"]["check_in_method"] == "ip"
    assert _row("cook@example.com", "2026-09-21")["check_in_ip"] == "198.51.100.44"


def test_either_rule_passing_is_enough_and_no_rule_means_open(hospital_id, team, monkeypatch):
    _set_place(team["owner"], allowed_ips=["203.0.113.7"])
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    clock.now = ist(*MON, 9, 0)
    by_ip = client.post("/api/portal/attendance/check-in", headers={**team["cook"], "X-Forwarded-For": "203.0.113.7"}, json={"latitude": 1, "longitude": 1})
    assert by_ip.status_code == 201 and by_ip.json()["record"]["check_in_method"] == "ip"  # GPS far away, network right
    by_gps = client.post("/api/portal/attendance/check-in", headers={**team["foh"], "X-Forwarded-For": "9.9.9.9"}, json=HERE)
    assert by_gps.status_code == 201 and by_gps.json()["record"]["check_in_method"] == "gps"

    _settings(team["owner"], latitude=None, longitude=None, radius_meters=None, allowed_ips=[])
    open_door = client.post("/api/portal/attendance/check-in", headers=team["owner"], json={})
    assert open_door.status_code == 201 and open_door.json()["record"]["check_in_method"] == "unrestricted"


def test_today_tells_the_page_what_it_needs(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    today = client.get("/api/portal/attendance/today", headers=team["cook"]).json()
    assert today["state"] == "not_in" and today["record"] is None and today["location_required"] is False
    assert today["shift"] == {"start": "09:00", "end": "17:00", "source": "restaurant"} and today["grace_minutes"] == 10
    _set_place(team["owner"])
    assert client.get("/api/portal/attendance/today", headers=team["cook"]).json()["location_required"] is True
    _in(team["cook"], clock, (*MON, 9, 0), **HERE)
    assert client.get("/api/portal/attendance/today", headers=team["cook"]).json()["state"] == "in"
    client.post("/api/portal/attendance/break/start", headers=team["cook"])
    assert client.get("/api/portal/attendance/today", headers=team["cook"]).json()["state"] == "on_break"
    client.post("/api/portal/attendance/break/end", headers=team["cook"])
    _out(team["cook"], clock, (*MON, 17, 0))
    done = client.get("/api/portal/attendance/today", headers=team["cook"]).json()
    assert done["state"] == "out" and done["record"]["working_minutes"] == 480


# ---------------------------------------------------------------- history

def test_my_history_and_totals_cover_only_me(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    _in(team["cook"], clock, (*MON, 9, 0)); _out(team["cook"], clock, (*MON, 18, 0))     # 9h, 60 over
    _in(team["cook"], clock, (*TUE, 9, 30)); _out(team["cook"], clock, (*TUE, 17, 30))   # late, 8h
    _in(team["foh"], clock, (*MON, 9, 0))
    clock.now = ist(*TUE, 18, 0)  # "today" is Tuesday evening
    hist = client.get("/api/portal/attendance/history?days=30", headers=team["cook"]).json()
    assert [r["work_date"] for r in hist["records"]] == ["2026-09-22", "2026-09-21"]  # newest first
    assert hist["stats"] == {"days_present": 2, "late_days": 1, "total_working_minutes": 1020, "average_working_minutes": 510,
                             "total_overtime_minutes": 60, "missing_clock_outs": 0}
    assert client.get("/api/portal/attendance/history?days=1", headers=team["cook"]).json()["records"][0]["work_date"] == "2026-09-22"


# ---------------------------------------------------------------- forgotten clock-outs and corrections

def test_a_forgotten_clock_out_is_flagged_and_does_not_block_the_next_day(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    _in(team["cook"], clock, (*MON, 9, 0))                                   # ...and never clocks out
    tue = _in(team["cook"], clock, (*TUE, 9, 5))                             # next morning: 24h later, allowed
    assert tue.status_code == 201
    hist = client.get("/api/portal/attendance/history", headers=team["cook"]).json()
    assert hist["stats"]["missing_clock_outs"] == 1
    assert [r["missing_clock_out"] for r in hist["records"]] == [False, True]
    day = client.get("/api/portal/attendance/overview?date=2026-09-21", headers=team["owner"]).json()
    assert next(r for r in day["rows"] if r["name"] == "Kit Cook")["state"] == "missing_clock_out"


def test_a_manager_corrects_a_forgotten_clock_out(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    rec = _in(team["cook"], clock, (*MON, 9, 0)).json()["record"]
    clock.now = ist(*TUE, 10, 0)

    def fix(h, **body):
        return client.post(f"/api/portal/attendance/{rec['id']}/correct", headers=h, json=body)

    assert fix(team["owner"], check_out_time="17:30", note="").status_code == 400            # a reason is required
    assert fix(team["owner"], check_out_time="5pm", note="Forgot to clock out").status_code == 400
    ok = fix(team["owner"], check_out_time="17:30", note="Forgot to clock out")
    assert ok.status_code == 200 and ok.json()["record"]["corrected"] is True
    assert ok.json()["record"]["working_minutes"] == 510 and ok.json()["record"]["overtime_minutes"] == 30
    assert fix(team["owner"], check_out_time="18:00", note="Again").status_code == 409       # only a missing one can be corrected

    row = _row("cook@example.com", "2026-09-21")
    assert row["check_out_at"] == "2026-09-21T12:00:00+00:00" and row["correction_note"] == "Forgot to clock out"
    assert row["corrected_by"] == db.get_staff_user_by_email("owner@example.com")["id"]
    told = client.get("/api/portal/notifications", headers=team["cook"]).json()["notifications"][0]
    assert told["title"] == "Your clock-out was corrected" and "17:30" in told["body"]
    assert "attendance.correct_clock_out" in client.get("/api/portal/audit-log", headers=team["owner"]).text


def test_a_correction_cannot_be_in_the_future_and_after_midnight_means_the_next_day(hospital_id, team, monkeypatch):
    make_staff(hospital_id, "kitchen", "night@example.com", "Nina Night", shift_start="22:00", shift_end="02:00", working_days="Mon")
    night = login_existing("night@example.com")
    clock = freeze(monkeypatch, ist(*MON, 21, 0))
    rec = _in(night, clock, (*MON, 22, 0)).json()["record"]
    clock.now = ist(*MON, 23, 0)
    future_fix = client.post(f"/api/portal/attendance/{rec['id']}/correct", headers=team["owner"], json={"check_out_time": "23:30", "note": "too soon"})
    assert future_fix.status_code == 400 and "future" in future_fix.json()["error"]
    clock.now = ist(*TUE, 9, 0)
    ok = client.post(f"/api/portal/attendance/{rec['id']}/correct", headers=team["owner"], json={"check_out_time": "02:00", "note": "left after midnight"})
    assert ok.status_code == 200 and ok.json()["record"]["working_minutes"] == 240
    assert _row("night@example.com", "2026-09-21")["check_out_at"] == "2026-09-21T20:30:00+00:00"  # 02:00 IST on the 22nd


def test_only_managers_can_correct_and_unknown_records_are_404(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    rec = _in(team["cook"], clock, (*MON, 9, 0)).json()["record"]
    body = {"check_out_time": "17:00", "note": "please fix"}
    for who in ("foh", "cook"):
        assert client.post(f"/api/portal/attendance/{rec['id']}/correct", headers=team[who], json=body).status_code == 403
    assert client.post("/api/portal/attendance/99999/correct", headers=team["owner"], json=body).status_code == 404
    assert _row("cook@example.com", "2026-09-21")["check_out_at"] is None


# ---------------------------------------------------------------- the team overview

def _pattern(hospital_id, email, name, days, **shift):
    make_staff(hospital_id, "receptionist", email, name, working_days=days, **shift)


def test_the_overview_classifies_everyone(hospital_id, team, monkeypatch):
    _pattern(hospital_id, "punctual@example.com", "Pia Punctual", "Mon,Tue,Wed,Thu,Fri")
    _pattern(hospital_id, "tardy@example.com", "Tom Tardy", "Mon,Tue,Wed,Thu,Fri")
    _pattern(hospital_id, "absent@example.com", "Abe Absent", "Mon,Tue,Wed,Thu,Fri")
    _pattern(hospital_id, "away@example.com", "Ava Away", "Mon,Tue,Wed,Thu,Fri")
    _pattern(hospital_id, "weekend@example.com", "Wes Weekend", "Sat,Sun")
    away = db.get_staff_user_by_email("away@example.com")
    leave = db.create_leave_request(hospital_id, away["id"], "sick", "2026-09-21", "2026-09-21", False, "Flu")
    db.decide_leave_request(hospital_id, leave["id"], "approved", db.get_staff_user_by_email("owner@example.com")["id"], None)
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    for email, when_in in (("punctual@example.com", (9, 0)), ("tardy@example.com", (9, 40))):
        h = login_existing(email)
        _in(h, clock, (*MON, *when_in)); _out(h, clock, (*MON, 17, 5))

    clock.now = ist(*TUE, 8, 0)  # the next morning: Monday is history
    mon = client.get("/api/portal/attendance/overview?date=2026-09-21", headers=team["owner"]).json()
    states = {r["name"]: r["state"] for r in mon["rows"]}
    assert states["Pia Punctual"] == "on_time" and states["Tom Tardy"] == "late"
    assert states["Abe Absent"] == "absent"          # scheduled, no clock-in, no leave
    assert states["Ava Away"] == "on_leave"          # approved leave beats absent
    assert states["Wes Weekend"] == "off"            # not scheduled on a Monday
    assert states["Olive Owner"] == "off" and states["Kit Cook"] == "off"  # no working pattern set -> never absent
    tardy = next(r for r in mon["rows"] if r["name"] == "Tom Tardy")
    assert tardy["record"]["late_minutes"] == 40 and tardy["shift_start"] == "09:00" and mon["is_today"] is False
    assert mon["counts"]["absent"] == 1 and mon["counts"]["on_leave"] == 1


def test_today_is_not_in_only_after_the_grace_has_passed(hospital_id, team, monkeypatch):
    _pattern(hospital_id, "slow@example.com", "Sid Slow", "Mon")
    clock = freeze(monkeypatch, ist(*MON, 8, 30))
    state = lambda: next(r["state"] for r in client.get("/api/portal/attendance/overview", headers=team["owner"]).json()["rows"] if r["name"] == "Sid Slow")
    assert state() == "upcoming"
    clock.now = ist(*MON, 9, 10)
    assert state() == "upcoming"      # still inside the grace
    clock.now = ist(*MON, 9, 41)
    assert state() == "not_in"        # scheduled, 09:00 + 10m has passed, nobody yet
    clock.now = ist(*MON, 9, 45)
    _in(login_existing("slow@example.com"), clock, (*MON, 9, 45))
    assert state() == "clocked_in"
    fut = client.get("/api/portal/attendance/overview?date=2026-09-28", headers=team["owner"]).json()
    assert next(r["state"] for r in fut["rows"] if r["name"] == "Sid Slow") == "upcoming"  # next Monday


def test_the_monthly_summary_counts_days(hospital_id, team, monkeypatch):
    _pattern(hospital_id, "sam@example.com", "Sam Summary", "Mon,Tue,Wed")
    sam = db.get_staff_user_by_email("sam@example.com")
    sam_h = login_existing("sam@example.com")
    clock = freeze(monkeypatch, ist(2026, 9, 7, 8, 0))
    # Scheduled Mon/Tue/Wed. Present: Mon 7th (8h), Tue 8th (late, 7h30), Tue 15th (9h). Leave: Mon 14th.
    # Absent: Tue 1st, Wed 2nd, Wed 9th, Wed 16th.
    _in(sam_h, clock, (2026, 9, 7, 9, 0)); _out(sam_h, clock, (2026, 9, 7, 17, 0))
    _in(sam_h, clock, (2026, 9, 8, 9, 30)); _out(sam_h, clock, (2026, 9, 8, 17, 0))
    leave = db.create_leave_request(hospital_id, sam["id"], "casual", "2026-09-14", "2026-09-14", False, "Errand")
    db.decide_leave_request(hospital_id, leave["id"], "approved", db.get_staff_user_by_email("owner@example.com")["id"], None)
    _in(sam_h, clock, (2026, 9, 15, 9, 0)); _out(sam_h, clock, (2026, 9, 15, 18, 0))
    clock.now = ist(2026, 9, 17, 12, 0)  # Thursday the 17th
    summary = client.get("/api/portal/attendance/summary?month=2026-09", headers=team["owner"]).json()
    row = next(r for r in summary["rows"] if r["name"] == "Sam Summary")
    assert (row["present_days"], row["late_days"], row["absent_days"], row["leave_days"]) == (3, 1, 4, 1)
    assert row["working_minutes"] == 480 + 450 + 540 and row["overtime_minutes"] == 60 and row["missing_clock_outs"] == 0
    assert client.get("/api/portal/attendance/summary?month=garbage", headers=team["owner"]).status_code == 400
    assert client.get("/api/portal/attendance/overview?date=garbage", headers=team["owner"]).status_code == 400


# ---------------------------------------------------------------- settings

def test_settings_roundtrip_validation_and_audit(hospital_id, team):
    owner = team["owner"]
    saved = _settings(owner, latitude=12.9716, longitude=77.5946, radius_meters=150, allowed_ips=["203.0.113.7", " 198.51.100.0/24 "], late_grace_minutes=5)
    assert saved.status_code == 200 and saved.json()["allowed_ips"] == ["203.0.113.7", "198.51.100.0/24"]
    assert client.get("/api/portal/attendance/settings", headers=owner).json() == saved.json()

    bad = [
        (dict(shift_start="09:00", shift_end=None), "both a shift start and a shift end"),
        (dict(shift_start="9am", shift_end="17:00"), "time like 09:00"),
        (dict(shift_start="09:00", shift_end="09:00"), "can't be the same"),
        (dict(late_grace_minutes=500), "between 0 and 240"),
        (dict(latitude=12.9, longitude=None, radius_meters=100), "together"),
        (dict(latitude=95, longitude=10, radius_meters=100), "isn't valid"),
        (dict(latitude=12.9, longitude=77.5, radius_meters=5), "between 10 m"),
        (dict(allowed_ips=["300.1.1.1", "203.0.113.7"]), "300.1.1.1"),
    ]
    for over, expect in bad:
        resp = _settings(owner, **over)
        assert resp.status_code == 400 and expect in resp.json()["error"], (over, resp.json())
    assert client.get("/api/portal/attendance/settings", headers=owner).json() == saved.json()  # bad saves changed nothing
    assert "attendance.update_settings" in client.get("/api/portal/audit-log", headers=owner).text


def test_the_working_pattern_is_set_through_the_staff_api(hospital_id, team):
    owner = team["owner"]
    made = client.post("/api/portal/staff", headers=owner, json={
        "name": "Pat Pattern", "email": "pat@example.com", "password": "hunter2hunter2", "role": "kitchen",
        "working_days": ["Fri", "Mon", "Tue"], "shift_start": "10:00", "shift_end": "18:30"})
    assert made.status_code == 201, made.text
    assert made.json()["working_days"] == ["Mon", "Tue", "Fri"] and made.json()["shift_start"] == "10:00"
    sid = made.json()["id"]
    cleared = client.patch(f"/api/portal/staff/{sid}", headers=owner, json={"working_days": [], "shift_start": None, "shift_end": None})
    assert cleared.status_code == 200 and cleared.json()["working_days"] == [] and cleared.json()["shift_start"] is None
    for body, expect in (
        ({"working_days": ["Mon", "Funday"]}, "Mon..Sun"),
        ({"shift_start": "10:00"}, "both a shift start"),
        ({"shift_start": "10:00", "shift_end": "10:00"}, "same time"),
        ({"shift_start": "25:00", "shift_end": "18:00"}, "time like 09:00"),
    ):
        resp = client.patch(f"/api/portal/staff/{sid}", headers=owner, json=body)
        assert resp.status_code == 400 and expect in resp.json()["error"], (body, resp.json())


# ---------------------------------------------------------------- permissions

def test_everyone_clocks_in_but_only_owners_see_the_team_and_the_rules(hospital_id, team, monkeypatch):
    clock = freeze(monkeypatch, ist(*MON, 8, 0))
    for who, when in (("owner", (9, 0)), ("foh", (9, 1)), ("cook", (9, 2))):
        assert _in(team[who], clock, (*MON, *when)).status_code == 201, who   # Owners clock in too
        assert client.get("/api/portal/attendance/today", headers=team[who]).status_code == 200
        assert client.get("/api/portal/attendance/history", headers=team[who]).status_code == 200
    for who in ("foh", "cook"):
        h = team[who]
        for path in ("/api/portal/attendance/overview", "/api/portal/attendance/summary", "/api/portal/attendance/settings"):
            assert client.get(path, headers=h).status_code == 403, (who, path)
        assert client.post("/api/portal/attendance/settings", headers=h, json={"shift_start": "01:00", "shift_end": "02:00"}).status_code == 403
    assert client.get("/api/portal/attendance/settings", headers=team["owner"]).json()["shift_start"] == "09:00"  # untouched
    for path in ("/api/portal/attendance/overview", "/api/portal/attendance/summary", "/api/portal/attendance/settings"):
        assert client.get(path, headers=team["owner"]).status_code == 200


def test_the_grid_can_grant_the_team_view_to_front_of_house(hospital_id, team):
    assert client.get("/api/portal/attendance/overview", headers=team["foh"]).status_code == 403
    client.put("/api/portal/roles/permissions", headers=team["owner"], json={"updates": [
        {"role": "receptionist", "page_key": "attendance", "can_view": True, "can_write": False, "can_delete": False}]})
    assert client.get("/api/portal/attendance/overview", headers=team["foh"]).status_code == 200
    assert client.post("/api/portal/attendance/1/correct", headers=team["foh"], json={"check_out_time": "17:00", "note": "abc"}).status_code == 403  # view is not write
    assert client.get("/api/portal/attendance/settings", headers=team["foh"]).status_code == 403


def test_days_before_someone_joined_are_never_absent(hospital_id, team, monkeypatch):
    make_staff(hospital_id, "receptionist", "newbie@example.com", "Nell Newbie", joined="2026-09-14", working_days="Mon,Tue,Wed")
    clock = freeze(monkeypatch, ist(2026, 9, 17, 12, 0))
    summary = client.get("/api/portal/attendance/summary?month=2026-09", headers=team["owner"]).json()
    row = next(r for r in summary["rows"] if r["name"] == "Nell Newbie")
    assert row["absent_days"] == 3  # Mon 14th (the day they joined), Tue 15th, Wed 16th -- nothing from before that
    before = client.get("/api/portal/attendance/overview?date=2026-09-08", headers=team["owner"]).json()
    assert next(r["state"] for r in before["rows"] if r["name"] == "Nell Newbie") == "off"  # before they joined
