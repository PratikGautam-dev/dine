#!/usr/bin/env python3
"""Adds a handful of real Combo Offers to Daaprime's (hospital #3) menu -- ordinary menu_items rows
flagged is_combo, bundling real dishes already on the menu (via menu_item_combo_lines), priced below
what the parts would cost separately. Idempotent: skips any name that already exists for this hospital.

Usage:
    DATABASE_URL="..." python -m scripts.seed_combo_offers
"""
import db.repository as db

HOSPITAL_ID = 3

# name, [(component dish name, quantity), ...], price in rupees
COMBOS = [
    ("North Indian Combo", [("Butter Chicken", 1), ("Butter Naan", 1), ("Mango Lassi", 1)], 499),
    ("Veg Feast Combo", [("Paneer Butter Masala", 1), ("Garlic Naan", 1), ("Gulab Jamun (2 pcs)", 1)], 429),
    ("Starter Sharing Combo", [("Paneer Tikka", 1), ("Chicken 65", 1), ("Crispy Corn", 1)], 599),
    ("Family Feast Combo", [("Chicken Biryani", 1), ("Veg Biryani", 1), ("Butter Naan", 2), ("Fresh Lime Soda", 2)], 999),
]


def main() -> None:
    all_items = db.get_menu_items(HOSPITAL_ID, available_only=False)
    existing_names = {i["name"] for i in all_items}
    item_id_by_name = {i["name"]: i["id"] for i in all_items if not i["is_combo"]}

    created = 0
    for name, components, price_rupees in COMBOS:
        if name in existing_names:
            continue
        missing = [dish for dish, _ in components if dish not in item_id_by_name]
        if missing:
            print(f"Skipping {name!r} -- missing menu item(s): {missing}")
            continue
        combo_lines = [{"component_item_id": item_id_by_name[dish], "quantity": qty} for dish, qty in components]
        db.create_menu_item(
            HOSPITAL_ID, name, price_paise=price_rupees * 100, category="Combos",
            is_available=True, is_combo=True, combo_lines=combo_lines,
        )
        created += 1
    print(f"Created {created} combo offer(s).")


if __name__ == "__main__":
    main()
