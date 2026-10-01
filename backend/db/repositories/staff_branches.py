# db/repositories/staff_branches.py
"""Per-branch staff access (migration 0060) -- a staff member with no rows here is
UNRESTRICTED (every branch visible, today's unchanged default behavior, matching the
confirmed "staff are NOT locked to a branch" design); one or more rows restricts them to
exactly those branches. Opt-in per staff member, not a default-on access-control rewrite."""
from sqlalchemy import select

from db.connection import get_session
from db.orm_models import StaffBranch


def get_staff_branch_ids(identity_id: int) -> list[str]:
    """Empty list = unrestricted (every branch). Non-empty = restricted to exactly these."""
    session = get_session()
    rows = session.execute(select(StaffBranch.branch_id).where(StaffBranch.identity_id == identity_id)).scalars().all()
    return list(rows)


def set_staff_branches(identity_id: int, branch_ids: list[str]) -> list[str]:
    """Replaces the staff member's branch restriction wholesale -- empty list clears it back to
    unrestricted."""
    session = get_session()
    session.execute(StaffBranch.__table__.delete().where(StaffBranch.identity_id == identity_id))
    if branch_ids:
        session.execute(
            StaffBranch.__table__.insert(),
            [{"identity_id": identity_id, "branch_id": b} for b in dict.fromkeys(branch_ids)],
        )
    session.commit()
    return get_staff_branch_ids(identity_id)


def staff_can_access_branch(identity_id: int, branch_id: str) -> bool:
    allowed = get_staff_branch_ids(identity_id)
    return not allowed or branch_id in allowed
