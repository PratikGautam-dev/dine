#!/usr/bin/env python3
"""One-shot, non-destructive: creates a single demo restaurant tenant +
portal admin login on whatever DATABASE_URL is set when this runs. Unlike
scripts/seed_dev_rbac.py, this does NOT delete any existing hospitals,
staff, or super-admin rows -- it only INSERTs the one new tenant and its
one admin login, and exits without creating anything if a hospital with
DEMO_WHATSAPP_PHONE_NUMBER_ID already exists (safe to re-run).

Usage:
    DATABASE_URL="..." python -m scripts.seed_demo_restaurant_prod
"""
import db.repository as db
from db.repositories.hospitals import hash_portal_password
from portal.capabilities import resolve_default_capabilities
from portal.permissions import DEFAULT_PERMISSIONS_BY_ROLE, resolve_default_permissions

DEMO_HOSPITAL_NAME = "Dine Connect Demo"
DEMO_WHATSAPP_PHONE_NUMBER_ID = "dine-connect-demo-000001"

ADMIN_EMAIL = "demo@dineconnect.app"
ADMIN_PASSWORD = "DemoRestaurant@123"
ADMIN_NAME = "Demo Restaurant Admin"


def main() -> None:
    existing = [h for h in db.get_all_hospitals() if h.whatsapp_phone_number_id == DEMO_WHATSAPP_PHONE_NUMBER_ID]
    if existing:
        hospital = existing[0]
        print(f"Demo hospital already exists: #{hospital.id} {hospital.name!r} -- not creating a duplicate.")
    else:
        hospital = db.create_hospital(
            DEMO_HOSPITAL_NAME,
            DEMO_WHATSAPP_PHONE_NUMBER_ID,
            enabled_features=["book_appointment", "order_food", "reschedule", "cancel", "view_appointments", "manage_patients", "faq"],
            admin_capabilities=resolve_default_capabilities("hospital"),
        )
        print(f"Created hospital #{hospital.id}: {hospital.name}")

    existing_staff = db.get_staff_user_by_email(ADMIN_EMAIL)
    if existing_staff:
        print(f"Admin login already exists: {existing_staff['email']} (hospital {existing_staff['hospital_id']}) -- not creating a duplicate.")
    else:
        staff = db.create_staff_user(hospital.id, "admin", ADMIN_EMAIL, hash_portal_password(ADMIN_PASSWORD), ADMIN_NAME)
        print(f"Created admin login #{staff['id']}: {staff['email']} (hospital {hospital.id})")

    rows = [
        {"role": role, "page_key": page_key, "can_view": actions["view"], "can_write": actions["write"], "can_delete": actions["delete"]}
        for role in DEFAULT_PERMISSIONS_BY_ROLE
        for page_key, actions in resolve_default_permissions(role).items()
    ]
    db.upsert_role_permissions(hospital.id, rows)
    print(f"Seeded default role_permissions for hospital {hospital.id} (idempotent upsert).")

    print()
    print("=" * 60)
    print("Demo restaurant portal login (/portal/login, staff login tab):")
    print(f"  email:    {ADMIN_EMAIL}")
    print(f"  password: {ADMIN_PASSWORD}")
    print(f"  hospital: #{hospital.id} {hospital.name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
