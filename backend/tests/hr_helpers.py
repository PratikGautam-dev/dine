# tests/hr_helpers.py
"""Shared helpers for the staff HR tests (leave, attendance): real staff logins per role, a frozen clock
for the attendance routes, and small builders. Nothing here mocks the app -- requests go through the real
routes with real tokens; only the clock the attendance routes read is replaced."""
import os
from datetime import date, datetime, timedelta, timezone
import pytz

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SUPER_ADMIN_JWT_SECRET", "test-super-admin-jwt-secret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from db.repositories.hospitals import hash_portal_password  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
PW = "hunter2hunter2"
ZONE = "Asia/Kolkata"  # UTC+05:30, no DST -- offsets in the tests are exact
IST = pytz.timezone(ZONE)


def set_timezone(hospital_id: int, zone: str = ZONE) -> None:
    conn = get_connection()
    conn.execute("UPDATE hospitals SET timezone = ? WHERE id = ?", (zone, hospital_id))
    conn.commit()


def make_staff(hospital_id: int, role: str, email: str, name: str | None = None, joined: str = "2026-01-01", **profile) -> dict:
    """A staff member who joined on `joined` (backdated, so absent-day counting isn't tied to today's date)."""
    staff = db.create_staff_user(hospital_id, role, email, hash_portal_password(PW), name or email.split("@")[0].title(), **profile)
    conn = get_connection()
    conn.execute("UPDATE identities SET created_at = ? WHERE id = ?", (f"{joined} 00:00:00+00", staff["id"]))
    conn.commit()
    return staff


def headers_for(email: str) -> dict:
    resp = client.post("/api/portal/staff/login", json={"email": email, "password": PW})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def login(hospital_id: int, role: str, email: str, name: str | None = None, **profile) -> dict:
    make_staff(hospital_id, role, email, name, **profile)
    return headers_for(email)


def ist(y: int, mo: int, d: int, hh: int = 0, mm: int = 0, ss: int = 0) -> datetime:
    """A wall-clock time in the restaurant (IST) as an aware UTC datetime -- what the clock returns."""
    return IST.localize(datetime(y, mo, d, hh, mm, ss)).astimezone(timezone.utc)


class FrozenClock:
    """The attendance routes' clock. `clock.now = ist(...)` moves time."""

    def __init__(self, now: datetime):
        self.now = now

    def __call__(self) -> datetime:
        return self.now


def freeze(monkeypatch, now: datetime) -> FrozenClock:
    clock = FrozenClock(now)
    monkeypatch.setattr("portal.routes.attendance._utcnow", clock)
    return clock


def future(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()
