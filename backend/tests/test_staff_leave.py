# tests/test_staff_leave.py
"""Staff HR leave: apply / review / balance / notifications, with real staff logins and real requests.
Covers the rules (validation, overlap, half-days, yearly balance incl. a New Year span, unpaid leave),
the review workflow (approve / reject, guarded against double decisions, self-approval only for the sole
Owner), who may do what, and the in-portal notifications."""
import pytest

import db.repository as db
from tests.hr_helpers import client, future, headers_for, login, make_staff, PW  # noqa: F401


@pytest.fixture
def team(hospital_id):
    return {
        "owner": login(hospital_id, "admin", "owner@example.com", "Olive Owner"),
        "foh": login(hospital_id, "receptionist", "foh@example.com", "Fay Host"),
        "cook": login(hospital_id, "kitchen", "cook@example.com", "Kit Cook"),
    }


def _apply(h, leave_type="casual", start=None, end=None, half=False, reason="Family function"):
    start = start or future(10)
    return client.post("/api/portal/leave/mine", headers=h, json={
        "leave_type": leave_type, "from_date": start, "to_date": end or start, "is_half_day": half, "reason": reason})


def _staff_id(email):
    return db.get_staff_user_by_email(email)["id"]


# ---------------------------------------------------------------- applying

def test_apply_shows_up_with_a_pending_balance(hospital_id, team):
    resp = _apply(team["cook"], start=future(10), end=future(12))
    assert resp.status_code == 201, resp.text
    req = resp.json()["request"]
    assert req["status"] == "pending" and req["days"] == 3.0 and req["leave_type"] == "casual"
    assert resp.json()["balance"]["allowance"] == 20 and resp.json()["balance"]["pending"] == 3.0

    mine = client.get("/api/portal/leave/mine", headers=team["cook"]).json()
    assert [r["id"] for r in mine["requests"]] == [req["id"]]
    assert mine["balance"]["used"] == 0.0 and mine["balance"]["remaining"] == 20.0
    assert set(mine["leave_types"]) == {"casual", "sick", "annual", "unpaid", "personal"}
    assert client.get("/api/portal/leave/mine", headers=team["foh"]).json()["requests"] == []  # only your own


def test_a_half_day_counts_half(hospital_id, team):
    resp = _apply(team["foh"], half=True)
    assert resp.status_code == 201 and resp.json()["request"]["days"] == 0.5 and resp.json()["request"]["is_half_day"] is True


def test_validation_errors_are_readable(hospital_id, team):
    cases = [
        (dict(leave_type="holiday"), "Choose a leave type"),
        (dict(start="not-a-date"), "valid from and to dates"),
        (dict(start=future(12), end=future(10)), "can't be before"),
        (dict(start=future(10), end=future(12), half=True), "single day"),
        (dict(reason="   "), "give a reason"),
        (dict(reason="x" * 501), "at most 500"),
        (dict(start="2020-01-01"), "in the past"),
        (dict(start=future(10), end=future(500)), "more than a year"),
    ]
    for over, expect in cases:
        resp = _apply(team["cook"], **over)
        assert resp.status_code == 400 and isinstance(resp.json().get("error"), str), (over, resp.text)
        assert expect in resp.json()["error"], (over, resp.json())
    assert client.get("/api/portal/leave/mine", headers=team["cook"]).json()["requests"] == []


def test_overlapping_requests_are_refused_but_adjacent_and_withdrawn_ones_are_fine(hospital_id, team):
    first = _apply(team["cook"], start=future(10), end=future(12)).json()["request"]
    assert _apply(team["cook"], start=future(12), end=future(14)).status_code == 409  # shares a day
    assert _apply(team["cook"], start=future(13), end=future(14)).status_code == 201  # the next day is fine
    assert client.post(f"/api/portal/leave/mine/{first['id']}/cancel", headers=team["cook"]).status_code == 200
    assert _apply(team["cook"], start=future(10), end=future(11)).status_code == 201  # the withdrawn dates are free again
    assert _apply(team["foh"], start=future(10), end=future(12)).status_code == 201   # someone else can take them


