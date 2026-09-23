# db/repositories/waitlist.py
"""Table Bookings follow-up: the walk-in/waitlist queue (migration 0041's waitlist_entries table).
A walk-in party waiting for a table -- deliberately NOT an appointments row (no scheduled_at, no
reservation): "assign" seats a REAL table (tables.py's set_table_status(), reused as-is) and closes
the entry, it never creates a booking."""
from datetime import datetime

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import WaitlistEntry
from db.repositories.tables import STATUS_FREE, set_table_status

STATUS_WAITING = "waiting"
STATUS_ASSIGNED = "assigned"
STATUS_CANCELLED = "cancelled"

_COLUMNS = (
    WaitlistEntry.id, WaitlistEntry.hospital_id, WaitlistEntry.guest_name, WaitlistEntry.phone,
    WaitlistEntry.party_size, WaitlistEntry.status, WaitlistEntry.created_at,
    WaitlistEntry.assigned_table_id, WaitlistEntry.assigned_at, WaitlistEntry.assigned_by,
)


def list_waitlist(hospital_id: int, status: str | None = STATUS_WAITING) -> list[dict]:
    """status=STATUS_WAITING (default) is the actual work queue; status=None returns every entry
    (today's already-assigned/cancelled ones included) for a staff member reviewing history."""
    session = get_session()
    stmt = select(*_COLUMNS).where(WaitlistEntry.hospital_id == hospital_id)
    if status is not None:
        stmt = stmt.where(WaitlistEntry.status == status)
    rows = session.execute(stmt.order_by(WaitlistEntry.created_at)).all()
    return [dict(r._mapping) for r in rows]


def add_to_waitlist(hospital_id: int, guest_name: str, party_size: int, phone: str | None = None) -> dict:
    session = get_session()
    result = session.execute(
        WaitlistEntry.__table__.insert().values(
            hospital_id=hospital_id, guest_name=guest_name, phone=phone, party_size=party_size,
            status=STATUS_WAITING, created_at=datetime.now().isoformat(),
        ).returning(WaitlistEntry.id)
    )
    new_id = result.scalar_one()
    session.commit()
    row = session.execute(select(*_COLUMNS).where(WaitlistEntry.id == new_id)).one()
    return dict(row._mapping)


def assign_waitlist_entry(hospital_id: int, entry_id: int, table_id: str, assigned_by: str | None = None) -> dict | None:
    """Guarded on two fronts: the waitlist entry must still be 'waiting' (not already assigned/
    cancelled by someone else) AND the table must still be 'free' (set_table_status()'s own guard) --
    returns None if either lost the race, same no-op-is-not-an-error contract every other guarded
    transition in this codebase follows. Seats the table for real (tables.py's set_table_status(),
    the same action the Live Operations floor grid uses) rather than a parallel "assigned" concept."""
    session = get_session()
    seated = set_table_status(hospital_id, table_id, "occupied", expected_status=STATUS_FREE)
    if seated is None:
        return None
    result = session.execute(
        WaitlistEntry.__table__.update()
        .where(WaitlistEntry.id == entry_id, WaitlistEntry.hospital_id == hospital_id, WaitlistEntry.status == STATUS_WAITING)
        .values(status=STATUS_ASSIGNED, assigned_table_id=table_id, assigned_at=datetime.now().isoformat(), assigned_by=assigned_by)
    )
    if result.rowcount == 0:
        # The waitlist entry lost the race after we already seated the table -- undo the seat so the
        # table isn't left occupied for an assignment that didn't actually happen. (The ORM engine
        # runs in autocommit -- set_table_status()'s own UPDATE above already committed, so this is a
        # genuine compensating action, not a rollback.)
        set_table_status(hospital_id, table_id, STATUS_FREE, expected_status="occupied")
        return None
    session.commit()
    row = session.execute(select(*_COLUMNS).where(WaitlistEntry.id == entry_id)).one()
    return dict(row._mapping)


def cancel_waitlist_entry(hospital_id: int, entry_id: int) -> bool:
    session = get_session()
    result = session.execute(
        WaitlistEntry.__table__.update()
        .where(WaitlistEntry.id == entry_id, WaitlistEntry.hospital_id == hospital_id, WaitlistEntry.status == STATUS_WAITING)
        .values(status=STATUS_CANCELLED)
    )
    session.commit()
    return result.rowcount > 0
