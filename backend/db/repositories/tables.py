# db/repositories/tables.py
"""Stage 4 (table-availability logic, ARCHITECTURE_REFERENCE_FOR_FORKING.md
Section 4/7) -- Stage 2 of 4: availability/booking logic + connector methods,
on top of Stage 1's data model (migration 0030). Studied `procedure.py`'s
multi-resource-pool pattern as the closer template (confirmed with the user)
and reused its advisory-lock/pool-matching shape -- but NOT its per-resource
generated-slot-grid (`procedure_resource_slots`): restaurant operating hours
are shared across every table (`hospital_settings.operating_days/
operating_hours`, not scheduled per-table), so candidate start-times are
computed on the fly here rather than read off a pre-generated grid. No
staleness/regeneration concern to design around, and no per-table grid
storage.

A table reservation only ever needs ONE free table (capacity >= party_size),
unlike a procedure's AND-across-several-resource-TYPE-pools -- so this is
structurally simpler than procedure_slots.py's own pool-matching, closer to
a single-pool version of it."""
import uuid
from datetime import date as _date, datetime, timedelta

from sqlalchemy import select

from db.connection import IntegrityError, get_connection, get_session
from db.display_ids import _generate_reference_id
from db.models import SOURCE_WHATSAPP, STATUS_BOOKED, STATUS_PENDING, Appointment, _row_to_appointment
from db.orm_models import TableRow

# Same rolling-window length doctors.py's own SLOT_DAYS_AHEAD uses --
# candidate start-times are computed on the fly (not stored), so this only
# bounds how far ahead get_available_table_slots() looks, not a generation
# job's own workload.
_SLOT_DAYS_AHEAD = 14

_WEEKDAY_ABBREVS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


# --- Tables (CRUD) ---

def create_table(hospital_id: int, department_id: str, name: str, capacity: int) -> dict:
    """id is a UUID-derived opaque string scoped by an h{hospital_id}_
    prefix, same convention create_department()/create_doctor() already
    use (avoids slugifying arbitrary user-entered text)."""
    table_id = f"h{hospital_id}_{uuid.uuid4().hex[:8]}"
    session = get_session()
    session.execute(
        TableRow.__table__.insert().values(
            id=table_id, hospital_id=hospital_id, department_id=department_id, name=name, capacity=capacity,
        )
    )
    session.commit()
    # Portal table-management (Sub-stage 4 follow-up): full row shape
    # (department_id/is_active included), not just the 3 fields the WhatsApp
    # flow's own create_table_reservation() ever needed -- same
    # "create returns via a find_*() read-back" convention
    # create_menu_item()/create_department() already use.
    created = find_table(hospital_id, table_id)
    assert created is not None
    return created


def get_tables(hospital_id: int, department_id: str | None = None) -> list[dict]:
    """Active tables only -- the connector interface's own read point (both
    the WhatsApp flow's availability search and anywhere else that needs
    "what tables can actually be booked" go through this), same enforcement-
    point discipline get_doctors() already establishes for is_active=FALSE.
    The portal's own table MANAGEMENT list uses get_all_tables_for_hospital()
    instead, which intentionally still shows inactive tables."""
    session = get_session()
    stmt = select(TableRow.id, TableRow.name, TableRow.department_id, TableRow.capacity).where(
        TableRow.hospital_id == hospital_id, TableRow.is_active.is_(True),
    )
    if department_id is not None:
        stmt = stmt.where(TableRow.department_id == department_id)
    rows = session.execute(stmt.order_by(TableRow.capacity, TableRow.name)).all()
    return [dict(r._mapping) for r in rows]


_TABLE_COLUMNS = (
    TableRow.id, TableRow.name, TableRow.department_id, TableRow.capacity, TableRow.is_active,
    TableRow.status, TableRow.pos_x, TableRow.pos_y, TableRow.shape, TableRow.notes,
)


