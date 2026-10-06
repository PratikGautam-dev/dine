# db/repositories/addresses.py
"""Saved delivery addresses for WhatsApp customers (migration 0064)."""
from datetime import datetime, timezone

from sqlalchemy import delete, func, select

from db.connection import get_session
from db.orm_models import CustomerAddress

MAX_SAVED_ADDRESSES = 5


def list_addresses(hospital_id: int, phone: str) -> list[dict]:
    session = get_session()
    rows = session.execute(
        select(CustomerAddress.id, CustomerAddress.address)
        .where(CustomerAddress.hospital_id == hospital_id, CustomerAddress.phone == phone)
        .order_by(CustomerAddress.id)
    ).all()
    return [{"id": r.id, "address": r.address} for r in rows]


def add_address(hospital_id: int, phone: str, address: str) -> dict | None:
    """Saves the address unless it's already saved. Returns None when the customer already has the
    maximum, so the caller can tell them to remove one first."""
    address = address.strip()
    existing = list_addresses(hospital_id, phone)
    for row in existing:
        if row["address"].lower() == address.lower():
            return row
    if len(existing) >= MAX_SAVED_ADDRESSES:
        return None
    session = get_session()
    new_row = CustomerAddress(
        hospital_id=hospital_id, phone=phone, address=address, created_at=datetime.now(timezone.utc).isoformat(),
    )
    session.add(new_row)
    session.commit()
    return {"id": new_row.id, "address": address}


def delete_address(hospital_id: int, phone: str, address_id: int) -> bool:
    session = get_session()
    result = session.execute(
        delete(CustomerAddress).where(
            CustomerAddress.hospital_id == hospital_id, CustomerAddress.phone == phone, CustomerAddress.id == address_id,
        )
    )
    session.commit()
    return result.rowcount > 0


def count_addresses(hospital_id: int, phone: str) -> int:
    session = get_session()
    return session.execute(
        select(func.count()).select_from(CustomerAddress).where(
            CustomerAddress.hospital_id == hospital_id, CustomerAddress.phone == phone,
        )
    ).scalar_one()