def test_a_person_can_withdraw_only_their_own_pending_request(hospital_id, team):
    mine = _apply(team["cook"]).json()["request"]
    assert client.post(f"/api/portal/leave/mine/{mine['id']}/cancel", headers=team["foh"]).status_code == 404
    assert client.post("/api/portal/leave/mine/99999/cancel", headers=team["cook"]).status_code == 404
    assert client.post(f"/api/portal/leave/mine/{mine['id']}/cancel", headers=team["cook"]).json()["request"]["status"] == "cancelled"
    assert client.post(f"/api/portal/leave/mine/{mine['id']}/cancel", headers=team["cook"]).status_code == 409  # already withdrawn

    decided = _apply(team["cook"], start=future(40)).json()["request"]
    client.post(f"/api/portal/leave/requests/{decided['id']}/approve", headers=team["owner"])
    assert client.post(f"/api/portal/leave/mine/{decided['id']}/cancel", headers=team["cook"]).status_code == 409  # can't withdraw an approved one


# ---------------------------------------------------------------- balance

def test_balance_moves_from_pending_to_used_only_when_approved(hospital_id, team):
    req = _apply(team["cook"], start=future(10), end=future(13)).json()["request"]  # 4 days
    bal = lambda: client.get("/api/portal/leave/mine", headers=team["cook"]).json()["balance"]
    assert (bal()["pending"], bal()["used"], bal()["remaining"]) == (4.0, 0.0, 20.0)
    client.post(f"/api/portal/leave/requests/{req['id']}/approve", headers=team["owner"])
    assert (bal()["pending"], bal()["used"], bal()["remaining"]) == (0.0, 4.0, 16.0)

    rejected = _apply(team["cook"], start=future(30), end=future(32)).json()["request"]
    client.post(f"/api/portal/leave/requests/{rejected['id']}/reject", headers=team["owner"])
    assert bal()["used"] == 4.0 and bal()["pending"] == 0.0  # a rejected request costs nothing


def test_unpaid_leave_never_uses_the_allowance(hospital_id, team):
    req = _apply(team["cook"], leave_type="unpaid", start=future(10), end=future(19)).json()["request"]  # 10 days
    client.post(f"/api/portal/leave/requests/{req['id']}/approve", headers=team["owner"])
    bal = client.get("/api/portal/leave/mine", headers=team["cook"]).json()["balance"]
    assert bal["used"] == 0.0 and bal["remaining"] == 20.0


def test_a_request_spanning_new_year_is_split_between_the_years(hospital_id, team):
    """Dec 30 -> Jan 3 is 5 days: 2 count in the first year, 3 in the next (repository level, so the
    calendar dates don't depend on today)."""
    cook = _staff_id("cook@example.com")
    req = db.create_leave_request(hospital_id, cook, "annual", "2031-12-30", "2032-01-03", False, "Holiday")
    assert req["days"] == 5.0
    db.decide_leave_request(hospital_id, req["id"], "approved", _staff_id("owner@example.com"), None)
    assert db.leave_balance(hospital_id, cook, 2031)["used"] == 2.0
    assert db.leave_balance(hospital_id, cook, 2032)["used"] == 3.0
    assert db.leave_balance(hospital_id, cook, 2033)["used"] == 0.0


def test_the_yearly_allowance_can_be_changed_and_is_validated(hospital_id, team):
    assert client.get("/api/portal/leave/policy", headers=team["owner"]).json() == {"annual_leave_days": 20}
    assert client.post("/api/portal/leave/policy", headers=team["owner"], json={"annual_leave_days": 25}).json() == {"annual_leave_days": 25}
    assert client.get("/api/portal/leave/mine", headers=team["cook"]).json()["balance"]["allowance"] == 25
    for bad in (-1, 400, None):
        assert client.post("/api/portal/leave/policy", headers=team["owner"], json={"annual_leave_days": bad}).status_code == 400
    assert db.get_annual_leave_days(hospital_id) == 25
    entries = client.get("/api/portal/audit-log", headers=team["owner"]).text
    assert "leave.set_allowance" in entries


