# db/repositories/chef_notes.py
"""Kitchen Orders (KDS) follow-up: a small, real shared notes board for kitchen staff -- migration
0043's chef_notes table. Attributed to whoever actually posted it (the logged-in staff member's own
name, passed in by the caller), never an invented persona."""
from datetime import datetime

from sqlalchemy import select

from db.connection import get_session
from db.orm_models import ChefNote

_COLUMNS = (ChefNote.id, ChefNote.text, ChefNote.created_by_name, ChefNote.created_at)


def list_chef_notes(hospital_id: int, limit: int = 20) -> list[dict]:
    session = get_session()
    rows = session.execute(
        select(*_COLUMNS).where(ChefNote.hospital_id == hospital_id).order_by(ChefNote.created_at.desc()).limit(limit)
    ).all()
    return [dict(r._mapping) for r in rows]


def add_chef_note(hospital_id: int, text: str, created_by_name: str) -> dict:
    session = get_session()
    result = session.execute(
        ChefNote.__table__.insert().values(
            hospital_id=hospital_id, text=text, created_by_name=created_by_name,
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
