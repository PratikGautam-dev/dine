# tests/test_public_uuids.py
"""Customers and orders carry a public UUID for URLs; lookup by it stays inside one restaurant."""
import re

import db.repository as db
from db.repositories.patients import get_patient_by_public_id

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def test_every_new_customer_gets_a_uuid(hospital_id):
    item = db.create_menu_item(hospital_id, "Dosa", price_paise=9000, category="Mains")["id"]
    db.create_food_order(hospital_id, "919900000030", [{"menu_item_id": item, "quantity": 1}], "pickup")

    listed = next(p for p in db.list_patients(hospital_id) if p["phone"] == "919900000030")
    assert UUID_RE.match(listed["public_id"])


def test_lookup_by_uuid_finds_the_customer_in_their_own_restaurant_only(hospital_id, second_hospital_id):
    item = db.create_menu_item(hospital_id, "Idli", price_paise=4000, category="Mains")["id"]
    db.create_food_order(hospital_id, "919900000031", [{"menu_item_id": item, "quantity": 1}], "pickup")
    public_id = next(p for p in db.list_patients(hospital_id) if p["phone"] == "919900000031")["public_id"]

    assert get_patient_by_public_id(hospital_id, public_id)["phone"] == "919900000031"
    assert get_patient_by_public_id(second_hospital_id, public_id) is None