def test_going_over_the_allowance_is_flagged_not_blocked(hospital_id, team):
    client.post("/api/portal/leave/policy", headers=team["owner"], json={"annual_leave_days": 2})
    resp = _apply(team["cook"], start=future(10), end=future(14))  # 5 days against 2
    assert resp.status_code == 201 and resp.json()["over_allowance"] is True


# ---------------------------------------------------------------- the review queue

def test_owner_reviews_with_context_and_decides(hospital_id, team):
    _apply(team["cook"], start=future(10), end=future(12))
    other_cook = login(hospital_id, "kitchen", "cook2@example.com", "Kay Cook")
    req = _apply(other_cook, start=future(11), end=future(11)).json()["request"]
    client.post(f"/api/portal/leave/requests/{db.list_leave_requests(hospital_id, staff_id=_staff_id('cook@example.com'))[0]['id']}/approve", headers=team["owner"])

    queue = client.get("/api/portal/leave/requests?status=pending", headers=team["owner"]).json()
    assert queue["summary"]["pending"] == 1 and queue["summary"]["approved"] == 1
    item = queue["requests"][0]
    assert item["id"] == req["id"] and item["staff_name"] == "Kay Cook" and item["staff_role"] == "kitchen"
    assert item["conflicts"] == {"role_total": 1, "role_off": 1}  # the other cook is already off that day
    assert item["balance"]["remaining"] == 20.0

    decided = client.post(f"/api/portal/leave/requests/{req['id']}/reject", headers=team["owner"], json={"note": "Too many off that day"})
    assert decided.status_code == 200 and decided.json()["request"]["status"] == "rejected"
    assert decided.json()["request"]["decision_note"] == "Too many off that day"
    assert decided.json()["request"]["decided_by"] == _staff_id("owner@example.com")


def test_a_request_can_only_be_decided_once(hospital_id, team):
    req = _apply(team["cook"]).json()["request"]
    assert client.post(f"/api/portal/leave/requests/{req['id']}/approve", headers=team["owner"]).status_code == 200
    again = client.post(f"/api/portal/leave/requests/{req['id']}/reject", headers=team["owner"])
    assert again.status_code == 409 and "already approved" in again.json()["error"]
    assert db.get_leave_request(hospital_id, req["id"])["status"] == "approved"
    assert client.post("/api/portal/leave/requests/99999/approve", headers=team["owner"]).status_code == 404

    withdrawn = _apply(team["cook"], start=future(40)).json()["request"]
    client.post(f"/api/portal/leave/mine/{withdrawn['id']}/cancel", headers=team["cook"])
    assert client.post(f"/api/portal/leave/requests/{withdrawn['id']}/approve", headers=team["owner"]).status_code == 409


def test_decisions_are_audit_logged(hospital_id, team):
    req = _apply(team["cook"]).json()["request"]
    client.post(f"/api/portal/leave/requests/{req['id']}/approve", headers=team["owner"], json={"note": "Enjoy"})
    log = client.get("/api/portal/audit-log", headers=team["owner"]).text
    assert "leave.approved" in log


# ---------------------------------------------------------------- self-approval

def test_the_sole_owner_may_approve_their_own_leave(hospital_id, team):
    mine = _apply(team["owner"]).json()["request"]
    resp = client.post(f"/api/portal/leave/requests/{mine['id']}/approve", headers=team["owner"])
    assert resp.status_code == 200 and resp.json()["request"]["status"] == "approved"


def test_with_two_owners_nobody_decides_their_own_request(hospital_id, team):
    second = login(hospital_id, "admin", "owner2@example.com", "Oscar Owner")
    mine = _apply(team["owner"]).json()["request"]
    refused = client.post(f"/api/portal/leave/requests/{mine['id']}/approve", headers=team["owner"])
    assert refused.status_code == 403 and "another Owner" in refused.json()["error"]
    assert db.get_leave_request(hospital_id, mine["id"])["status"] == "pending"
    assert client.post(f"/api/portal/leave/requests/{mine['id']}/approve", headers=second).status_code == 200  # the other Owner can


