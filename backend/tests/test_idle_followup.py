# tests/test_idle_followup.py
"""Idle follow-up: one courtesy message after a flow ends and the guest goes quiet."""
import asyncio

import pytest

import reminders.idle_followup as idle
from core.translations.common import IDLE_FOLLOWUP_TEXT
from core.translations import t


class _Wa:
    def __init__(self):
        self.sent = []

    async def send_text(self, to, text):
        self.sent.append((to, text))


class _Sessions:
    def __init__(self, state, language=None):
        self.state = state
        self.language = language

    def get(self, hospital_id, phone, timeout_seconds=None):
        return {"state": self.state, "language": self.language}


@pytest.fixture(autouse=True)
def _no_delay(monkeypatch):
    monkeypatch.setattr(idle, "IDLE_FOLLOWUP_DELAY_SECONDS", 0)
    idle._pending.clear()
    idle._last_sent_at.clear()


async def test_sends_once_when_idle_after_flow(hospital_id):
    wa, sessions = _Wa(), _Sessions("IDLE")
    idle.schedule_idle_followup(wa, sessions, hospital_id, "919999000001", "Dine Connect")
    await asyncio.sleep(0.05)
    assert len(wa.sent) == 1
    assert wa.sent[0][1] == t(IDLE_FOLLOWUP_TEXT, "en", restaurant_name="Dine Connect")
    assert "Dine Connect" in wa.sent[0][1] and "{restaurant_name}" not in wa.sent[0][1]


async def test_does_not_send_when_guest_is_mid_flow(hospital_id):
    wa, sessions = _Wa(), _Sessions("AWAITING_SLOT")
    idle.schedule_idle_followup(wa, sessions, hospital_id, "919999000002", "Dine Connect")
    await asyncio.sleep(0.05)
    assert wa.sent == []


async def test_cancel_prevents_the_message(hospital_id, monkeypatch):
    monkeypatch.setattr(idle, "IDLE_FOLLOWUP_DELAY_SECONDS", 60)
    wa, sessions = _Wa(), _Sessions("IDLE")
    idle.schedule_idle_followup(wa, sessions, hospital_id, "919999000003", "Dine Connect")
    idle.cancel_idle_followup(hospital_id, "919999000003")
    await asyncio.sleep(0.05)
    assert wa.sent == []


async def test_no_repeat_inside_the_session_window(hospital_id):
    wa, sessions = _Wa(), _Sessions("IDLE")
    idle.schedule_idle_followup(wa, sessions, hospital_id, "919999000004", "Dine Connect")
    await asyncio.sleep(0.05)
    idle.schedule_idle_followup(wa, sessions, hospital_id, "919999000004", "Dine Connect")
    await asyncio.sleep(0.05)
    assert len(wa.sent) == 1
