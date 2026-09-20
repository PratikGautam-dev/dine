# tests/test_attendance_rules.py
"""The pure attendance rules: location check, lateness, working/overtime minutes, the working pattern.
No database, no clock -- fixed times, exact expectations."""
from datetime import date, datetime, timezone

import pytest
import pytz

from portal import attendance_rules as r

IST = pytz.timezone("Asia/Kolkata")
SETTINGS = {"shift_start": "09:00", "shift_end": "17:00", "late_grace_minutes": 10, "latitude": None, "longitude": None,
            "radius_meters": None, "allowed_ips": None}


def at(h, m, s=0):
    return IST.localize(datetime(2026, 9, 21, h, m, s))


# ---------------------------------------------------------------- lateness

@pytest.mark.parametrize("h,m,s,status,late", [
    (8, 50, 0, "on_time", 0), (9, 0, 0, "on_time", 0), (9, 10, 0, "on_time", 0),    # up to start + grace, inclusive
    (9, 10, 59, "on_time", 0),                                                      # still inside the 10th minute
    (9, 11, 0, "late", 11), (9, 45, 30, "late", 45), (12, 0, 0, "late", 180),       # counted from the shift START
])
def test_lateness_uses_the_shift_start_plus_grace(h, m, s, status, late):
    assert r.compute_lateness(at(h, m, s), "09:00", 10) == (status, late)


def test_no_grace_and_no_shift():
    assert r.compute_lateness(at(9, 1), "09:00", 0) == ("late", 1)
    assert r.compute_lateness(at(23, 0), None, 10) == ("on_time", 0)  # no shift known -> never late


def test_a_night_shift_start_is_judged_on_the_clock_in_date():
    late_night = IST.localize(datetime(2026, 9, 21, 22, 20))
    assert r.compute_lateness(late_night, "22:00", 10) == ("late", 20)


# ---------------------------------------------------------------- working time and overtime

def test_worked_minutes_subtract_breaks_and_overtime_is_beyond_the_shift():
    scheduled = r.scheduled_minutes("09:00", "17:00")
    assert scheduled == 480
    cin, cout = "2026-09-21T03:30:00+00:00", "2026-09-21T13:30:00+00:00"  # 10 h
    assert r.compute_worked(cin, cout, 30, scheduled) == (570, 90)         # 10h - 30m break = 570; 90 over
    assert r.compute_worked(cin, "2026-09-21T11:30:00+00:00", 0, scheduled) == (480, 0)  # exactly the shift
    assert r.compute_worked(cin, "2026-09-21T09:30:00+00:00", 0, scheduled) == (360, 0)  # left early: no overtime
    assert r.compute_worked(cin, cout, 0, None) == (600, 0)               # no shift -> no overtime
    assert r.compute_worked(cin, cin, 45, scheduled) == (0, 0)             # never negative


def test_a_shift_that_runs_past_midnight():
    assert r.scheduled_minutes("22:00", "02:00") == 240
    assert r.scheduled_minutes("09:00", "09:00") is None
    assert r.scheduled_minutes(None, "17:00") is None


# ---------------------------------------------------------------- the working pattern

def test_expected_shift_prefers_the_persons_own_pattern():
    assert r.expected_shift({}, SETTINGS) == ("09:00", "17:00")
    assert r.expected_shift({"shift_start": "11:00", "shift_end": "20:00"}, SETTINGS) == ("11:00", "20:00")
    assert r.expected_shift({"shift_start": "11:00"}, SETTINGS) == ("09:00", "17:00")  # half a pattern is ignored
    assert r.expected_shift({}, {"shift_start": None, "shift_end": None}) == (None, None)


def test_is_scheduled_only_on_the_working_days():
    staff = {"working_days": "Mon,Tue,Fri"}
    assert r.is_scheduled(staff, date(2026, 9, 21))       # Monday
    assert not r.is_scheduled(staff, date(2026, 9, 23))   # Wednesday
    assert not r.is_scheduled({"working_days": None}, date(2026, 9, 21))  # no pattern -> never due


# ---------------------------------------------------------------- location

HERE = {"latitude": 12.9716, "longitude": 77.5946, "radius_meters": 100, "allowed_ips": None}


def test_haversine_is_close_to_known_distances():
    assert r.haversine_m(12.9716, 77.5946, 12.9716, 77.5946) == 0
    one_degree_lat = r.haversine_m(0, 0, 1, 0)
    assert 111_000 < one_degree_lat < 111_400


def test_location_unrestricted_when_nothing_is_configured():
    res = r.check_location({"latitude": None, "longitude": None, "radius_meters": None, "allowed_ips": None}, None, None, None)
    assert res.ok and res.method == "unrestricted"


def test_gps_inside_and_outside_the_radius():
    inside = r.check_location(HERE, 12.9718, 77.5946, "1.2.3.4")   # ~22 m
    assert inside.ok and inside.method == "gps"
    outside = r.check_location(HERE, 12.9800, 77.5946, "1.2.3.4")  # ~930 m
    assert not outside.ok and "m from the restaurant" in outside.message and "limit is 100 m" in outside.message


def test_gps_configured_but_no_coordinates_shared():
    res = r.check_location(HERE, None, None, None)
    assert not res.ok and "wasn't shared" in res.message


def test_ip_rule_with_addresses_and_ranges():
    s = {"latitude": None, "longitude": None, "radius_meters": None, "allowed_ips": "203.0.113.7, 198.51.100.0/24"}
    assert r.check_location(s, None, None, "203.0.113.7").method == "ip"
    assert r.check_location(s, None, None, "198.51.100.200").ok
    bad = r.check_location(s, None, None, "198.51.101.1")
    assert not bad.ok and "network" in bad.message
    assert not r.check_location(s, None, None, None).ok and not r.check_location(s, None, None, "not-an-ip").ok


def test_either_check_passing_is_enough_and_both_failing_says_why():
    both = {**HERE, "allowed_ips": "203.0.113.7"}
    assert r.check_location(both, None, None, "203.0.113.7").method == "ip"        # GPS missing, IP fine
    assert r.check_location(both, 12.9718, 77.5946, "9.9.9.9").method == "gps"     # IP wrong, GPS fine
    failed = r.check_location(both, 12.9800, 77.5946, "9.9.9.9")
    assert not failed.ok and "m from the restaurant" in failed.message and "network" in failed.message


def test_ip_validation_helpers():
    assert r.valid_ip_or_cidr("10.0.0.0/8") and r.valid_ip_or_cidr("2001:db8::1") and not r.valid_ip_or_cidr("300.1.1.1")
    assert r.parse_ip_list("1.1.1.1,\n 2.2.2.2 ,, ") == ["1.1.1.1", "2.2.2.2"]


def test_to_local_converts_from_utc():
    assert r.to_local("2026-09-21T03:30:00+00:00", "Asia/Kolkata").strftime("%H:%M") == "09:00"
    assert r.to_local("2026-09-21T03:30:00+00:00", "Not/AZone").strftime("%H:%M") == "03:30"  # unknown zone -> UTC
