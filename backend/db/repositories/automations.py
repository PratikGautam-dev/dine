# db/repositories/automations.py
"""Automations (migration 0047): real trigger -> WhatsApp message rules. Only
trigger_event='feedback_received' is actually wired today (flows/router.py's give_feedback
dispatch calls get_active_automation()/record_automation_run() around its existing thank-you
send) -- see docs/Spec.md's "Messages & Automations" note for the rest of the phased plan.
Adding a trigger_event value here without also wiring a real dispatch call site for it would be
exactly the kind of decorative-only feature this table was built to stop being."""
from datetime import datetime, timezone

from sqlalchemy import func, insert, select

from db.connection import get_session
from db.orm_models import Automation, AutomationRun

TRIGGER_EVENTS = ("feedback_received",)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _automation_to_dict(row: Automation) -> dict:
    return {
        "id": row.id, "name": row.name, "trigger_event": row.trigger_event, "message_text": row.message_text,
        "delay_minutes": row.delay_minutes, "is_active": row.is_active, "created_at": row.created_at,
    }


def create_automation(
    hospital_id: int, name: str, trigger_event: str, message_text: str, delay_minutes: int = 0,
) -> dict:
    if trigger_event not in TRIGGER_EVENTS:
        raise ValueError(f"trigger_event must be one of {TRIGGER_EVENTS}, got {trigger_event!r}")
    if not name.strip() or not message_text.strip():
        raise ValueError("name and message_text are required.")
    session = get_session()
    new_id = session.execute(
        insert(Automation).values(
            hospital_id=hospital_id, name=name.strip(), trigger_event=trigger_event,
            message_text=message_text.strip(), delay_minutes=max(0, delay_minutes), is_active=True,
            created_at=_now_iso(),
        ).returning(Automation.id)
    ).scalar_one()
    session.commit()
    return get_automation(hospital_id, new_id)  # type: ignore[return-value]


def get_automation(hospital_id: int, automation_id: int) -> dict | None:
    session = get_session()
    row = session.execute(
        select(Automation).where(Automation.hospital_id == hospital_id, Automation.id == automation_id)
    ).scalar_one_or_none()
    return _automation_to_dict(row) if row else None


def list_automations(hospital_id: int) -> list[dict]:
    """Every automation plus its real, live run count (never a stored counter)."""
    session = get_session()
    rows = session.execute(
        select(Automation).where(Automation.hospital_id == hospital_id).order_by(Automation.created_at.desc())
    ).scalars().all()
    if not rows:
        return []
    run_counts = dict(session.execute(
        select(AutomationRun.automation_id, func.count(AutomationRun.id))
        .where(AutomationRun.hospital_id == hospital_id)
        .group_by(AutomationRun.automation_id)
    ).all())
    return [{**_automation_to_dict(r), "run_count": run_counts.get(r.id, 0)} for r in rows]


def update_automation(hospital_id: int, automation_id: int, is_active: bool | None = None) -> dict | None:
    if is_active is None:
        return get_automation(hospital_id, automation_id)
    session = get_session()
    result = session.execute(
        Automation.__table__.update().where(Automation.hospital_id == hospital_id, Automation.id == automation_id).values(is_active=is_active)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return get_automation(hospital_id, automation_id)


def get_active_automation(hospital_id: int, trigger_event: str) -> dict | None:
    """The real dispatch-time lookup -- the most recently created active automation for this
    trigger, or None if the hospital hasn't configured one (callers keep their existing
    hardcoded-text fallback in that case, so a hospital that's never touched this page sees zero
    behavior change)."""
    session = get_session()
    row = session.execute(
        select(Automation)
        .where(Automation.hospital_id == hospital_id, Automation.trigger_event == trigger_event, Automation.is_active.is_(True))
        .order_by(Automation.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return _automation_to_dict(row) if row else None


def record_automation_run(hospital_id: int, automation_id: int, phone: str) -> None:
    session = get_session()
    session.execute(insert(AutomationRun).values(automation_id=automation_id, hospital_id=hospital_id, phone=phone, ran_at=_now_iso()))
    session.commit()
