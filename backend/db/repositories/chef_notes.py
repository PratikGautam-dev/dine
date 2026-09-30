# db/repositories/chef_notes.py
"""Kitchen Orders (KDS) follow-up: a small, real shared notes board for kitchen staff -- migration
0043's chef_notes table. Attributed to whoever actually posted it (the logged-in staff member's own
name, passed in by the caller), never an invented persona."""
from datetime import datetime

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import ChefNote

_COLUMNS = (ChefNote.id, ChefNote.branch_id, ChefNote.text, ChefNote.created_by_name, ChefNote.created_at)


def list_chef_notes(hospital_id: int, limit: int = 20, branch_id: str | None = None) -> list[dict]:
    session = get_session()
    stmt = select(*_COLUMNS).where(ChefNote.hospital_id == hospital_id)
    if branch_id is not None:
        stmt = stmt.where(ChefNote.branch_id == branch_id)
    rows = session.execute(stmt.order_by(ChefNote.created_at.desc()).limit(limit)).all()
    return [dict(r._mapping) for r in rows]


def add_chef_note(hospital_id: int, text: str, created_by_name: str, branch_id: str | None = None) -> dict:
    from db.repositories.branches import get_default_branch

    if branch_id is None:
        branch_id = get_default_branch(hospital_id)["id"]
    session = get_session()
    result = session.execute(
        ChefNote.__table__.insert().values(
            hospital_id=hospital_id, branch_id=branch_id, text=text, created_by_name=created_by_name,
            created_at=datetime.now().isoformat(),
        ).returning(ChefNote.id)
    )
    new_id = result.scalar_one()
    session.commit()
    row = session.execute(select(*_COLUMNS).where(ChefNote.id == new_id)).one()
    return dict(row._mapping)


def delete_chef_note(hospital_id: int, note_id: int) -> bool:
    session = get_session()
    result = session.execute(
        ChefNote.__table__.delete().where(ChefNote.hospital_id == hospital_id, ChefNote.id == note_id)
    )
    session.commit()
    return result.rowcount > 0