def get_all_tables_for_hospital(hospital_id: int) -> list[dict]:
    session = get_session()
    rows = session.execute(
        select(*_TABLE_COLUMNS).where(TableRow.hospital_id == hospital_id).order_by(TableRow.name)
    ).all()
    return [dict(r._mapping) for r in rows]


def find_table(hospital_id: int, table_id: str) -> dict | None:
    session = get_session()
    row = session.execute(
        select(*_TABLE_COLUMNS).where(TableRow.hospital_id == hospital_id, TableRow.id == table_id)
    ).first()
    return dict(row._mapping) if row else None


# --- Live occupancy (Live Operations follow-up) ---

STATUS_FREE = "free"
STATUS_OCCUPIED = "occupied"
STATUS_NEEDS_CLEANING = "needs_cleaning"
# Tables page follow-up (migration 0042): deliberately out of service (maintenance, etc.) --
# distinct from STATUS_NEEDS_CLEANING (just vacated, waiting to be cleaned for the next party).
STATUS_BLOCKED = "blocked"


def update_table_position(hospital_id: int, table_id: str, pos_x: float, pos_y: float) -> dict | None:
    """Tables page follow-up: a lightweight write separate from update_table() below -- a drag on
    the floor map shouldn't need to resend the whole edit form. Ungated (no status guard): position
    is purely cosmetic layout, not a state transition."""
    session = get_session()
    result = session.execute(
        TableRow.__table__.update()
        .where(TableRow.hospital_id == hospital_id, TableRow.id == table_id)
        .values(pos_x=pos_x, pos_y=pos_y)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return find_table(hospital_id, table_id)


def set_table_status(hospital_id: int, table_id: str, new_status: str, expected_status: str) -> dict | None:
    """Guarded UPDATE ... WHERE status = '<expected_status>', same shape
    db/repositories/food_orders.py's advance_order_status() uses -- returns
    None (not an error) if the table's actual status didn't match
    expected_status (a double-tapped button, or someone else already moved
    it), so the portal action can treat that as "refresh and look again"
    rather than a crash."""
    session = get_session()
    result = session.execute(
        TableRow.__table__.update()
        .where(TableRow.hospital_id == hospital_id, TableRow.id == table_id, TableRow.status == expected_status)
        .values(status=new_status)
    )
    session.commit()
    if result.rowcount == 0:
        return None
    return find_table(hospital_id, table_id)


def get_current_occupants(hospital_id: int, table_ids: list[str], now: datetime | None = None) -> dict[str, dict]:
    """Tables page follow-up: which real reservation or walk-in is currently sitting at each
    occupied table -- tables.status='occupied' alone carries no such reference (set_table_status()
    just flips the flag), so this resolves it by joining TODAY's rows that reference the table:
    an attended appointment (a real reservation staff marked arrived), or an assigned waitlist entry
    (a real walk-in seated from the queue). Returns {table_id: {...}} only for tables with a real
    match -- an occupied table with neither (e.g. seated without going through either flow) is
    legitimately absent from the result, never guessed at."""
    if not table_ids:
        return {}
    from db.orm_models import AppointmentRow, WaitlistEntry
    from db.models import STATUS_ATTENDED
    from db.repositories.patients import get_patient_names_by_phone

    now = now or datetime.now()
    day_start = datetime.combine(now.date(), datetime.min.time()).isoformat()
    day_end = datetime.combine(now.date(), datetime.max.time()).isoformat()
    session = get_session()

    occupants: dict[str, dict] = {}

    appt_rows = session.execute(
        select(
            AppointmentRow.table_id, AppointmentRow.reference_id, AppointmentRow.phone,
            AppointmentRow.party_size, AppointmentRow.updated_at, AppointmentRow.created_at,
            AppointmentRow.turnover_minutes,
        ).where(
            AppointmentRow.hospital_id == hospital_id, AppointmentRow.table_id.in_(table_ids),
            AppointmentRow.status == STATUS_ATTENDED,
            AppointmentRow.scheduled_at >= day_start, AppointmentRow.scheduled_at <= day_end,
        )
    ).all()
    names = get_patient_names_by_phone(hospital_id, [r.phone for r in appt_rows])
    for r in appt_rows:
        arrived_at = r.updated_at or r.created_at
        expected_release = None
        if arrived_at and r.turnover_minutes:
            expected_release = (datetime.fromisoformat(arrived_at) + timedelta(minutes=r.turnover_minutes)).isoformat()
        occupants[r.table_id] = {
            "source": "reservation", "guest_name": names.get(r.phone), "party_size": r.party_size,
            "reference_id": r.reference_id, "arrived_at": arrived_at, "expected_release_at": expected_release,
        }

    remaining = [t for t in table_ids if t not in occupants]
    if remaining:
        from db.orm_models import HospitalSettings
        default_turnover = session.execute(
            select(HospitalSettings.default_turnover_minutes).where(HospitalSettings.hospital_id == hospital_id)
        ).scalar_one_or_none() or 90
        wl_rows = session.execute(
            select(
                WaitlistEntry.assigned_table_id, WaitlistEntry.guest_name, WaitlistEntry.party_size,
                WaitlistEntry.assigned_at,
            ).where(
                WaitlistEntry.hospital_id == hospital_id, WaitlistEntry.assigned_table_id.in_(remaining),
                WaitlistEntry.status == "assigned",
                WaitlistEntry.assigned_at >= day_start, WaitlistEntry.assigned_at <= day_end,
            )
        ).all()
        for r in wl_rows:
            expected_release = (
                (datetime.fromisoformat(r.assigned_at) + timedelta(minutes=default_turnover)).isoformat()
                if r.assigned_at else None
            )
            occupants[r.assigned_table_id] = {
                "source": "walkin", "guest_name": r.guest_name, "party_size": r.party_size,
                "reference_id": None, "arrived_at": r.assigned_at, "expected_release_at": expected_release,
            }

    return occupants


def get_reserved_soon_table_ids(hospital_id: int, now: datetime | None = None, within_minutes: int = 120) -> set[str]:
    """Tables page follow-up: which FREE tables have a real booked/pending reservation coming up
    soon -- the "Reserved" the floor map shows is this, not a stored status (same "derive, don't
    invent a new status value" precedent Seated already set)."""
    from db.orm_models import AppointmentRow
    from db.models import STATUS_BOOKED, STATUS_PENDING

    now = now or datetime.now()
    window_end = now + timedelta(minutes=within_minutes)
    session = get_session()
    rows = session.execute(
        select(AppointmentRow.table_id).where(
            AppointmentRow.hospital_id == hospital_id, AppointmentRow.table_id.is_not(None),
            AppointmentRow.status.in_((STATUS_BOOKED, STATUS_PENDING)),
            AppointmentRow.scheduled_at >= now.isoformat(), AppointmentRow.scheduled_at <= window_end.isoformat(),
        )
    ).all()
    return {r.table_id for r in rows}


def update_table(
    hospital_id: int, table_id: str, name: str, department_id: str, capacity: int, is_active: bool,
    notes: str | None = None, shape: str = "rect",
) -> dict | None:
    session = get_session()
    session.execute(
        TableRow.__table__.update()
        .where(TableRow.hospital_id == hospital_id, TableRow.id == table_id)
        .values(name=name, department_id=department_id, capacity=capacity, is_active=is_active, notes=notes, shape=shape)
    )
    session.commit()
    return find_table(hospital_id, table_id)


# --- Availability (computed on the fly, no pre-generated grid) ---

def _parse_time_range(time_range: str) -> tuple[int, int]:
    """'12:00-15:00' -> (720, 900), minutes-since-midnight -- matching how
    doctors.py's own generate_slots_for_doctor() parses working_hours
    ranges."""
    start_str, end_str = time_range.split("-")
    sh, sm = (int(x) for x in start_str.split(":"))
    eh, em = (int(x) for x in end_str.split(":"))
    return sh * 60 + sm, eh * 60 + em


def _candidate_start_times_for_date(
    day: _date, operating_days: list[str], operating_hours: list[str], booking_interval_minutes: int,
    turnover_minutes: int, now: datetime,
) -> list[datetime]:
    """Every booking_interval_minutes-spaced start time on `day` whose full
    [start, start + turnover_minutes) span fits inside one of
    operating_hours' ranges -- deliberately never offers a start time whose
    turnover would run past closing, so no reservation is ever created that
    the restaurant is already closed for by its own natural end."""
    if _WEEKDAY_ABBREVS[day.weekday()] not in operating_days:
        return []
    times = []
    for time_range in operating_hours:
        range_start_min, range_end_min = _parse_time_range(time_range)
        minute = range_start_min
        while minute + turnover_minutes <= range_end_min:
            candidate = datetime.combine(day, datetime.min.time()) + timedelta(minutes=minute)
            if candidate >= now:
                times.append(candidate)
            minute += booking_interval_minutes
    return times


def _booked_spans_by_table(
    hospital_id: int, table_ids: list[str], window_start: datetime, window_end: datetime,
    exclude_appointment_id: int | None = None,
) -> dict[str, list[tuple[datetime, datetime]]]:
    """One query for every candidate table's currently-booked spans across
    the whole search window, so get_available_table_slots() doesn't run a
    fresh query per (time, table) candidate pair -- same "fetch once, check
    in-memory" shape _occupied_subslot_counts() uses for procedure
    resources, just interval-overlap instead of sub-slot-grid counting
    (tables have no shared grid to bucket onto -- turnover_minutes is
    stamped per-appointment, not uniform)."""
    if not table_ids:
        return {}
    from db.orm_models import AppointmentRow

    # A still-pending row (Table Bookings follow-up) holds its span too -- otherwise a second guest
    # could book the same table/time while the first is awaiting staff confirmation.
    session = get_session()
    stmt = select(AppointmentRow.table_id, AppointmentRow.scheduled_at, AppointmentRow.turnover_minutes).where(
        AppointmentRow.hospital_id == hospital_id,
        AppointmentRow.table_id.in_(table_ids),
        AppointmentRow.status.in_((STATUS_BOOKED, STATUS_PENDING)),
        AppointmentRow.scheduled_at >= (window_start - timedelta(hours=12)).isoformat(),
        AppointmentRow.scheduled_at <= window_end.isoformat(),
    )
    if exclude_appointment_id is not None:
        stmt = stmt.where(AppointmentRow.id != exclude_appointment_id)
    rows = session.execute(stmt).all()
    spans: dict[str, list[tuple[datetime, datetime]]] = {}
    for table_id, scheduled_at, turnover in rows:
        start = datetime.fromisoformat(scheduled_at)
        end = start + timedelta(minutes=turnover or 0)
        spans.setdefault(table_id, []).append((start, end))
    return spans


def _table_free_for_span(spans: list[tuple[datetime, datetime]], start: datetime, end: datetime) -> bool:
    return all(end <= existing_start or start >= existing_end for existing_start, existing_end in spans)


def get_available_table_slots(
    hospital_id: int, party_size: int, department_id: str | None = None, now: datetime | None = None,
    exclude_appointment_id: int | None = None,
) -> list[dict]:
    """Every candidate start-time (soonest first) where at least one active
    table with capacity >= party_size (in `department_id`'s section, if
    given) is free for the full turnover span -- same "any free resource in
    the pool, caller never picks which one" shape
    get_procedure_available_slots() already establishes, and the same
    {"id", "date", "time", "label"} return shape, so the existing generic
    date/time menu machinery (flows/booking/messages.py's _send_date_menu/
    _send_time_menu, already branching on resource_id/procedure_id) can grow
    a party_size branch in Stage 3 with no shape surprises.

    exclude_appointment_id: a reservation being MOVED shouldn't block its own
    new time (e.g. shifting 30 minutes later on the venue's only table).

    Empty hospital_settings.operating_days/operating_hours (not configured
    yet) or zero qualifying tables both return [] -- same "no resource
    linked -> not available" discipline procedure/diagnostic resources
    already use, not a crash."""
    from db.repositories.hospital_settings import get_hospital_settings

    now = now or datetime.now()
    settings = get_hospital_settings(hospital_id)
    operating_days, operating_hours = settings["operating_days"], settings["operating_hours"]
    if not operating_days or not operating_hours:
        return []
    turnover_minutes = settings["default_turnover_minutes"]
    booking_interval_minutes = settings["booking_interval_minutes"]

    candidate_tables = [t for t in get_tables(hospital_id, department_id) if t["capacity"] >= party_size]
    if not candidate_tables:
        return []

    window_start = now
    window_end = datetime.combine(now.date() + timedelta(days=_SLOT_DAYS_AHEAD), datetime.min.time())
    spans_by_table = _booked_spans_by_table(
        hospital_id, [t["id"] for t in candidate_tables], window_start, window_end, exclude_appointment_id,
    )

    slots = []
    for day_offset in range(_SLOT_DAYS_AHEAD):
        day = now.date() + timedelta(days=day_offset)
        for start in _candidate_start_times_for_date(
            day, operating_days, operating_hours, booking_interval_minutes, turnover_minutes, now,
        ):
            end = start + timedelta(minutes=turnover_minutes)
            if any(_table_free_for_span(spans_by_table.get(t["id"], []), start, end) for t in candidate_tables):
                slots.append({
                    "id": start.isoformat(), "date": start.date().isoformat(), "time": start.strftime("%H:%M"),
                    "label": f"{start.strftime('%a %d %b')} {start.strftime('%H:%M')}",
                })
    return slots


def find_table_slot(hospital_id: int, party_size: int, slot_id: str, department_id: str | None = None) -> dict | None:
    for s in get_available_table_slots(hospital_id, party_size, department_id):
        if s["id"] == slot_id:
            return s
    return None


# --- Reservation (advisory-lock-protected, mirrors reserve_procedure_resources) ---

def _table_free_for_span_conn(
    conn, hospital_id: int, table_id: str, start: datetime, end: datetime, exclude_appointment_id: int | None = None,
) -> bool:
    """Raw-connection counterpart of _table_free_for_span -- must run INSIDE
    the caller's own advisory-locked transaction, same reasoning
    reserve_procedure_resources' own docstring gives.

    exclude_appointment_id (reassign_table()'s own use): a reservation being
    MOVED onto a table it already occupies must not see its own still-
    current row as a conflict with itself -- irrelevant for
    create_table_reservation()'s brand-new-row case, so it defaults to None
    there. A still-pending row (Table Bookings follow-up) counts as occupying its span too, same
    reasoning _booked_spans_by_table() gives."""
    query = (
        "SELECT scheduled_at, turnover_minutes FROM appointments WHERE hospital_id = ? AND table_id = ? "
        "AND status IN ('booked', 'pending')"
    )
    params: tuple = (hospital_id, table_id)
    if exclude_appointment_id is not None:
        query += " AND id != ?"
        params += (exclude_appointment_id,)
    rows = conn.execute(query, params).fetchall()
    for row in rows:
        existing_start = datetime.fromisoformat(row["scheduled_at"])
        existing_end = existing_start + timedelta(minutes=row["turnover_minutes"] or 0)
        if not (end <= existing_start or start >= existing_end):
            return False
    return True


def create_table_reservation(
    hospital_id: int, phone: str, party_size: int, scheduled_at: datetime,
    department_id: str | None = None, patient_name: str | None = None, patient_age: int | None = None,
    patient_id: int | None = None, appointment_type_id: str | None = None, source: str = SOURCE_WHATSAPP,
    exclude_appointment_id: int | None = None, special_request: str | None = None,
) -> Appointment:
    """The table-reservation counterpart to create_procedure_appointment():
    same advisory-lock-protected BEGIN/COMMIT shape, re-checks candidate
    tables' freeness under the lock (not trusting the earlier
    get_available_table_slots() read), picks the smallest-capacity table
    that still fits (nearest-fit, so a 2-top party doesn't take an 8-top
    unless nothing smaller is free), raises IntegrityError on a lost race
    (the slot menu went stale). turnover_minutes is stamped from the
    hospital's CURRENT default at booking time, not read dynamically later --
    see migration 0030's own docstring for why."""
    from db.repositories.appointments import _upsert_patient
    from db.repositories.hospital_settings import get_hospital_settings

    conn = get_connection()
    settings = get_hospital_settings(hospital_id)
    turnover_minutes = settings["default_turnover_minutes"]
    scheduled_at_iso = scheduled_at.isoformat()
    span_end = scheduled_at + timedelta(minutes=turnover_minutes)
    # Table Bookings follow-up: same opt-in gate create_appointment() uses -- a WhatsApp reservation
    # lands 'pending' only when this hospital turned require_booking_confirmation on; staff-created
    # ones always land 'booked' immediately.
    status = STATUS_BOOKED
    if source == SOURCE_WHATSAPP and settings.get("require_booking_confirmation"):
        status = STATUS_PENDING

    if patient_id is not None:
        patient_row = conn.execute(
            "SELECT id, name, age FROM patients WHERE hospital_id = ? AND id = ?", (hospital_id, patient_id),
        ).fetchone()
        if patient_row is None:
            raise ValueError(f"patient_id {patient_id} not found for hospital {hospital_id}")
        patient = {"id": patient_row["id"], "name": patient_row["name"], "age": patient_row["age"]}
    else:
        patient = _upsert_patient(conn, hospital_id, phone, patient_name, patient_age)

    conn.execute("BEGIN")
    try:
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(?))",
            (f"table_reservation|{hospital_id}|{scheduled_at_iso}",),
        )
        candidates = [t for t in get_tables(hospital_id, department_id) if t["capacity"] >= party_size]
        candidates.sort(key=lambda t: t["capacity"])
        chosen = next(
            (
                t for t in candidates
                if _table_free_for_span_conn(conn, hospital_id, t["id"], scheduled_at, span_end, exclude_appointment_id)
            ),
            None,
        )
        if chosen is None:
            raise IntegrityError(f"No free table for party of {party_size} at {scheduled_at_iso}")
        resolved_department_id = department_id or chosen["department_id"]
        cur = conn.execute(
            "INSERT INTO appointments (hospital_id, phone, department_id, doctor_id, scheduled_at, "
            "booking_ordinal, source, reference_id, patient_id, patient_name, patient_phone, patient_age, "
            "appointment_type_id, table_id, party_size, turnover_minutes, status, special_request) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
            (hospital_id, phone, resolved_department_id, None, scheduled_at_iso, 0, source,
             _generate_reference_id(conn, hospital_id), patient["id"], patient["name"], phone, patient["age"],
             appointment_type_id, chosen["id"], party_size, turnover_minutes, status, special_request),
        )
        new_id_row = cur.fetchone()
        assert new_id_row is not None
        new_id = new_id_row["id"]
        conn.execute("COMMIT")
    except BaseException:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise
    from db.repositories.appointments import get_appointment
    created = get_appointment(hospital_id, new_id)
    assert created is not None
    return created


