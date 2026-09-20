# tests/test_portal_tenant_isolation.py
"""Cross-tenant isolation of the staff portal API -- the same two-restaurant rigor as
the doctor-login work.

Restaurant A's Owner/Manager (a real staff login with every capability) attacks every
portal route that takes a record id or lists tenant data, using Restaurant B's ids.
For each attack:

  1. the attack must be refused (or, for the bulk endpoints, act on nothing);
  2. Restaurant B's rows must be byte-for-byte unchanged afterwards;
  3. the *same request* made by B's own Manager must be accepted -- the control proving
     the request was well-formed, so a refusal in (1) really is tenant isolation and
     not a malformed request.

A second test checks that no list/read endpoint shows A anything of B's, and a third
that staff tokens and platform (super-admin) tokens are refused on each other's routes.
"""
import json
import os
from datetime import datetime, timedelta

import pytest

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
from portal.capabilities import ALL_CAPABILITIES  # noqa: E402

client = TestClient(app)
MARK = "ZZB"  # appears in every record that belongs to the victim restaurant
PHONE_B = "5491100000001"


def _manager(hospital_id: int, tag: str) -> dict:
    """A real Owner/Manager login for one restaurant, holding every tenant capability so
    that only tenant scoping (not a missing feature switch) can refuse a request."""
    conn = get_connection()
    conn.execute("UPDATE hospitals SET admin_capabilities = ? WHERE id = ?", (json.dumps(sorted(ALL_CAPABILITIES)), hospital_id))
    conn.commit()
    email = f"manager.{tag}@example.com"
    db.create_staff_user(hospital_id, "admin", email, hash_portal_password("hunter2hunter2"), f"{tag} Manager")
    resp = client.post("/api/portal/staff/login", json={"email": email, "password": "hunter2hunter2"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class Victim:
    """Factory for Restaurant B's records. Every record carries the MARK so a leak into
    Restaurant A's responses is detectable by a plain substring search."""

    def __init__(self, hid: int):
        self.hid = hid
        db.update_restaurant_hours(hid, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], ["11:00-23:00"], 90, 30)
        self.dept = db.create_department(hid, f"{MARK} Hall")
        self.table = db.create_table(hid, self.dept["id"], f"{MARK}-T1", 4)
        self.table2 = db.create_table(hid, self.dept["id"], f"{MARK}-T2", 4)
        self.doctor = db.create_doctor(hid, "t2_neurology", f"{MARK} Doctor", working_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], working_hours=["09:00-17:00"])
        self._slot = 0

    def table_slot(self, party=2):
        slots = db.get_available_table_slots(self.hid, party)
        self._slot += 1
        return slots[self._slot * 2]  # spaced out so each reservation gets its own

    def appt(self):
        slot = self.table_slot()
        return db.create_table_reservation(
            self.hid, PHONE_B, 2, datetime.fromisoformat(slot["id"]), patient_name=f"{MARK} Guest",
        ).id

    def past_appt(self):
        return self.appt()

    def patient(self):
        return db.create_patient_profile(self.hid, PHONE_B, f"{MARK} Patient", 40)["id"]

    def handoff(self):
        return db.create_handoff_request(self.hid, PHONE_B, "patient_requested", f"{MARK} help me")["id"]

    def doctor_slot(self):
        return db.get_slots(self.hid, self.doctor["id"])[3]

    def leave(self):
        self._leave_n = getattr(self, "_leave_n", 0) + 1
        day = (datetime.now() + timedelta(days=40 + self._leave_n)).date().isoformat()
        db.create_doctor_leave(self.hid, self.doctor["id"], day, f"{MARK} leave")
        return get_connection().execute(
            "SELECT id FROM doctor_leave WHERE hospital_id = ? AND doctor_id = ? AND date = ?", (self.hid, self.doctor["id"], day),
        ).fetchone()["id"]

    def procedure(self):
        return db.create_procedure(self.hid, "injection", f"{MARK} Proc", "instant", 30)["id"]

    def instruction(self):
        return db.create_instruction(self.hid, self.procedure(), "other", f"{MARK} instr")["id"]

    def resource(self):
        return db.create_procedure_resource(self.hid, "staff", f"{MARK} Res", working_days=["Mon"], working_hours=["09:00-12:00"])["id"]

    def menu_item(self):
        return db.create_menu_item(self.hid, f"{MARK} Dish", price_paise=5000, category="Mains")["id"]

    def order(self):
        item = self.menu_item()
        return db.create_food_order(self.hid, PHONE_B, [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="pay_at_restaurant")["id"]

    def staff(self):
        return db.create_staff_user(self.hid, "receptionist", f"zzb.{self._slot}.{id(object())}@example.com", hash_portal_password("hunter2hunter2"), f"{MARK} Staff")["id"]

    def leave_request(self):
        return db.create_leave_request(self.hid, self.staff(), "casual", "2031-05-05", "2031-05-06", False, f"{MARK} family event")["id"]

    def attendance_record(self):
        """A finished-in-the-past clock-in with no clock-out (a Manager could correct it)."""
        return db.create_check_in(
            self.hid, self.staff(), "2026-01-05", "2026-01-05T03:30:00+00:00", None, None, None, "unrestricted", "on_time", 0,
        )["id"]

    def appt_type(self):
        return db.get_all_appointment_types_for_hospital(self.hid)[0]["id"]


# (name, setup(v)->ctx, method, path(c), body(c)|None, check(resp)->bool|None, control_optional)
def _refused(resp):
    return resp.status_code >= 400


def _acted_on_nothing(key):
    def check(resp):
        return resp.status_code == 200 and resp.json().get(key) == []
    return check


def _no_slots(resp):
    if resp.status_code >= 400:
        return True
    body = resp.json()
    slots = body.get("slots", body) if isinstance(body, dict) else body
    return slots == [] or slots is None


def _cases():
    C = []

    def case(name, setup, method, path, body=None, check=_refused, control_optional=False):
        C.append((name, setup, method, path, body, check, control_optional))

    a = lambda v: {"a": v.appt()}
    # ---- reservations / bookings
    case("attendance", a, "POST", lambda c: f"/api/portal/bookings/{c['a']}/attendance", lambda c: {"attended": True}, control_optional=True)
    case("delete booking", a, "POST", lambda c: f"/api/portal/bookings/{c['a']}/delete", control_optional=True)
    case("bulk delete bookings", a, "POST", lambda c: "/api/portal/bookings/delete", lambda c: {"appointment_ids": [c["a"]]}, _acted_on_nothing("deleted"), control_optional=True)
    case("cancel booking", a, "POST", lambda c: f"/api/portal/bookings/{c['a']}/cancel", lambda c: {"reason": "hack"})
    case("reassign table", lambda v: {"a": v.appt(), "t": v.table2["id"]}, "POST", lambda c: f"/api/portal/bookings/{c['a']}/reassign-table", lambda c: {"table_id": c["t"]})
    case("reschedule booking", lambda v: {"a": v.appt(), "s": v.table_slot()["id"]}, "POST", lambda c: f"/api/portal/bookings/{c['a']}/reschedule", lambda c: {"slot_id": c["s"]})
    case("followup extend", a, "POST", lambda c: f"/api/portal/bookings/{c['a']}/followup/extend", lambda c: {"extra_days": 3}, control_optional=True)
    case("followup book", lambda v: {"a": v.appt(), "s": v.table_slot()["id"]}, "POST", lambda c: f"/api/portal/bookings/{c['a']}/followup/book", lambda c: {"scheduled_at": c["s"]}, control_optional=True)
    for action in ("procedure/approve", "procedure/reject", "procedure/reschedule-request/approve", "procedure/reschedule-request/reject"):
        case(action, a, "POST", (lambda act: lambda c: f"/api/portal/bookings/{c['a']}/{act}")(action), control_optional=True)
    case("procedure advance", a, "POST", lambda c: f"/api/portal/bookings/{c['a']}/procedure/advance-status", lambda c: {"status": "APPROVED"}, control_optional=True)
    case("new-booking with B's doctor", lambda v: {"d": v.dept["id"], "doc": v.doctor["id"], "s": v.doctor_slot()["id"]}, "POST", lambda c: "/api/portal/new-booking",
         lambda c: {"booking_type": "doctor", "department_id": "t2_neurology", "doctor_id": c["doc"], "slot_id": c["s"], "patient_name": "Attacker Guest", "patient_phone": "9876543210"}, control_optional=True)
    case("new-booking on B's table section", lambda v: {"d": v.dept["id"], "s": v.table_slot()["id"]}, "POST", lambda c: "/api/portal/new-booking",
         lambda c: {"booking_type": "table", "department_id": c["d"], "party_size": 2, "slot_id": c["s"], "patient_name": "Attacker Guest", "patient_phone": "9876543210"}, control_optional=True)
    case("table slots for B's section", lambda v: {"d": v.dept["id"]}, "GET", lambda c: f"/api/portal/new-booking/table-slots?party_size=2&department_id={c['d']}", None, _no_slots, control_optional=True)
    # ---- guests
    p = lambda v: {"p": v.patient()}
    case("read guest", p, "GET", lambda c: f"/api/portal/patients/{c['p']}")
    case("edit guest", p, "POST", lambda c: f"/api/portal/patients/{c['p']}", lambda c: {"name": "Hacked", "age": 9, "gender": "Other", "address": "hack"})
    case("guest status", p, "POST", lambda c: f"/api/portal/patients/{c['p']}/status", lambda c: {"status": "inactive"})
    case("bulk delete guests", p, "POST", lambda c: "/api/portal/patients/delete", lambda c: {"patient_ids": [c["p"]]}, _acted_on_nothing("deleted"))
    # ---- messages / handoffs
    h = lambda v: {"h": v.handoff()}
    case("read handoff messages", h, "GET", lambda c: f"/api/portal/handoffs/{c['h']}/messages")
    case("reply to handoff", h, "POST", lambda c: f"/api/portal/handoffs/{c['h']}/reply", lambda c: {"text": "hacked reply"}, control_optional=True)
    case("resolve handoff", h, "POST", lambda c: f"/api/portal/handoffs/{c['h']}/resolve")
    case("delete handoff", h, "POST", lambda c: f"/api/portal/handoffs/{c['h']}/delete")
    case("bulk resolve handoffs", h, "POST", lambda c: "/api/portal/handoffs/bulk-resolve", lambda c: {"handoff_ids": [c["h"]]}, _acted_on_nothing("resolved"))
    case("bulk delete handoffs", h, "POST", lambda c: "/api/portal/handoffs/bulk-delete", lambda c: {"handoff_ids": [c["h"]]}, _acted_on_nothing("deleted"))
    # ---- tables
    case("edit B's table", lambda v: {"t": v.table["id"]}, "PUT", lambda c: f"/api/portal/tables/{c['t']}", lambda c: {"name": "Hacked", "department_id": "cardiology", "capacity": 2, "is_active": False}, control_optional=True)
    case("create table under B's section", lambda v: {"d": v.dept["id"]}, "POST", lambda c: "/api/portal/tables", lambda c: {"name": "Sneaky", "department_id": c["d"], "capacity": 2})
    # ---- appointment types
    # Appointment-type ids ("new", "followup", ...) are per-restaurant keys, so A toggling "new" touches
    # A's OWN row. Nothing to refuse -- the assertion that matters is B's snapshot staying unchanged.
    case("toggle appointment type by B's key", lambda v: {"t": v.appt_type()}, "POST", lambda c: f"/api/portal/appointment-types/{c['t']}/active", lambda c: {"is_active": False}, lambda resp: True, control_optional=True)
    # ---- doctors / team
    d = lambda v: {"d": v.doctor["id"]}
    case("read doctor", d, "GET", lambda c: f"/api/portal/doctors/{c['d']}")
    case("edit doctor", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}", lambda c: {"department_id": "t2_neurology", "name": "Hacked Doctor", "working_days": ["Mon"], "working_hours": ["09:00-12:00"], "slot_duration_minutes": "30"}, control_optional=True)
    case("doctor active", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}/active", lambda c: {"is_active": False})
    case("doctor login creds", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}/login-credentials", lambda c: {"email": "sneaky@example.com", "password": "hunter2hunter2"})
    case("revoke doctor login", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}/login-credentials/revoke", control_optional=True)
    case("read doctor leave", d, "GET", lambda c: f"/api/portal/doctors/{c['d']}/leave")
    case("add doctor leave", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}/leave", lambda c: {"date": "2031-01-05", "reason": "hack"})
    case("add doctor leave range", d, "POST", lambda c: f"/api/portal/doctors/{c['d']}/leave/range", lambda c: {"from_date": "2031-02-01", "to_date": "2031-02-03", "reason": "hack"})
    case("delete doctor leave", lambda v: {"d": v.doctor["id"], "l": v.leave()}, "POST", lambda c: f"/api/portal/doctors/{c['d']}/leave/{c['l']}/delete")
    case("read doctor slots", d, "GET", lambda c: f"/api/portal/doctors/{c['d']}/slots")
    case("block doctor slot", lambda v: {"d": v.doctor["id"], "s": v.doctor_slot()["id"]}, "POST", lambda c: f"/api/portal/doctors/{c['d']}/slots/block", lambda c: {"scheduled_at": c["s"], "blocked": True, "reason": "hack"})
    case("add doctor slot", lambda v: {"d": v.doctor["id"], "s": v.doctor_slot()}, "POST", lambda c: f"/api/portal/doctors/{c['d']}/slots/add", lambda c: {"date": c["s"]["date"], "time": "23:30"}, control_optional=True)
    case("remove doctor slot", lambda v: {"d": v.doctor["id"], "s": v.doctor_slot()["id"]}, "POST", lambda c: f"/api/portal/doctors/{c['d']}/slots/remove", lambda c: {"scheduled_at": c["s"]}, control_optional=True)
    case("doctor's appointments today", d, "GET", lambda c: f"/api/portal/doctors/{c['d']}/appointments/today")
    case("create doctor in B's dept", lambda v: {}, "POST", lambda c: "/api/portal/doctors", lambda c: {"department_id": "t2_neurology", "name": "Sneaky Doctor", "working_days": ["Mon"], "working_hours": ["09:00-12:00"], "slot_duration_minutes": "30"}, control_optional=True)
    # ---- procedures
    pr = lambda v: {"p": v.procedure()}
    pbody = lambda c: {"category": "injection", "name": "Hacked", "booking_mode": "instant", "duration_minutes": 30}
    case("edit procedure", pr, "PUT", lambda c: f"/api/portal/procedures/{c['p']}", pbody)
    case("procedure active", pr, "POST", lambda c: f"/api/portal/procedures/{c['p']}/active", lambda c: {"is_active": False})
    case("delete procedure", pr, "DELETE", lambda c: f"/api/portal/procedures/{c['p']}")
    case("procedure resource types", pr, "POST", lambda c: f"/api/portal/procedures/{c['p']}/required-resource-types", lambda c: {"resource_types": ["staff"]})
    case("add procedure instruction", pr, "POST", lambda c: f"/api/portal/procedures/{c['p']}/instructions", lambda c: {"instruction_type": "other", "instruction_text": "hack"})
    case("delete procedure instruction", lambda v: {"i": v.instruction()}, "DELETE", lambda c: f"/api/portal/procedures/instructions/{c['i']}")
    r = lambda v: {"r": v.resource()}
    case("read procedure resource", r, "GET", lambda c: f"/api/portal/procedure-resources/{c['r']}")
    case("edit procedure resource", r, "PUT", lambda c: f"/api/portal/procedure-resources/{c['r']}", lambda c: {"resource_type": "staff", "name": "Hacked", "working_days": ["Mon"], "working_hours": ["09:00-12:00"]})
    case("procedure resource active", r, "POST", lambda c: f"/api/portal/procedure-resources/{c['r']}/active", lambda c: {"is_active": False})
    case("delete procedure resource", r, "DELETE", lambda c: f"/api/portal/procedure-resources/{c['r']}")
    case("read resource leave", r, "GET", lambda c: f"/api/portal/procedure-resources/{c['r']}/leave")
    case("add resource leave", r, "POST", lambda c: f"/api/portal/procedure-resources/{c['r']}/leave", lambda c: {"date": "2031-03-01", "reason": "hack"})
    case("remove resource leave", lambda v: {"r": (lambda rid: (db.add_procedure_resource_leave(v.hid, rid, "2031-03-02", "x"), rid)[1])(v.resource())}, "POST", lambda c: f"/api/portal/procedure-resources/{c['r']}/leave/remove", lambda c: {"date": "2031-03-02"})
    # ---- menu + orders
    m = lambda v: {"m": v.menu_item()}
    case("edit B's menu item", m, "PUT", lambda c: f"/api/portal/menu-items/{c['m']}", lambda c: {"name": "Hacked", "price_rupees": 1})
    o = lambda v: {"o": v.order()}
    case("read B's order", o, "GET", lambda c: f"/api/portal/food-orders/{c['o']}")
    case("accept B's order", o, "POST", lambda c: f"/api/portal/food-orders/{c['o']}/accept")
    case("cancel B's order", o, "POST", lambda c: f"/api/portal/food-orders/{c['o']}/cancel")
    # ---- staff
    case("deactivate B's staff", lambda v: {"s": v.staff()}, "PATCH", lambda c: f"/api/portal/staff/{c['s']}", lambda c: {"is_active": False})
    # ---- staff HR: leave and attendance
    lv = lambda v: {"l": v.leave_request()}
    case("approve B's leave request", lv, "POST", lambda c: f"/api/portal/leave/requests/{c['l']}/approve", lambda c: {"note": "attacker"})
    case("reject B's leave request", lv, "POST", lambda c: f"/api/portal/leave/requests/{c['l']}/reject", lambda c: {"note": "attacker"})
    case("withdraw B's leave request", lv, "POST", lambda c: f"/api/portal/leave/mine/{c['l']}/cancel", None, control_optional=True)
    case("correct B's clock-out", lambda v: {"a": v.attendance_record()}, "POST", lambda c: f"/api/portal/attendance/{c['a']}/correct",
         lambda c: {"check_out_time": "17:00", "note": "attacker correction"})
    case("promote B's staff", lambda v: {"s": v.staff()}, "PATCH", lambda c: f"/api/portal/staff/{c['s']}", lambda c: {"role": "admin"})
    case("edit B's staff profile", lambda v: {"s": v.staff()}, "PATCH", lambda c: f"/api/portal/staff/{c['s']}", lambda c: {"name": "Hacked", "phone": "9999999999"})
    case("reset B's staff password", lambda v: {"s": v.staff()}, "POST", lambda c: f"/api/portal/staff/{c['s']}/password", lambda c: {"new_password": "attacker-chosen-pw"})
    case("create staff under B's section", lambda v: {"d": v.dept["id"]}, "POST", lambda c: "/api/portal/staff",
         lambda c: {"name": "Sneaky Staff", "email": "sneaky.staff@example.com", "password": "hunter2hunter2", "role": "kitchen", "department_id": c["d"]}, control_optional=True)
    case("report to B's manager", lambda v: {"s": v.staff()}, "POST", lambda c: "/api/portal/staff",
         lambda c: {"name": "Sneaky Two", "email": "sneaky.two@example.com", "password": "hunter2hunter2", "role": "kitchen", "reports_to_id": c["s"]}, control_optional=True)
    return C


def _snapshot(hid: int) -> dict:
    """Every row that belongs to one restaurant, across every table that carries hospital_id,
    plus the child rows of its food orders and handoffs."""
    conn = get_connection()
    tables = [r["table_name"] for r in conn.execute(
        "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'hospital_id' ORDER BY table_name"
    ).fetchall()]
    snap = {}
    for t in tables:
        if t in ("audit_logs", "reference_id_counters"):
            continue  # append-only bookkeeping, checked separately by the read-leak test
        rows = conn.execute(f"SELECT * FROM {t} WHERE hospital_id = ?", (hid,)).fetchall()
        snap[t] = sorted(json.dumps(dict(r), default=str, sort_keys=True) for r in rows)
    # credentials and names live in identities, which has no hospital_id of its own
    ident = conn.execute(
        "SELECT i.* FROM identities i JOIN staff_details s ON s.identity_id = i.id WHERE s.hospital_id = ?", (hid,)
    ).fetchall()
    snap["identities"] = sorted(json.dumps(dict(r), default=str, sort_keys=True) for r in ident)
    for child, parent_col, parent in (("food_order_items", "order_id", "food_orders"), ("handoff_messages", "handoff_request_id", "handoff_requests")):
        try:
            rows = conn.execute(f"SELECT c.* FROM {child} c JOIN {parent} p ON p.id = c.{parent_col} WHERE p.hospital_id = ?", (hid,)).fetchall()
            snap[child] = sorted(json.dumps(dict(r), default=str, sort_keys=True) for r in rows)
        except Exception:
            pass
    return snap


def _call(method, path, headers, body):
    return client.request(method, path, headers=headers, json=body) if body is not None else client.request(method, path, headers=headers)


def test_restaurant_a_manager_cannot_read_or_change_restaurant_bs_data(hospital_id, second_hospital_id):
    a_headers = _manager(hospital_id, "a")
    b_headers = _manager(second_hospital_id, "b")
    victim = Victim(second_hospital_id)

    failures = []
    for name, setup, method, path, body, check, control_optional in _cases():
        ctx = setup(victim)
        url = path(ctx)
        payload = body(ctx) if body else None
        before = _snapshot(second_hospital_id)

        attack = _call(method, url, a_headers, payload)
        if not check(attack):
            failures.append(f"[{name}] A got {attack.status_code} on B's data: {attack.text[:200]}")
        after = _snapshot(second_hospital_id)
        changed = [t for t in before if before[t] != after.get(t)]
        if changed:
            failures.append(f"[{name}] B's data CHANGED by A's request, tables: {changed}")
        if MARK in attack.text and attack.status_code < 400:
            failures.append(f"[{name}] B's data appeared in A's response: {attack.text[:200]}")

        control = _call(method, url, b_headers, payload)
        if not control_optional and control.status_code >= 400:
            failures.append(f"[{name}] CONTROL failed (B's own request got {control.status_code}) -- the probe request is malformed: {control.text[:200]}")

    assert not failures, "\n" + "\n".join(failures)


LIST_ROUTES = [
    "/api/portal/bookings", "/api/portal/bookings/needs-attendance-review", "/api/portal/procedure-approval-queue",
    "/api/portal/patients", f"/api/portal/patients?search={MARK}", "/api/portal/handoffs", "/api/portal/handoffs?status=resolved",
    "/api/portal/doctors", "/api/portal/tables", "/api/portal/procedures", "/api/portal/procedure-resources",
    "/api/portal/menu-items", "/api/portal/food-orders", "/api/portal/staff", "/api/portal/dashboard",
    "/api/portal/settings", "/api/portal/audit-log", "/api/portal/appointment-types", "/api/portal/new-booking/context",
    "/api/portal/leave/mine", "/api/portal/leave/requests", "/api/portal/leave/requests?status=pending", "/api/portal/leave/policy",
    "/api/portal/attendance/today", "/api/portal/attendance/history?days=365", "/api/portal/attendance/overview",
    "/api/portal/attendance/overview?date=2026-01-05", "/api/portal/attendance/summary?month=2026-01",
    "/api/portal/attendance/settings", "/api/portal/notifications",
]


def test_restaurant_a_lists_never_include_restaurant_bs_records(hospital_id, second_hospital_id):
    a_headers = _manager(hospital_id, "a")
    b_headers = _manager(second_hospital_id, "b")
    v = Victim(second_hospital_id)
    v.appt(); v.patient(); v.handoff(); v.leave(); v.procedure(); v.resource(); v.order(); v.staff()
    v.leave_request(); v.attendance_record()
    # B's own manager generates audit-log entries with the MARK in them
    assert _call("PUT", f"/api/portal/menu-items/{v.menu_item()}", b_headers, {"name": f"{MARK} Renamed", "price_rupees": 3}).status_code == 200

    # control: B really can see its own records through these routes
    seen_by_b = " ".join(_call("GET", p, b_headers, None).text for p in LIST_ROUTES)
    assert MARK in seen_by_b

    leaks = []
    for path in LIST_ROUTES:
        resp = _call("GET", path, a_headers, None)
        if MARK in resp.text:
            leaks.append(f"{path} -> {resp.status_code} contains B's data")
    assert not leaks, "\n" + "\n".join(leaks)


def test_staff_tokens_and_platform_tokens_are_refused_on_each_others_routes(hospital_id, super_admin_headers):
    """Owner/Manager is a role inside ONE restaurant; the platform operator is a separate
    identity type. Neither token works on the other's routes."""
    staff_headers = _manager(hospital_id, "a")
    assert client.get("/api/admin/tenants", headers=super_admin_headers).status_code == 200  # control

    assert client.get("/api/admin/tenants", headers=staff_headers).status_code in (401, 403)
    assert client.get("/api/admin/tenants").status_code in (401, 403)
    for path in ("/api/portal/staff", "/api/portal/settings", "/api/portal/menu-items", "/api/portal/tables", "/api/portal/bookings", "/api/portal/patients"):
        resp = client.get(path, headers=super_admin_headers)
        assert resp.status_code in (401, 403), f"a platform token got {resp.status_code} on {path}"
    assert client.get("/api/portal/staff", headers=staff_headers).status_code == 200  # control


def test_excluding_another_restaurants_booking_does_not_change_availability(hospital_id, second_hospital_id):
    a_headers = _manager(hospital_id, "a")
    _manager(second_hospital_id, "b")
    v = Victim(second_hospital_id)
    b_appt = v.appt()
    db.update_restaurant_hours(hospital_id, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], ["11:00-23:00"], 90, 30)
    dept = db.create_department(hospital_id, "A Hall")
    db.create_table(hospital_id, dept["id"], "A-T1", 4)
    plain = client.get("/api/portal/new-booking/table-slots?party_size=2", headers=a_headers)
    excluded = client.get(f"/api/portal/new-booking/table-slots?party_size=2&exclude_appointment_id={b_appt}", headers=a_headers)
    assert plain.status_code == 200 and plain.json()["slots"], "control: A has bookable slots of its own"
    assert excluded.status_code == 200 and excluded.json() == plain.json()
    assert MARK not in excluded.text
