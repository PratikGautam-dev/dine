# tests/test_dashboard_and_fallback_menu.py
"""Portal dashboard + bot fallback menu, for table reservations.

- The dashboard's activity feed inner-joined `doctors`, so a table reservation
  (doctor_id NULL) never appeared in it, and the recent-reservations widget
  showed a blank "Table" (it only carried doctor_name).
- After a dead end (e.g. no tables for a party size) the bot fell back to a
  fixed four-item menu (no Order Food, old labels) instead of the tenant's
  real menu."""
import json
import os
from datetime import datetime

import pytest

os.environ.setdefault("WHATSAPP_ACCESS_TOKEN", "test")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "mytoken")
os.environ.setdefault("WHATSAPP_APP_SECRET", "appsecret")
os.environ.setdefault("INTERNAL_SECRET", "internalsecret")
os.environ.setdefault("PORTAL_SECRET", "test-portal-secret")

import connectors  # noqa: E402
import db.repository as db  # noqa: E402
from core.session_store import InMemorySessionStore  # noqa: E402
from db.connection import get_connection  # noqa: E402
from flows.booking.messages import _send_main_menu  # noqa: E402
from flows.booking.types.table_reservation import _handle_awaiting_table_section  # noqa: E402
from tests.test_table_reschedule import FakeWhatsAppClient, _portal_login, _reserve, _rows  # noqa: E402

PHONE = "5491112345678"


def _set_features(hospital_id: int, features: list[str]) -> None:
    conn = get_connection()
    conn.execute("UPDATE hospitals SET enabled_features = ? WHERE id = ?", (json.dumps(features), hospital_id))
    conn.commit()


def test_dashboard_activity_feed_and_recent_list_include_table_reservations(hospital_id):
    client, headers = _portal_login(hospital_id, "dash-pw")
    appt = _reserve(hospital_id, 4, department_id="cardiology")

    data = client.get("/api/portal/dashboard", headers=headers).json()

    feed = data["activity_feed"]
    assert len(feed) == 1, "a table reservation must appear in the activity feed"
    assert feed[0]["label"] == "Booked reservation"
    assert feed[0]["table_name"] == appt.table_name and feed[0]["party_size"] == 4
    assert feed[0]["doctor_name"] is None

    recent = data["recent_appointments"]
    assert recent[0]["table_name"] == appt.table_name and recent[0]["party_size"] == 4


def test_dashboard_feed_still_shows_legacy_doctor_appointments(hospital_id):
    client, headers = _portal_login(hospital_id, "dash-pw-2")
    slot = db.get_slots(hospital_id, "doc_card_1")[0]
    db.create_appointment(hospital_id, PHONE, "cardiology", "doc_card_1", datetime.fromisoformat(slot["id"]))

    feed = client.get("/api/portal/dashboard", headers=headers).json()["activity_feed"]
    assert len(feed) == 1
    assert feed[0]["doctor_name"] is not None and feed[0]["table_name"] is None


@pytest.mark.asyncio
async def test_fallback_menu_is_the_tenants_real_menu_with_order_food(hospital_id):
    _set_features(hospital_id, ["book_appointment", "order_food", "reschedule", "cancel", "view_appointments", "faq"])
    wa = FakeWhatsAppClient()

    await _send_main_menu(wa, PHONE, "the restaurant", "en", hospital_id=hospital_id)

    row_ids = {r["id"] for kind, kw in wa.sent if kind == "list" for r in _rows(kw)}
    assert {"menu_book", "menu_order_food", "menu_reschedule", "menu_cancel", "menu_view_appointments"} <= row_ids


@pytest.mark.asyncio
async def test_menu_after_a_failed_table_search_keeps_order_food(hospital_id):
    """The exact demo dead end: no availability for the party size."""
    _set_features(hospital_id, ["book_appointment", "order_food", "reschedule", "cancel"])
    db.update_restaurant_hours(hospital_id, [], [], 90, 30)  # nothing bookable
    wa, sessions = FakeWhatsAppClient(), InMemorySessionStore()
    connector = connectors.get_connector_for_hospital(db.get_hospital(hospital_id))

    await _handle_awaiting_table_section(
        wa, sessions, PHONE, hospital_id,
        {"type": "interactive_reply", "id": "no_section_preference", "title": ""},
        {"party_size": 4}, connector,
    )

    texts = [kw["text"] for kind, kw in wa.sent if kind == "text"]
    assert any("table available" in t for t in texts)
    row_ids = {r["id"] for kind, kw in wa.sent if kind == "list" for r in _rows(kw)}
    assert "menu_order_food" in row_ids, "the fallback menu must not drop features the restaurant enabled"


@pytest.mark.asyncio
async def test_fallback_menu_without_a_tenant_keeps_the_original_four_item_menu(hospital_id):
    wa = FakeWhatsAppClient()
    await _send_main_menu(wa, PHONE, "the restaurant", "en")
    row_ids = {r["id"] for kind, kw in wa.sent if kind == "list" for r in _rows(kw)}
    assert row_ids == {"menu_book", "menu_reschedule", "menu_cancel", "menu_faq"}
