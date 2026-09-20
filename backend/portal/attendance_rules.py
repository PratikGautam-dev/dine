# portal/attendance_rules.py
"""Pure attendance rules -- no database, no clock -- so every calculation is unit-testable with fixed
times: the location check, lateness, working/overtime minutes, and the weekly working pattern.

Times: a check-in/out is stored as UTC ISO text; lateness is judged in the RESTAURANT's own timezone
(and a record is filed under the restaurant's local date), so a night-shift check-in just before
midnight lands on the right day. The location check is a deterrent, not proof: browser GPS and
headers can be spoofed."""
import ipaddress
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

import pytz

WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_EARTH_RADIUS_M = 6_371_000.0


# ---------------------------------------------------------------- time helpers

def valid_hhmm(value: str | None) -> bool:
    return bool(value) and bool(_HHMM.match(value))


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def tz(name: str | None):
    """The restaurant's timezone (pytz, which bundles its own tz database -- the slim server image has
    none). An unknown/blank name falls back to UTC."""
    try:
        return pytz.timezone(name or "UTC")
    except Exception:
        return pytz.utc


def localize(zone, naive: datetime) -> datetime:
    """A naive wall-clock time in `zone` (DST-correct for pytz zones)."""
    return zone.localize(naive) if hasattr(zone, "localize") else naive.replace(tzinfo=zone)


def local_midnight(local_dt: datetime) -> datetime:
    """00:00 on the same local date as `local_dt`, in the same zone."""
    zone = tz(getattr(local_dt.tzinfo, "zone", None))
    return localize(zone, datetime.combine(local_dt.date(), time(0, 0)))


def local_time(local_dt: datetime, hhmm: str, extra_days: int = 0) -> datetime:
    """HH:MM on the same local date (plus `extra_days`) as `local_dt`."""
    zone = tz(getattr(local_dt.tzinfo, "zone", None))
    h, m = hhmm.split(":")
    return localize(zone, datetime.combine(local_dt.date() + timedelta(days=extra_days), time(int(h), int(m))))


def to_local(utc_iso: str, tz_name: str | None) -> datetime:
    """A stored UTC ISO string as a datetime in the restaurant's timezone."""
    dt = datetime.fromisoformat(utc_iso)
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    return dt.astimezone(tz(tz_name))


def weekday_abbr(d: date) -> str:
    return WEEKDAYS[d.weekday()]


def parse_days(csv: str | None) -> list[str]:
    return [d for d in (csv or "").split(",") if d in WEEKDAYS]


# ---------------------------------------------------------------- the working pattern

def expected_shift(staff: dict, settings: dict) -> tuple[str | None, str | None]:
    """(start, end) as HH:MM: the person's own pattern if they have both, else the restaurant's."""
    if valid_hhmm(staff.get("shift_start")) and valid_hhmm(staff.get("shift_end")):
        return staff["shift_start"], staff["shift_end"]
    if valid_hhmm(settings.get("shift_start")) and valid_hhmm(settings.get("shift_end")):
        return settings["shift_start"], settings["shift_end"]
    return None, None


def scheduled_minutes(start: str | None, end: str | None) -> int | None:
    """Length of the scheduled shift; an end at/before the start means it runs past midnight."""
    if not (valid_hhmm(start) and valid_hhmm(end)) or start == end:
        return None
    length = to_minutes(end) - to_minutes(start)
    return length if length > 0 else length + 24 * 60


def is_scheduled(staff: dict, d: date) -> bool:
    """Whether this person is due to work on `d`. No working days set => never 'due' (so never absent)."""
    return weekday_abbr(d) in parse_days(staff.get("working_days"))


# ---------------------------------------------------------------- lateness, working time, overtime

def compute_lateness(local_check_in: datetime, shift_start: str | None, grace_minutes: int) -> tuple[str, int]:
    """('on_time' | 'late', minutes past the shift start). Late means arriving (in whole minutes) after start + grace;
    the late minutes are counted from the shift start itself. No shift known => on time."""
    if not valid_hhmm(shift_start):
        return "on_time", 0
    start = local_midnight(local_check_in) + timedelta(minutes=to_minutes(shift_start))
    past = int(math.floor((local_check_in - start).total_seconds() / 60))  # whole minutes: 9:10:59 is still "9:10"
    if past > grace_minutes:
        return "late", past
    return "on_time", 0


def compute_worked(check_in_utc: str, check_out_utc: str, break_minutes: int, scheduled: int | None) -> tuple[int, int]:
    """(working_minutes, overtime_minutes): time between clock-in and clock-out minus breaks; overtime
    is whatever exceeds the scheduled shift length (0 when no shift is known)."""
    span = (datetime.fromisoformat(check_out_utc) - datetime.fromisoformat(check_in_utc)).total_seconds() / 60
    working = max(0, int(span) - max(0, break_minutes))
    overtime = max(0, working - scheduled) if scheduled else 0
    return working, overtime


# ---------------------------------------------------------------- the location check

def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def parse_ip_list(csv: str | None) -> list[str]:
    return [p.strip() for p in (csv or "").replace("\n", ",").split(",") if p.strip()]


def valid_ip_or_cidr(value: str) -> bool:
    try:
        ipaddress.ip_network(value, strict=False)
        return True
    except ValueError:
        return False


def ip_allowed(ip: str | None, allowed_csv: str | None) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for entry in parse_ip_list(allowed_csv):
        try:
            if addr in ipaddress.ip_network(entry, strict=False):
                return True
        except ValueError:
            continue
    return False


@dataclass
class LocationResult:
    ok: bool
    method: str  # 'gps' | 'ip' | 'unrestricted' (when ok)
    message: str = ""


def check_location(settings: dict, lat: float | None, lng: float | None, ip: str | None) -> LocationResult:
    """Passes when EITHER configured check passes (GPS within the radius, or the caller's IP on the
    allowed list). Neither configured => allowed ('unrestricted'). A refusal says why, including the
    measured distance."""
    gps_configured = None not in (settings.get("latitude"), settings.get("longitude"), settings.get("radius_meters"))
    ip_configured = bool(parse_ip_list(settings.get("allowed_ips")))
    if not gps_configured and not ip_configured:
        return LocationResult(True, "unrestricted")

    reasons: list[str] = []
    if gps_configured:
        if lat is None or lng is None:
            reasons.append("Your location wasn't shared -- allow location access and try again")
        else:
            distance = haversine_m(lat, lng, settings["latitude"], settings["longitude"])
            if distance <= settings["radius_meters"]:
                return LocationResult(True, "gps")
            reasons.append(f"You're {round(distance)} m from the restaurant (the limit is {settings['radius_meters']} m)")
    if ip_configured:
        if ip_allowed(ip, settings.get("allowed_ips")):
            return LocationResult(True, "ip")
        reasons.append("You're not on the restaurant's network")
    return LocationResult(False, "", ". ".join(reasons) + ".")
