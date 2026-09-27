# db/repositories/message_log.py
"""Real send/receive counts for the Messages & Automations page (migration 0052) -- written from
core/whatsapp.py's WhatsAppClient (outbound, one row per send attempt) and webhook/dispatch.py's
_process_message() (inbound, one row per message received). No delivered/read status exists
(that needs Meta's own status-callback webhook); "sent" means the WhatsApp API accepted the
request, not that the guest's phone displayed it."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import MessageLog


def record_message(hospital_id: int, direction: str, status: str | None = None) -> None:
    if direction not in ("inbound", "outbound"):
        raise ValueError(f"direction must be 'inbound' or 'outbound', got {direction!r}")
    session = get_session()
    session.execute(
        MessageLog.__table__.insert().values(
            hospital_id=hospital_id, direction=direction, status=status,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    session.commit()


def get_message_analytics(hospital_id: int, days: int = 7, now: datetime | None = None) -> dict:
    """A `days`-length daily trend (sent/failed/received) plus totals over that window -- shape
    matches what the Messages & Automations page's Performance Analytics card renders."""
    now = now or datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)
    session = get_session()
    rows = session.execute(
        select(MessageLog.direction, MessageLog.status, MessageLog.created_at)
        .where(MessageLog.hospital_id == hospital_id, MessageLog.created_at >= period_start.isoformat())
    ).all()

    by_day: dict[str, dict[str, int]] = {}
    totals = {"sent": 0, "failed": 0, "received": 0}
    for direction, status, created_at in rows:
        day = created_at[:10]
        entry = by_day.setdefault(day, {"sent": 0, "failed": 0, "received": 0})
        if direction == "outbound" and status == "sent":
            entry["sent"] += 1
            totals["sent"] += 1
        elif direction == "outbound" and status == "failed":
            entry["failed"] += 1
            totals["failed"] += 1
        elif direction == "inbound":
            entry["received"] += 1
            totals["received"] += 1

    trend = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        entry = by_day.get(day, {"sent": 0, "failed": 0, "received": 0})
        trend.append({"date": day, "label": (now - timedelta(days=i)).strftime("%d %b"), **entry})

    total_sends = totals["sent"] + totals["failed"]
    send_success_rate = round((totals["sent"] / total_sends) * 100, 1) if total_sends else None

    return {
        "trend": trend,
        "totals": totals,
        "send_success_rate": send_success_rate,
        "period_days": days,
    }
