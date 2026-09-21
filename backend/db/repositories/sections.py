# db/repositories/sections.py
"""Restaurant sections (the `departments` table, migration 0038 added a display order): a managed, ordered list
that tables belong to. Guests see the sections in this order on WhatsApp (get_departments orders by it too).

Names are unique per restaurant ignoring case and surrounding spaces -- "Patio" and "patio " are the same section --
because the WhatsApp section list would otherwise show two near-identical rows."""
import sqlalchemy.exc
from sqlalchemy import delete, func, select, update

from db.connection import get_session
from db.orm_models import Department, DoctorRow, TableRow
from db.repositories.doctors import create_department


def list_sections(hospital_id: int) -> list[dict]:
    """Sections in display order, each with how many tables it holds (so the UI can say why a delete is refused)."""
    session = get_session()
    rows = session.execute(
        select(Department.id, Department.name, Department.sort_order, func.count(TableRow.id).label("table_count"))
        .outerjoin(TableRow, (TableRow.department_id == Department.id) & (TableRow.hospital_id == hospital_id))
        .where(Department.hospital_id == hospital_id)
        .group_by(Department.id, Department.name, Department.sort_order)
        .order_by(Department.sort_order, Department.name)
    ).all()
    return [dict(r._mapping) for r in rows]


def _name_taken(hospital_id: int, name: str, exclude_id: str | None = None) -> bool:
    session = get_session()
    stmt = select(Department.id).where(
        Department.hospital_id == hospital_id, func.lower(func.trim(Department.name)) == name.strip().lower()
    )
    if exclude_id:
        stmt = stmt.where(Department.id != exclude_id)
    return session.execute(stmt).first() is not None


def create_section(hospital_id: int, name: str) -> dict | None:
    """None when the name is already used (case-insensitively); otherwise the new section, added at the end."""
    name = name.strip()
    if _name_taken(hospital_id, name):
        return None
    return create_department(hospital_id, name)


def rename_section(hospital_id: int, section_id: str, name: str) -> str:
    """'ok' | 'not_found' | 'duplicate'."""
    name = name.strip()
    session = get_session()
    exists = session.execute(
        select(Department.id).where(Department.hospital_id == hospital_id, Department.id == section_id)
    ).first()
    if exists is None:
        return "not_found"
    if _name_taken(hospital_id, name, exclude_id=section_id):
        return "duplicate"
    session.execute(
        update(Department).where(Department.hospital_id == hospital_id, Department.id == section_id).values(name=name)
    )
    session.commit()
    return "ok"


def move_section(hospital_id: int, section_id: str, direction: str) -> str:
    """Swaps a section with its neighbour ('up' = earlier). Renumbers 1..n first so ties or unset (0) orders can't
    make a swap a no-op. 'ok' | 'not_found' | 'edge' (already first/last)."""
    session = get_session()
    ordered = [r[0] for r in session.execute(
        select(Department.id).where(Department.hospital_id == hospital_id).order_by(Department.sort_order, Department.name, Department.id)
    ).all()]
    if section_id not in ordered:
        return "not_found"
    i = ordered.index(section_id)
    j = i - 1 if direction == "up" else i + 1
    if j < 0 or j >= len(ordered):
        return "edge"
    ordered[i], ordered[j] = ordered[j], ordered[i]
    for position, sid in enumerate(ordered, start=1):
        session.execute(
            update(Department).where(Department.hospital_id == hospital_id, Department.id == sid).values(sort_order=position)
        )
    session.commit()
    return "ok"


def delete_section(hospital_id: int, section_id: str) -> str:
    """'ok' | 'not_found' | 'in_use'. A section that still holds tables or staff is never deleted (bookings and
    reservations reference it too; the database's foreign keys are the final guard)."""
    session = get_session()
    exists = session.execute(
        select(Department.id).where(Department.hospital_id == hospital_id, Department.id == section_id)
    ).first()
    if exists is None:
        return "not_found"
    in_use = session.execute(
        select(func.count()).select_from(TableRow).where(TableRow.hospital_id == hospital_id, TableRow.department_id == section_id)
    ).scalar_one() or session.execute(
        select(func.count()).select_from(DoctorRow).where(DoctorRow.hospital_id == hospital_id, DoctorRow.department_id == section_id)
    ).scalar_one()
    if in_use:
        return "in_use"
    try:
        session.execute(delete(Department).where(Department.hospital_id == hospital_id, Department.id == section_id))
        session.commit()
    except sqlalchemy.exc.IntegrityError:
        session.rollback()
        return "in_use"
    return "ok"
