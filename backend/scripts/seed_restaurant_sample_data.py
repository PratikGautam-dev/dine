#!/usr/bin/env python3
"""Fills an EXISTING restaurant tenant with sample tables, reservation hours
and a sample menu so it can take a WhatsApp booking / show a menu right away.
Idempotent and non-destructive: each part is only created when that tenant has
none of it yet, and nothing is ever deleted.

Usage:
    DATABASE_URL="..." python -m scripts.seed_restaurant_sample_data <whatsapp_phone_number_id>
"""
import sys

import db.repository as db
from db.connection import get_session
from sqlalchemy import text

# section -> [(table name, seats)]
TABLES = {
    "Main Hall": [("T1", 2), ("T2", 2), ("T3", 4), ("T4", 4), ("T5", 6)],
    "Patio": [("P1", 2), ("P2", 4), ("P3", 8)],
}

# (name, price in rupees, category, description)
MENU = [
    ("Paneer Tikka", 249, "Starters", "Char-grilled cottage cheese with mint chutney"),
    ("Veg Spring Rolls", 179, "Starters", "Crisp rolls with sweet chilli dip"),
    ("Chicken 65", 229, "Starters", "Spicy, curry-leaf fried chicken"),
    ("Crispy Corn", 169, "Starters", "Golden corn tossed with pepper and spring onion"),
    ("Butter Chicken", 349, "Mains", "Tandoori chicken in a creamy tomato gravy"),
    ("Paneer Butter Masala", 299, "Mains", "Paneer in a rich, buttery tomato gravy"),
    ("Dal Makhani", 249, "Mains", "Slow-cooked black lentils with cream"),
    ("Veg Biryani", 279, "Mains", "Fragrant basmati rice with vegetables and raita"),
    ("Chicken Biryani", 329, "Mains", "Dum-cooked basmati rice with chicken and raita"),
    ("Butter Naan", 59, "Breads", "Soft tandoor-baked bread brushed with butter"),
    ("Garlic Naan", 69, "Breads", "Naan topped with garlic and coriander"),
    ("Tandoori Roti", 35, "Breads", "Whole-wheat bread from the tandoor"),
    ("Gulab Jamun (2 pcs)", 99, "Desserts", "Warm milk dumplings in cardamom syrup"),
    ("Chocolate Brownie", 149, "Desserts", "Fudgy brownie with a scoop of vanilla"),
    ("Masala Chai", 49, "Beverages", "Spiced Indian tea"),
    ("Fresh Lime Soda", 89, "Beverages", "Sweet, salted or mixed"),
    ("Mango Lassi", 119, "Beverages", "Thick yogurt drink with mango"),
]


def main(phone_number_id: str) -> None:
    hospital = db.find_hospital_by_phone_number_id(phone_number_id)
    if hospital is None:
        raise SystemExit(f"No restaurant with phone_number_id {phone_number_id!r}.")
    hid = hospital.id
    print(f"Restaurant #{hid}: {hospital.name!r}")

    # --- tables ---
    if db.get_all_tables_for_hospital(hid):
        print("Tables: already present -- left alone.")
    else:
        sections = db.get_departments(hid)
        by_name = {d["name"]: d for d in sections}
        # A lone, placeholder-named section (old wizard's "Single"/"General") becomes "Main Hall".
        if "Main Hall" not in by_name and len(sections) == 1 and sections[0]["name"] in ("Single", "General", "Main"):
            session = get_session()
            session.execute(
                text("UPDATE departments SET name = :n WHERE id = :i AND hospital_id = :h"),
                {"n": "Main Hall", "i": sections[0]["id"], "h": hid},
            )
            session.commit()
            by_name = {"Main Hall": {**sections[0], "name": "Main Hall"}}
        for section_name, tables in TABLES.items():
            section = by_name.get(section_name) or db.create_department(hid, section_name)
            for name, seats in tables:
                db.create_table(hid, section["id"], name, seats)
        print("Tables:", [(t["name"], t["capacity"]) for t in db.get_all_tables_for_hospital(hid)])

    # --- reservation hours ---
    settings = db.get_hospital_settings(hid)
    if settings["operating_days"] and settings["operating_hours"]:
        print("Hours: already set -- left alone.")
    else:
        db.update_restaurant_hours(hid, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], ["11:00-23:00"], 90, 30)
        print("Hours: Mon-Sun 11:00-23:00, 90-minute tables, a new seating every 30 minutes.")

    # --- menu ---
    if db.get_menu_items(hid, available_only=False):
        print("Menu: already has items -- left alone.")
    else:
        for name, rupees, category, description in MENU:
            db.create_menu_item(hid, name, price_paise=rupees * 100, description=description, category=category)
        print(f"Menu: {len(MENU)} items created across {len({m[2] for m in MENU})} categories.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m scripts.seed_restaurant_sample_data <whatsapp_phone_number_id>")
    main(sys.argv[1])