def reassign_table(hospital_id: int, appointment_id: int, new_table_id: str) -> Appointment:
    """Staff-facing "Reassign Table" action (portal reservation detail) --
    moves an existing BOOKED table reservation onto a different table, e.g.
    resolving a walk-in conflict. Same advisory-lock-protected BEGIN/COMMIT
    shape as create_table_reservation(): re-checks the TARGET table's actual
    freeness for this reservation's own [scheduled_at, scheduled_at +
    turnover_minutes) span under the lock, not a blind UPDATE trusting
    whatever the portal's own stale table list showed -- a second staff
    member (or a WhatsApp guest landing on the same table+time via a brand
    new reservation) racing this exact call is exactly what the lock
    protects against. Raises ValueError for a not-found/wrong-tenant/
    non-table-reservation/non-booked appointment or a not-found/wrong-tenant
    target table (caller's job to turn into a clean 4xx, same convention
    create_table_reservation()'s own patient_id ValueError already
    follows) -- raises IntegrityError specifically for the lost-race case
    (caller already treats that as "pick another slot/table")."""
    from db.repositories.appointments import get_appointment

    conn = get_connection()
    appointment = get_appointment(hospital_id, appointment_id)
    if appointment is None:
        raise ValueError(f"appointment {appointment_id} not found for hospital {hospital_id}")
    if appointment.table_id is None:
        raise ValueError(f"appointment {appointment_id} is not a table reservation")
    if appointment.status != STATUS_BOOKED:
        raise ValueError(f"appointment {appointment_id} is not booked (status={appointment.status!r})")

    target_table = find_table(hospital_id, new_table_id)
    if target_table is None:
        raise ValueError(f"table {new_table_id} not found for hospital {hospital_id}")
    party_size = appointment.party_size or 1
    if target_table["capacity"] < party_size:
        raise ValueError(f"table {new_table_id} (capacity {target_table['capacity']}) can't seat a party of {party_size}")

    turnover_minutes = appointment.turnover_minutes or 0
    scheduled_at = appointment.scheduled_at
    scheduled_at_iso = scheduled_at.isoformat()
    span_end = scheduled_at + timedelta(minutes=turnover_minutes)

    conn.execute("BEGIN")
    try:
        # Same lock key create_table_reservation() uses for this hospital+
        # time -- a reassignment onto a table genuinely contends with a
        # brand-new reservation being created for that same slot, so both
        # paths must serialize against each other, not just against other
        # reassignments.
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtext(?))",
            (f"table_reservation|{hospital_id}|{scheduled_at_iso}",),
        )
        if not _table_free_for_span_conn(
            conn, hospital_id, new_table_id, scheduled_at, span_end, exclude_appointment_id=appointment_id,
        ):
            raise IntegrityError(f"Table {new_table_id} is not free for party at {scheduled_at_iso}")
        conn.execute(
            "UPDATE appointments SET table_id = ?, department_id = ? WHERE hospital_id = ? AND id = ?",
            (new_table_id, target_table["department_id"], hospital_id, appointment_id),
        )
        conn.execute("COMMIT")
    except BaseException:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise

    updated = get_appointment(hospital_id, appointment_id)
    assert updated is not None
    return updated


