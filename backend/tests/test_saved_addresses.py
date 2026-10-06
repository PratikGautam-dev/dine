# tests/test_saved_addresses.py
"""Saved delivery addresses: up to 5 per WhatsApp customer, no duplicates, deleting frees a slot."""
from db.repositories.addresses import MAX_SAVED_ADDRESSES, add_address, count_addresses, delete_address, list_addresses

PHONE = "919900000020"


def test_a_customer_can_save_up_to_five_addresses(hospital_id):
    for i in range(MAX_SAVED_ADDRESSES):
        assert add_address(hospital_id, PHONE, f"Flat {i}, Park Street, Kolkata") is not None

    assert count_addresses(hospital_id, PHONE) == 5
    assert add_address(hospital_id, PHONE, "One more place, Pune") is None


def test_the_same_address_is_not_saved_twice(hospital_id):
    first = add_address(hospital_id, "919900000021", "12 MG Road, Pune")
    again = add_address(hospital_id, "919900000021", "  12 mg road, pune ")

    assert first["id"] == again["id"]
    assert len(list_addresses(hospital_id, "919900000021")) == 1


def test_deleting_an_address_frees_a_slot(hospital_id):
    phone = "919900000022"
    saved = [add_address(hospital_id, phone, f"Lane {i}, Mumbai") for i in range(MAX_SAVED_ADDRESSES)]
    assert add_address(hospital_id, phone, "Extra, Delhi") is None

    assert delete_address(hospital_id, phone, saved[0]["id"]) is True
    assert add_address(hospital_id, phone, "Extra, Delhi") is not None


def test_addresses_are_private_to_each_phone(hospital_id):
    add_address(hospital_id, "919900000023", "Home, Chennai")

    assert list_addresses(hospital_id, "919900000024") == []
