#!/usr/bin/env python3
"""Adds a handful of real Combo Offers to Daaprime's (hospital #3) menu -- ordinary menu_items rows
with combo_item_count set, bundling real dishes already on the menu, priced below what the parts
would cost separately. Idempotent: skips any name that already exists for this hospital.

Usage:
    DATABASE_URL="..." python -m scripts.seed_combo_offers
"""
import db.repository as db

HOSPITAL_ID = 3

COMBOS = [
    # name, description (what's included), combo_item_count, price in rupees
    ("North Indian Combo", "Butter Chicken, Butter Naan, Mango Lassi", 3, 499),
    ("Veg Feast Combo", "Paneer Butter Masala, Garlic Naan, Gulab Jamun (2 pcs)", 3, 429),
    ("Starter Sharing Combo", "Paneer Tikka, Chicken 65, Crispy Corn", 3, 599),
    ("Family Feast Combo", "Chicken Biryani, Veg Biryani, 2 Butter Naan, 2 Fresh Lime Soda", 5, 999),
]


def main() -> None:
    existing = {i["name"] for i in db.get_menu_items(HOSPITAL_ID, available_only=False)}
    created = 0
    for name, description, item_count, price_rupees in COMBOS:
        if name in existing:
            continue
        db.create_menu_item(
            HOSPITAL_ID, name, price_paise=price_rupees * 100, description=description,
            category="Combos", is_available=True, combo_item_count=item_count,
        )
        created += 1
    print(f"Created {created} combo offer(s).")


if __name__ == "__main__":
    main()