def reschedule_table_reservation(hospital_id: int, old_appointment_id: int, new_scheduled_at: datetime) -> Appointment:
    """Moves a booked TABLE reservation to a new time -- the table-reservation
    counterpart to Tier1Connector.reschedule_booking(): books the new slot
    FIRST (create_table_reservation()'s own advisory-lock-protected,
    nearest-fit path, ignoring the old row so a reservation can shift onto
    time it currently occupies), THEN retires the old one, so a lost race
    (IntegrityError, left to propagate) leaves the guest's original
    reservation intact rather than with neither. Raises ValueError for a
    not-found/wrong-tenant/non-table/not-booked-or-pending reservation -- a still-'pending' reservation
    (Table Bookings follow-up) can be rescheduled the same as a booked one; the new row is re-evaluated
    against require_booking_confirmation same as any fresh booking."""
    from db.repositories.appointments import get_appointment, mark_rescheduled

    old = get_appointment(hospital_id, old_appointment_id)
    if old is None:
        raise ValueError(f"reservation {old_appointment_id} not found for hospital {hospital_id}")
    if old.table_id is None:
        raise ValueError(f"reservation {old_appointment_id} is not a table reservation")
    if old.status not in (STATUS_BOOKED, STATUS_PENDING):
        raise ValueError(f"reservation {old_appointment_id} is not booked (status={old.status!r})")

    new = create_table_reservation(
        hospital_id, old.phone, old.party_size or 1, new_scheduled_at,
        patient_id=old.patient_id,
        appointment_type_id=old.appointment_type_id, source=old.source,
        exclude_appointment_id=old_appointment_id,
    )
    mark_rescheduled(hospital_id, old_appointment_id)
    return new
