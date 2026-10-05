# reminders/idle_followup.py
"""After a guest's flow ends and they go quiet, send one friendly follow-up after
IDLE_FOLLOWUP_DELAY_SECONDS. At most one per SESSION_TIMEOUT_SECONDS window, so a
conversation gets one nudge and a guest who returns later can be nudged again.

Timers live in this process's memory: a restart or redeploy drops pending follow-ups,
which is acceptable for a courtesy message. Run the app as a single worker."""
import asyncio
import logging
import time

from core.session_store import SESSION_TIMEOUT_SECONDS
from core.translations import t
from core.translations.common import IDLE_FOLLOWUP_TEXT

logger = logging.getLogger(__name__)

IDLE_FOLLOWUP_DELAY_SECONDS = 120

_pending: dict[tuple[int, str], asyncio.Task] = {}
_last_sent_at: dict[tuple[int, str], float] = {}


def cancel_idle_followup(hospital_id: int, phone: str) -> None:
    task = _pending.pop((hospital_id, phone), None)
    if task is not None:
        task.cancel()


def schedule_idle_followup(wa, sessions, hospital_id: int, phone: str, restaurant_name: str) -> None:
    cancel_idle_followup(hospital_id, phone)
    _pending[(hospital_id, phone)] = asyncio.create_task(
        _send_after_delay(wa, sessions, hospital_id, phone, restaurant_name)
    )


async def _send_after_delay(wa, sessions, hospital_id: int, phone: str, restaurant_name: str) -> None:
    key = (hospital_id, phone)
    try:
        await asyncio.sleep(IDLE_FOLLOWUP_DELAY_SECONDS)
    except asyncio.CancelledError:
        return
    finally:
        if _pending.get(key) is asyncio.current_task():
            _pending.pop(key, None)

    session = sessions.get(hospital_id, phone)
    if session.get("state") != "IDLE":
        return
    last_sent = _last_sent_at.get(key)
    if last_sent is not None and time.time() - last_sent < SESSION_TIMEOUT_SECONDS:
        return

    language = session.get("language") or "en"
    await wa.send_text(phone, t(IDLE_FOLLOWUP_TEXT, language, restaurant_name=restaurant_name))
    _last_sent_at[key] = time.time()
    logger.info("Idle follow-up sent to %s (hospital %s)", phone, hospital_id)
