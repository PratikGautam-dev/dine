# db/repositories/payments.py
"""Payments + refunds (migration 0056) -- a structured payment record per order, additive
alongside food_orders' own razorpay_order_id/razorpay_payment_id/razorpay_payment_link_url/
mock_payment_ref columns (that migration's own docstring explains why those stay untouched: this
is a live payment system, dropping columns mid-flight is a separate, more careful pass). Every
real write path (create_razorpay_payment/mark_order_paid_mock in their own repository modules)
calls into this one too -- the two representations are kept in sync, not one replacing the
other, for this phase."""
from datetime import datetime, timezone

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import Payment, Refund

_PAYMENT_COLUMNS = (
    Payment.id, Payment.hospital_id, Payment.branch_id, Payment.order_id, Payment.method,
    Payment.provider, Payment.status, Payment.amount_paise, Payment.provider_payment_id,
    Payment.provider_order_id, Payment.payment_link_url, Payment.idempotency_key,
    Payment.paid_at, Payment.created_at, Payment.updated_at,
)

STATUS_PENDING = "pending"
STATUS_PAID = "paid"
STATUS_FAILED = "failed"


def create_payment(
    hospital_id: int, branch_id: str, order_id: int, method: str, amount_paise: int,
    provider: str | None = None, provider_order_id: str | None = None, payment_link_url: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """One row per payment ATTEMPT, status='pending' until mark_payment_paid()/mark_payment_failed()
    runs. idempotency_key, when given, is unique per hospital -- a retried call with the SAME key
    returns the existing row instead of creating a duplicate (same "don't mint a second Razorpay
    link for the same order" discipline create_razorpay_payment() already follows at the
    food_orders-column level)."""
    session = get_session()
    if idempotency_key is not None:
        existing = session.execute(
            select(*_PAYMENT_COLUMNS).where(Payment.hospital_id == hospital_id, Payment.idempotency_key == idempotency_key)
        ).first()
        if existing is not None:
            return dict(existing._mapping)
    now = datetime.now(timezone.utc).isoformat()
    result = session.execute(
        Payment.__table__.insert().values(
            hospital_id=hospital_id, branch_id=branch_id, order_id=order_id, method=method,
            provider=provider, status=STATUS_PENDING, amount_paise=amount_paise,
            provider_order_id=provider_order_id, payment_link_url=payment_link_url,
            idempotency_key=idempotency_key, created_at=now, updated_at=now,
        ).returning(Payment.id)
    )
    new_id = result.scalar_one()
    session.commit()
    row = session.execute(select(*_PAYMENT_COLUMNS).where(Payment.id == new_id)).one()
    return dict(row._mapping)


def get_payment(hospital_id: int, payment_id: int) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_PAYMENT_COLUMNS).where(Payment.hospital_id == hospital_id, Payment.id == payment_id)
    ).first()
    return dict(row._mapping) if row else None


def get_latest_payment_for_order(hospital_id: int, order_id: int) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_PAYMENT_COLUMNS)
        .where(Payment.hospital_id == hospital_id, Payment.order_id == order_id)
        .order_by(Payment.id.desc())
    ).first()
    return dict(row._mapping) if row else None


def mark_payment_paid(hospital_id: int, payment_id: int, provider_payment_id: str | None = None) -> dict | None:
    session = get_session()
    now = datetime.now(timezone.utc).isoformat()
    result = session.execute(
        Payment.__table__.update()
        .where(Payment.hospital_id == hospital_id, Payment.id == payment_id, Payment.status == STATUS_PENDING)
        .values(status=STATUS_PAID, provider_payment_id=provider_payment_id, paid_at=now, updated_at=now)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return get_payment(hospital_id, payment_id)


def mark_payment_failed(hospital_id: int, payment_id: int) -> dict | None:
    session = get_session()
    now = datetime.now(timezone.utc).isoformat()
    result = session.execute(
        Payment.__table__.update()
        .where(Payment.hospital_id == hospital_id, Payment.id == payment_id, Payment.status == STATUS_PENDING)
        .values(status=STATUS_FAILED, updated_at=now)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return get_payment(hospital_id, payment_id)


def list_refunds_for_payment(hospital_id: int, payment_id: int) -> list[dict]:
    """Oldest first -- a payment can have more than one partial refund."""
    session = get_session()
    rows = session.execute(
        select(
            Refund.id, Refund.hospital_id, Refund.payment_id, Refund.amount_paise, Refund.reason,
            Refund.provider_refund_id, Refund.status, Refund.created_by, Refund.created_at,
        ).where(Refund.hospital_id == hospital_id, Refund.payment_id == payment_id).order_by(Refund.id.asc())
    ).all()
    return [dict(r._mapping) for r in rows]


def create_refund(
    hospital_id: int, payment_id: int, amount_paise: int, reason: str | None = None,
    created_by: str | None = None,
) -> dict:
    """Table + this one function only, this phase -- no portal refund UI/workflow yet (confirmed
    scope: a follow-up, not auto-built). status stays 'pending' until a real refund-provider
    integration exists to confirm it; nothing reads/enforces this status today."""
    session = get_session()
    now = datetime.now(timezone.utc).isoformat()
    result = session.execute(
        Refund.__table__.insert().values(
            hospital_id=hospital_id, payment_id=payment_id, amount_paise=amount_paise,
            reason=reason, status="pending", created_by=created_by, created_at=now,
        ).returning(Refund.id)
    )
    new_id = result.scalar_one()
    session.commit()
    row = session.execute(
        select(
            Refund.id, Refund.hospital_id, Refund.payment_id, Refund.amount_paise, Refund.reason,
            Refund.provider_refund_id, Refund.status, Refund.created_by, Refund.created_at,
        ).where(Refund.id == new_id)
    ).one()
    return dict(row._mapping)
