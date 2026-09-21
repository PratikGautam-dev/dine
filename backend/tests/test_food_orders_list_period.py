# tests/test_food_orders_list_period.py
"""GET /api/portal/food-orders no longer returns every order ever placed: it covers the last 90 days by default,
`days` narrows or widens that, and `days=0` means all time. Orders are stored with ISO-text timestamps, so the
tests backdate rows the way real older orders look."""
import json
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from tests.test_table_reschedule import _portal_login  # noqa: E402

PHONE = "5491100000041"


def _orders_aged(hospital_id, ages_in_days):
    """One order per age, backdated (ISO text with an offset, like the app writes them). Returns {age: order id}."""
    item = db.create_menu_item(hospital_id, "Dish", price_paise=10000)["id"]
    conn = get_connection()
    ids = {}
    for age in ages_in_days:
        order = db.create_food_order(
            hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="pay_at_restaurant",
        )
        when = datetime.now(timezone.utc) - timedelta(days=age)
        conn.execute("UPDATE food_orders SET created_at = ? WHERE id = ?", (when.isoformat(), order["id"]))
        ids[age] = order["id"]
    conn.commit()
    return ids


def _get(hospital_id, password, query=""):
    conn = get_connection()
    conn.execute("UPDATE hospitals SET enabled_features = ? WHERE id = ?", (json.dumps(["book_appointment", "order_food"]), hospital_id))
    conn.commit()
    client, headers = _portal_login(hospital_id, password)
    return client.get("/api/portal/food-orders" + query, headers=headers)


def test_default_covers_the_last_90_days_only(hospital_id):
    ids = _orders_aged(hospital_id, [0, 30, 89, 91, 400])
    resp = _get(hospital_id, "period-pw-1")
    assert resp.status_code == 200
    body = resp.json()
    assert {o["id"] for o in body["food_orders"]} == {ids[0], ids[30], ids[89]}
    assert body["period_days"] == 90


def test_days_narrows_widens_and_zero_means_all_time(hospital_id):
    ids = _orders_aged(hospital_id, [0, 10, 40, 200, 1000])
    assert {o["id"] for o in _get(hospital_id, "period-pw-2", "?days=30").json()["food_orders"]} == {ids[0], ids[10]}
    assert {o["id"] for o in _get(hospital_id, "period-pw-2", "?days=365").json()["food_orders"]} == {ids[0], ids[10], ids[40], ids[200]}
    everything = _get(hospital_id, "period-pw-2", "?days=0").json()
    assert {o["id"] for o in everything["food_orders"]} == set(ids.values()) and everything["period_days"] == 0


def test_newest_first_and_the_status_filter_still_apply_inside_the_period(hospital_id):
    ids = _orders_aged(hospital_id, [0, 5, 20, 120])
    conn = get_connection()
    conn.execute("UPDATE food_orders SET status = 'completed' WHERE id IN (?, ?)", (ids[5], ids[120]))
    conn.commit()
    rows = _get(hospital_id, "period-pw-3").json()["food_orders"]
    assert [o["id"] for o in rows] == [ids[0], ids[5], ids[20]]  # newest first, the 120-day-old one is out
    done = _get(hospital_id, "period-pw-3", "?status=completed").json()["food_orders"]
    assert [o["id"] for o in done] == [ids[5]]  # 120 days ago is outside the default period even though it matches the status
    assert [o["id"] for o in _get(hospital_id, "period-pw-3", "?status=completed&days=0").json()["food_orders"]] == [ids[5], ids[120]]


def test_out_of_range_days_is_rejected(hospital_id):
    for bad in ("-1", "3651", "99999"):
        resp = _get(hospital_id, "period-pw-4", f"?days={bad}")
        assert resp.status_code == 400, bad
    assert _get(hospital_id, "period-pw-4", "?days=abc").status_code == 422  # not a number at all


def test_the_period_never_lets_another_restaurants_orders_in(hospital_id, second_hospital_id):
    mine = _orders_aged(hospital_id, [1])
    theirs = _orders_aged(second_hospital_id, [1])
    ids = {o["id"] for o in _get(hospital_id, "period-pw-5", "?days=0").json()["food_orders"]}
    assert ids == {mine[1]} and theirs[1] not in ids


def test_the_repository_function_takes_since_directly(hospital_id):
    ids = _orders_aged(hospital_id, [2, 50])
    since = datetime.now(timezone.utc) - timedelta(days=10)
    assert [o["id"] for o in db.list_food_orders(hospital_id, since=since)] == [ids[2]]
    assert len(db.list_food_orders(hospital_id)) == 2  # no `since`: unchanged behaviour for other callers
