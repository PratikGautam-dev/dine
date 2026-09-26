#!/usr/bin/env python3
"""Rounds out Daaprime's (hospital #3) mock data for the pages attendance-seeding didn't touch:
a few more Customers, a livelier WhatsApp Inbox, and a backfilled Automations activity feed.
Idempotent by construction -- guarded on phone numbers / feedback ids this exact script already
used, so re-running it is a no-op the second time.

Usage:
    DATABASE_URL="..." python -m scripts.seed_portal_mock_data
"""
from sqlalchemy import text

import db.repository as db
from db.connection import get_session

HOSPITAL_ID = 3

# --- Customers: a handful more, full profile so the Customers/Messages panels have real numbers to show. ---
NEW_PATIENTS = [
    # phone, name, age, gender, loyalty_tier, dietary_preference, favorite_item, total_orders, total_spend_paise
    ("919812345601", "Rohan Malhotra", 34, "Male", "Gold", "Non-Vegetarian", "Chicken Biryani", 14, 298000),
    ("919812345602", "Ishita Sharma", 27, "Female", "Silver", "Vegetarian", "Dal Makhani", 7, 142000),
    ("919812345603", "Vikram Desai", 41, "Male", "Bronze", "Non-Vegetarian", "Butter Chicken", 4, 87000),
    ("919812345604", "Ananya Krishnan", 30, "Female", "VIP", "Vegetarian", "Paneer Butter Masala", 22, 465000),
    ("919812345605", "Farhan Sheikh", 25, "Male", None, "Non-Vegetarian", None, 1, 26320),
]

# --- WhatsApp Inbox: a few more conversations, mixed open/resolved and patient_requested/system_error. ---
NEW_HANDOFFS = [
    # phone, reason, inbound message, outbound reply (None = left open, no reply yet)
    ("919812345601", "patient_requested", "Can you add extra spicy for the Chicken 65 in my order?", "Done -- noted extra spicy on your order, it'll go out with your next one too if you'd like."),
    ("919812345602", "patient_requested", "Is the Dal Makhani vegan or does it have cream?", None),
    ("919812345603", "system_error", None, None),
    ("919812345604", "patient_requested", "Can I book the Patio for 8 people this Saturday evening?", "Yes! I've held P3 + P2 together for 8 on Saturday -- confirmed."),
    ("919812345605", "patient_requested", "My payment link isn't opening, can you resend it?", "Just resent it -- should be in your WhatsApp now."),
]


def main() -> None:
    s = get_session()

    added_patients = 0
    for phone, name, age, gender, tier, diet, fav, orders, spend in NEW_PATIENTS:
        exists = s.execute(text("SELECT 1 FROM patients WHERE hospital_id = :h AND phone = :p"), {"h": HOSPITAL_ID, "p": phone}).fetchone()
        if exists:
            continue
        db.create_patient_profile(HOSPITAL_ID, phone, name, age, relationship_label="Self", gender=gender)
        s.execute(
            text(
                "UPDATE patients SET loyalty_tier = :t, dietary_preference = :d, favorite_item = :f, "
                "total_orders = :o, total_spend_paise = :sp WHERE hospital_id = :h AND phone = :p"
            ),
            {"t": tier, "d": diet, "f": fav, "o": orders, "sp": spend, "h": HOSPITAL_ID, "p": phone},
        )
        added_patients += 1

    added_handoffs = 0
    for phone, reason, inbound, outbound in NEW_HANDOFFS:
        exists = s.execute(
            text("SELECT 1 FROM handoff_requests WHERE hospital_id = :h AND phone = :p AND reason = :r"),
            {"h": HOSPITAL_ID, "p": phone, "r": reason},
        ).fetchone()
        if exists:
            continue
        req = db.create_handoff_request(HOSPITAL_ID, phone, reason, inbound)
        if outbound:
            db.add_handoff_message(HOSPITAL_ID, req["id"], "outbound", outbound)
            db.resolve_handoff_request(HOSPITAL_ID, req["id"], resolved_by="seed")
        added_handoffs += 1

    # Automations: the 7 existing feedback rows predate any real feedback_received automation run
    # (they were inserted directly, not through the live WhatsApp flow) -- backfill one run each,
    # matching what the real flow would have done, so the Automations page's activity feed isn't empty.
    automation = s.execute(
        text("SELECT id FROM automations WHERE hospital_id = :h AND trigger_event = 'feedback_received' LIMIT 1"),
        {"h": HOSPITAL_ID},
    ).fetchone()
    added_runs = 0
    if automation:
        rows = s.execute(text("SELECT id, phone, created_at FROM feedback WHERE hospital_id = :h"), {"h": HOSPITAL_ID}).fetchall()
        for fb_id, phone, created_at in rows:
            exists = s.execute(
                text("SELECT 1 FROM automation_runs WHERE hospital_id = :h AND automation_id = :a AND phone = :p AND ran_at = :ra"),
                {"h": HOSPITAL_ID, "a": automation.id, "p": phone, "ra": created_at},
            ).fetchone()
            if not exists:
                s.execute(
                    text("INSERT INTO automation_runs (automation_id, hospital_id, phone, ran_at) VALUES (:a, :h, :p, :ra)"),
                    {"a": automation.id, "h": HOSPITAL_ID, "p": phone, "ra": created_at},
                )
                added_runs += 1

    s.commit()
    print(f"Added {added_patients} patients, {added_handoffs} handoff conversations, {added_runs} automation runs.")


if __name__ == "__main__":
    main()
