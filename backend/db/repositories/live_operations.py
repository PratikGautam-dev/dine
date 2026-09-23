# db/repositories/live_operations.py
"""Live Operations page: one aggregate read composing four already-real domains (bookings, food orders,
WhatsApp handoffs, tables) into the single payload /api/portal/live-operations returns. No new source of
truth here except table occupancy (db/repositories/tables.py's status column/set_table_status) -- everything
else is a read of data these domains already persist, same "compose, don't invent" discipline
get_live_operations_activity_feed() in dashboard.py already follows."""
from datetime import datetime

from db.models import STATUS_BOOKED, STATUS_CANCELLED, STATUS_RESCHEDULED
from db.repositories.appointments import get_all_appointments_for_hospital
from db.repositories.dashboard import get_live_operations_activity_feed
from db.repositories.food_orders import (
    STATUS_ACCEPTED, STATUS_OUT_FOR_DELIVERY, STATUS_PAID, STATUS_PLACED, STATUS_PREPARING,
    STATUS_READY_FOR_PICKUP, list_food_orders,
)
from db.repositories.handoffs import get_handoff_requests
from db.repositories.patients import get_patient_names_by_phone
from db.repositories.tables import STATUS_OCCUPIED, get_all_tables_for_hospital

_ORDER_QUEUE_LIMIT = 8
_HANDOFF_QUEUE_LIMIT = 8
_KITCHEN_STATUSES = (STATUS_ACCEPTED, STATUS_PREPARING)
_READY_STATUSES = (STATUS_READY_FOR_PICKUP, STATUS_OUT_FOR_DELIVERY)
_NON_TERMINAL_ORDER_STATUSES = (STATUS_PLACED, STATUS_PAID, STATUS_ACCEPTED, STATUS_PREPARING) + _READY_STATUSES


def get_live_operations_summary(hospital_id: int, now: datetime | None = None) -> dict:
    now = now or datetime.now()
    today = now.date()

    # --- Bookings: today's queue, same "still relevant today" filter TodayScheduleCard's own
    # frontend computation (useAppointments.ts's todaySchedule) already applies. ---
    all_appointments = get_all_appointments_for_hospital(hospital_id, limit=500)
    today_bookings = sorted(
        (
            a for a in all_appointments
            if a.scheduled_at.date() == today and a.status not in (STATUS_CANCELLED, STATUS_RESCHEDULED)
        ),
        key=lambda a: a.scheduled_at,
    )
    upcoming_bookings_today = sum(1 for a in today_bookings if a.status == STATUS_BOOKED and a.scheduled_at >= now)
    # Appointment doesn't carry the guest's name itself (dashboard.py's own /api/portal/dashboard route
    # resolves it the same batched way) -- from their profile at THIS restaurant, not the appointment row.
    booking_names = get_patient_names_by_phone(hospital_id, [a.phone for a in today_bookings])

    # --- Food orders: the live (non-terminal) queue. ---
    orders = [o for o in list_food_orders(hospital_id) if o["status"] in _NON_TERMINAL_ORDER_STATUSES]
    order_names = get_patient_names_by_phone(hospital_id, [o["phone"] for o in orders])
    orders_in_kitchen = sum(1 for o in orders if o["status"] in _KITCHEN_STATUSES)
    orders_ready = sum(1 for o in orders if o["status"] in _READY_STATUSES)

    # --- WhatsApp handoffs: open conversations needing a staff reply. ---
    open_handoffs = get_handoff_requests(hospital_id, status="open", limit=1000)
    handoffs = open_handoffs[:_HANDOFF_QUEUE_LIMIT]
    handoff_names = get_patient_names_by_phone(hospital_id, [h["phone"] for h in handoffs])

    # --- Tables: real, staff-set occupancy (not inferred from turnover_minutes). ---
    tables = [t for t in get_all_tables_for_hospital(hospital_id) if t["is_active"]]
    active_tables_occupied = sum(1 for t in tables if t["status"] == STATUS_OCCUPIED)

    return {
        "kpis": {
            "active_tables_occupied": active_tables_occupied,
            "active_tables_total": len(tables),
            "upcoming_bookings_today": upcoming_bookings_today,
            "orders_in_kitchen": orders_in_kitchen,
            "orders_ready": orders_ready,
            "open_conversations": len(open_handoffs),
        },
        "bookings_queue": [
            {
                "id": a.id, "scheduled_at": a.scheduled_at.isoformat(), "patient_name": booking_names.get(a.phone),
                "phone": a.phone, "party_size": a.party_size, "table_name": a.table_name, "status": a.status,
                "source": a.source,
            }
            for a in today_bookings
        ],
        "orders_queue": [
            {
                "id": o["id"], "reference_id": o["reference_id"], "status": o["status"],
                "patient_name": order_names.get(o["phone"]), "phone": o["phone"],
                "fulfillment_type": o["fulfillment_type"], "total_paise": o["total_paise"],
                "created_at": o["created_at"], "item_count": sum(i["quantity"] for i in o["items"]),
            }
            for o in orders[:_ORDER_QUEUE_LIMIT]
        ],
        "handoffs_queue": [
            {
                "id": h["id"], "phone": h["phone"], "patient_name": handoff_names.get(h["phone"]),
                "reason": h["reason"], "message_text": h["message_text"], "created_at": h["created_at"],
            }
            for h in handoffs
        ],
        "tables": [
            {"id": t["id"], "name": t["name"], "capacity": t["capacity"], "status": t["status"], "department_id": t["department_id"]}
            for t in tables
        ],
        "activity_feed": [
            {**e, "at": e["at"].isoformat()} for e in get_live_operations_activity_feed(hospital_id, limit=15)
        ],
    }
