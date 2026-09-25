# db/repositories/feedback.py
"""Minimal WhatsApp guest feedback (migration 0045) -- a guest picks 1-5 stars from the
"Rate & Give Feedback" main-menu row (flows/router.py's give_feedback dispatch), which is the
one real write path today. No sentiment analysis, NPS or complaint-category system exists --
the Feedback portal page reads exactly this table, nothing derived or invented on top."""
from datetime import datetime, timezone

from sqlalchemy import func, insert, select

from db.connection import get_session
from db.orm_models import Feedback, PatientRow


def create_feedback(hospital_id: int, phone: str, rating: int, comment: str | None = None, patient_id: int | None = None) -> dict:
    if rating not in (1, 2, 3, 4, 5):
        raise ValueError(f"rating must be 1-5, got {rating!r}")
    session = get_session()
    row = session.execute(
        insert(Feedback)
        .values(
            hospital_id=hospital_id, patient_id=patient_id, phone=phone, rating=rating, comment=comment,
            source="whatsapp", created_at=datetime.now(timezone.utc).isoformat(),
        )
        .returning(Feedback.id, Feedback.created_at)
    ).first()
    session.commit()
    assert row is not None
    return {
        "id": row.id, "hospital_id": hospital_id, "patient_id": patient_id, "phone": phone,
        "rating": rating, "comment": comment, "source": "whatsapp", "created_at": row.created_at,
    }


def list_feedback(hospital_id: int, limit: int = 200) -> list[dict]:
    """Newest first, with the guest's name from their profile at this restaurant (same
    "resolve name off patients, not stored on the row" pattern as handoffs/appointments)."""
    session = get_session()
    rows = session.execute(
        select(
            Feedback.id, Feedback.phone, Feedback.rating, Feedback.comment, Feedback.source,
            Feedback.created_at, Feedback.patient_id, PatientRow.name.label("patient_name"),
        )
        .select_from(Feedback)
        .outerjoin(PatientRow, PatientRow.id == Feedback.patient_id)
        .where(Feedback.hospital_id == hospital_id)
        .order_by(Feedback.created_at.desc())
        .limit(limit)
    ).all()
    return [dict(r._mapping) for r in rows]


def get_feedback_summary(hospital_id: int) -> dict:
    """Average rating, total count, and the 1-5 breakdown -- everything the Feedback page's
    KPI tiles and rating-breakdown card need, computed directly (not cached/denormalized)."""
    session = get_session()
    total = session.execute(select(func.count(Feedback.id)).where(Feedback.hospital_id == hospital_id)).scalar_one()
    avg = session.execute(select(func.avg(Feedback.rating)).where(Feedback.hospital_id == hospital_id)).scalar_one()
    breakdown_rows = session.execute(
        select(Feedback.rating, func.count(Feedback.id))
        .where(Feedback.hospital_id == hospital_id)
        .group_by(Feedback.rating)
    ).all()
    breakdown = {r: 0 for r in (1, 2, 3, 4, 5)}
    for rating, count in breakdown_rows:
        breakdown[rating] = count
    return {
        "total": total,
        "average_rating": round(float(avg), 1) if avg is not None else None,
        "breakdown": breakdown,
    }
