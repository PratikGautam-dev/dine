#!/usr/bin/env python3
"""Web Storefront demo seed (Phase 7): takes a restaurant already onboarded via
scripts/seed_restaurant_sample_data.py (or any real hospital -- tables/hours/menu
already exist) and gets its public marketplace listing genuinely demo-ready: web
ordering on, a realistic profile (logo/cover/address, falling back to sensible
defaults for anything not already set by the portal's Online Storefront settings
page), placeholder photos for any menu item still missing one (reusing
seed_menu_images.py's per-category color-lookup, parameterized by hospital instead
of that script's hardcoded HOSPITAL_ID = 3), and one demo coupon if the restaurant
has none yet. Idempotent -- safe to re-run; never overwrites a value staff already
set through the portal.

Usage:
    DATABASE_URL="..." python -m scripts.seed_web_storefront_demo <whatsapp_phone_number_id>
"""
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import text

import db.repository as db
from db.connection import get_session

CATEGORY_COLORS = {
    "Starters": ("e21220", "ffffff"),
    "Mains": ("2a211c", "ffffff"),
    "Breads": ("e0a100", "2a211c"),
    "Desserts": ("7d361d", "ffffff"),
    "Beverages": ("2f6fed", "ffffff"),
}
DEFAULT_COLORS = ("6b7a4f", "ffffff")


def _placeholder_image(name: str, bg: str, fg: str, size: str = "480x320") -> str:
    return f"https://placehold.co/{size}/{bg}/{fg}/png?text={quote(name)}"


def seed_menu_images(hospital_id: int) -> int:
    session = get_session()
    rows = session.execute(
        text("SELECT id, name, category FROM menu_items WHERE hospital_id = :h AND (image_url IS NULL OR image_url = '')"),
        {"h": hospital_id},
    ).fetchall()
    for item_id, name, category in rows:
        bg, fg = CATEGORY_COLORS.get(category, DEFAULT_COLORS)
        session.execute(text("UPDATE menu_items SET image_url = :u WHERE id = :id"), {"u": _placeholder_image(name, bg, fg), "id": item_id})
    session.commit()
    return len(rows)


def seed_storefront_profile(hospital_id: int) -> dict:
    current = db.get_storefront(hospital_id)
    fields: dict = {"web_ordering_enabled": True}
    # Only fill what staff haven't already set via the portal -- update_storefront()
    # only writes keys present in `fields`, so anything already correct is left alone
    # simply by never being included below.
    if not current["cuisines"]:
        fields["cuisine_tags"] = "North Indian, Biryani, Beverages"
    if not current["tagline"]:
        fields["tagline"] = "Better Dining. Stronger Connection."
    if not current["city"]:
        fields["city"] = "Mumbai"
    if not current["address_line"]:
        fields["address_line"] = "Daaprime Tech, Andheri East, Mumbai"
    if not current["logo_url"]:
        fields["logo_url"] = _placeholder_image(current["name"], "2f6fed", "ffffff", size="200x200")
    if not current["cover_image_url"]:
        fields["cover_image_url"] = _placeholder_image(current["name"], "e21220", "ffffff", size="1200x400")
    if current["min_order_paise"] == 0:
        fields["min_order_paise"] = 19900
    if current["avg_prep_minutes"] == 30:
        fields["avg_prep_minutes"] = 25
    return db.update_storefront(hospital_id, fields)


def seed_demo_coupon(hospital_id: int) -> str | None:
    if db.list_offers(hospital_id):
        return None
    now = datetime.now(timezone.utc)
    db.create_offer(
        hospital_id, name="Welcome to our storefront", discount_type="percentage", discount_value=15,
        coupon_code="WELCOME15", valid_from=now.isoformat(), valid_to=(now + timedelta(days=365)).isoformat(),
        min_order_value_paise=0, max_redemptions=None, fulfillment_type=None,
    )
    return "WELCOME15"


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.seed_web_storefront_demo <whatsapp_phone_number_id>")
        sys.exit(1)
    phone_number_id = sys.argv[1]
    hospital = db.find_hospital_by_phone_number_id(phone_number_id)
    if hospital is None:
        print(f"No hospital found with whatsapp_phone_number_id={phone_number_id!r}")
        sys.exit(1)

    images_set = seed_menu_images(hospital.id)
    storefront = seed_storefront_profile(hospital.id)
    coupon = seed_demo_coupon(hospital.id)

    print(f"Web Storefront demo-ready for {hospital.name} (hospital #{hospital.id}):")
    print(f"  - {images_set} menu item(s) got a placeholder photo")
    print(f"  - listed at /order/{storefront['slug']}")
    print(f"  - demo coupon: {coupon or '(already had one)'}")


if __name__ == "__main__":
    main()
