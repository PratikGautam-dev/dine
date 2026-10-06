# tests/test_loyalty.py
"""Loyalty points: 1 point per ₹100 on a paid order (or a completed pay-at-restaurant order), awarded
once per order, with the customer's spend and order count kept in step."""
import os

os.environ.setdefault("INTERNAL_SECRET", "internalsecret")

import db.repository as db  # noqa: E402
from db.connection import get_connection  # noqa: E402
from db.repositories.food_orders import _award_loyalty  # noqa: E402

PHONE = "919900000010"


def _item(hospital_id, price_paise):
    return db.create_menu_item(hospital_id, "Thali", price_paise=price_paise, category="Mains")["id"]


def _patient(hospital_id, phone=PHONE):
    row = get_connection().execute(
        "SELECT loyalty_points, total_orders, total_spend_paise FROM patients WHERE hospital_id = ? AND phone = ?",
        (hospital_id, phone),
    ).fetchone()
    return dict(row) if row else None


def test_paid_order_awards_one_point_per_hundred_rupees(hospital_id):
    item = _item(hospital_id, 25000)
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="online")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")

    patient = _patient(hospital_id)
    assert patient["loyalty_points"] == 2
    assert patient["total_orders"] == 1
    assert patient["total_spend_paise"] == 25000


def test_repeat_award_for_the_same_order_adds_nothing(hospital_id):
    item = _item(hospital_id, 25000)
    order = db.create_food_order(hospital_id, PHONE, [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="online")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")
    conn = get_connection()
    _award_loyalty(conn, hospital_id, order["id"])
    _award_loyalty(conn, hospital_id, order["id"])

    assert _patient(hospital_id)["loyalty_points"] == 2
    rows = conn.execute("SELECT COUNT(*) AS n FROM loyalty_transactions WHERE order_id = ?", (order["id"],)).fetchone()
    assert rows["n"] == 1


def test_pay_at_restaurant_order_earns_only_when_completed(hospital_id):
    item = _item(hospital_id, 40000)
    order = db.create_food_order(hospital_id, "919900000011", [{"menu_item_id": item, "quantity": 1}], "pickup",
                                 payment_method="pay_at_restaurant")
    assert _patient(hospital_id, "919900000011")["loyalty_points"] == 0

    db.advance_order_status(hospital_id, order["id"], "completed", order["status"])

    patient = _patient(hospital_id, "919900000011")
    assert patient["loyalty_points"] == 4
    assert patient["total_orders"] == 1


def test_completing_a_paid_online_order_does_not_award_twice(hospital_id):
    item = _item(hospital_id, 25000)
    order = db.create_food_order(hospital_id, "919900000012", [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="online")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")
    db.advance_order_status(hospital_id, order["id"], "completed", "paid")

    assert _patient(hospital_id, "919900000012")["loyalty_points"] == 2


def test_restaurant_earn_rate_setting_changes_points(hospital_id):
    db.update_loyalty_settings(hospital_id, {"paise_per_point": 5000})
    item = _item(hospital_id, 25000)
    order = db.create_food_order(hospital_id, "919900000013", [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="online")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")

    assert _patient(hospital_id, "919900000013")["loyalty_points"] == 5


def test_disabled_loyalty_awards_nothing(hospital_id):
    db.update_loyalty_settings(hospital_id, {"enabled": False})
    item = _item(hospital_id, 25000)
    order = db.create_food_order(hospital_id, "919900000014", [{"menu_item_id": item, "quantity": 1}], "pickup", payment_method="online")
    db.advance_order_status(hospital_id, order["id"], "paid", "pending_payment")

    assert _patient(hospital_id, "919900000014")["loyalty_points"] == 0


def test_loyalty_settings_reject_invalid_values(hospital_id):
    import pytest as _pytest

    with _pytest.raises(ValueError):
        db.update_loyalty_settings(hospital_id, {"paise_per_point": 0})
    with _pytest.raises(ValueError):
        db.update_loyalty_settings(hospital_id, {"unknown_key": 1})
