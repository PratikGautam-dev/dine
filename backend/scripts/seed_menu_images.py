#!/usr/bin/env python3
"""Gives every Daaprime (hospital #3) menu item without a photo a placeholder image -- a brand-colored
placehold.co image with the dish name on it, color-coded per category, so the Menu page shows a real
photo tile instead of the generic fallback icon everywhere. Idempotent: only fills image_url where it's
currently NULL/empty, never overwrites a real photo someone's since set.

Usage:
    DATABASE_URL="..." python -m scripts.seed_menu_images
"""
from urllib.parse import quote

from sqlalchemy import text

from db.connection import get_session

HOSPITAL_ID = 3

# category -> (background hex, text hex) -- same idea as DepartmentDonut's SLOT_COLORS: a fixed,
# distinguishable set, not cycled per-item.
CATEGORY_COLORS = {
    "Starters": ("e21220", "ffffff"),
    "Mains": ("2a211c", "ffffff"),
    "Breads": ("e0a100", "2a211c"),
    "Desserts": ("7d361d", "ffffff"),
    "Beverages": ("2f6fed", "ffffff"),
}
DEFAULT_COLORS = ("6b7a4f", "ffffff")


def main() -> None:
    s = get_session()
    rows = s.execute(
        text("SELECT id, name, category FROM menu_items WHERE hospital_id = :h AND (image_url IS NULL OR image_url = '')"),
        {"h": HOSPITAL_ID},
    ).fetchall()

    updated = 0
    for item_id, name, category in rows:
        bg, fg = CATEGORY_COLORS.get(category, DEFAULT_COLORS)
        url = f"https://placehold.co/480x320/{bg}/{fg}/png?text={quote(name)}"
        s.execute(text("UPDATE menu_items SET image_url = :u WHERE id = :id"), {"u": url, "id": item_id})
        updated += 1

    s.commit()
    print(f"Set a placeholder image on {updated} menu item(s).")


if __name__ == "__main__":
    main()