def test_a_non_owner_given_review_rights_still_cannot_approve_their_own(hospital_id, team):
    client.put("/api/portal/roles/permissions", headers=team["owner"], json={"updates": [
        {"role": "receptionist", "page_key": "leave_requests", "can_view": True, "can_write": True, "can_delete": False}]})
    mine = _apply(team["foh"]).json()["request"]
    assert client.post(f"/api/portal/leave/requests/{mine['id']}/approve", headers=team["foh"]).status_code == 403
    assert client.post(f"/api/portal/leave/requests/{mine['id']}/approve", headers=team["owner"]).status_code == 200


# ---------------------------------------------------------------- who may do what

def test_everyone_can_apply_but_only_owners_review(hospital_id, team):
    for who in ("owner", "foh", "cook"):
        assert client.get("/api/portal/leave/mine", headers=team[who]).status_code == 200
        assert _apply(team[who], start=future(20 + len(who))).status_code == 201
    pending = db.list_leave_requests(hospital_id, status="pending")[0]
    for who in ("foh", "cook"):
        h = team[who]
        assert client.get("/api/portal/leave/requests", headers=h).status_code == 403
        assert client.post(f"/api/portal/leave/requests/{pending['id']}/approve", headers=h).status_code == 403
        assert client.post(f"/api/portal/leave/requests/{pending['id']}/reject", headers=h).status_code == 403
        assert client.get("/api/portal/leave/policy", headers=h).status_code == 403
        assert client.post("/api/portal/leave/policy", headers=h, json={"annual_leave_days": 99}).status_code == 403
    assert db.get_leave_request(hospital_id, pending["id"])["status"] == "pending"
    assert db.get_annual_leave_days(hospital_id) == 20


# ---------------------------------------------------------------- notifications

def test_reviewers_are_told_of_a_request_and_the_requester_of_the_decision(hospital_id, team):
    req = _apply(team["cook"], start=future(10), end=future(11)).json()["request"]
    owner_inbox = client.get("/api/portal/notifications", headers=team["owner"]).json()
    assert owner_inbox["unread"] == 1
    assert "Kit Cook asked for leave" in owner_inbox["notifications"][0]["title"]
    assert owner_inbox["notifications"][0]["link"] == "/portal/leave-requests"
    assert client.get("/api/portal/notifications", headers=team["cook"]).json()["unread"] == 0  # not told about their own request
    assert client.get("/api/portal/notifications", headers=team["foh"]).json()["unread"] == 0   # nor is anyone who can't review

    client.post(f"/api/portal/leave/requests/{req['id']}/approve", headers=team["owner"], json={"note": "Have a good one"})
    cook_inbox = client.get("/api/portal/notifications", headers=team["cook"]).json()
    assert cook_inbox["unread"] == 1 and cook_inbox["notifications"][0]["title"] == "Your leave was approved"
    assert "Have a good one" in cook_inbox["notifications"][0]["body"]

    reject = _apply(team["cook"], start=future(30)).json()["request"]
    client.post(f"/api/portal/leave/requests/{reject['id']}/reject", headers=team["owner"])
    assert client.get("/api/portal/notifications", headers=team["cook"]).json()["notifications"][0]["title"] == "Your leave was declined"


def test_marking_notifications_read_only_touches_your_own(hospital_id, team):
    other = login(hospital_id, "admin", "owner2@example.com", "Oscar Owner")  # a second Owner, present before anyone applies
    _apply(team["cook"])
    _apply(team["foh"], start=future(20))
    owner = client.get("/api/portal/notifications", headers=team["owner"]).json()
    assert owner["unread"] == 2
    ids = [n["id"] for n in owner["notifications"]]
    assert client.get("/api/portal/notifications", headers=other).json()["unread"] == 2

    # the second Owner tries to mark the first Owner's notifications read -- nothing changes for them
    assert client.post("/api/portal/notifications/read", headers=other, json={"ids": ids[:1]}).json()["marked"] == 0  # not theirs
    assert client.get("/api/portal/notifications", headers=team["owner"]).json()["unread"] == 2

    one = client.post("/api/portal/notifications/read", headers=team["owner"], json={"ids": ids[:1]}).json()
    assert one["marked"] == 1 and one["unread"] == 1
    everything = client.post("/api/portal/notifications/read", headers=team["owner"], json={}).json()
    assert everything["unread"] == 0
