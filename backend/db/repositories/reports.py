# db/repositories/reports.py
"""Reports page: one aggregate read over the two real revenue-generating domains this app
actually has -- WhatsApp food orders and table reservations. No multi-channel (Swiggy/Zomato),
payment-method-split (only "online"/"pay_at_restaurant" exist), or export/PDF generation exists,
so none of that is computed here -- confirmed with the user rather than approximated."""
from datetime import datetime, timedelta

from sqlalchemy import func, select

from db.connection import get_session
from db.models import STATUS_ATTENDED, STATUS_CANCELLED, STATUS_NO_SHOW, STATUS_RESCHEDULED
from db.orm_models import AppointmentRow, FoodOrder, FoodOrderItem, PatientRow

_TERMINAL_CANCELLED_ORDER_STATUSES = ("cancelled",)


def get_reports_summary(hospital_id: int, days: int = 30, now: datetime | None = None) -> dict:
    now = now or datetime.now()
    period_start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)
    session = get_session()

    def _orders_between(start: datetime, end: datetime):
        return session.execute(
            select(FoodOrder.total_paise, FoodOrder.created_at)
            .where(
                FoodOrder.hospital_id == hospital_id, FoodOrder.status.not_in(_TERMINAL_CANCELLED_ORDER_STATUSES),
                FoodOrder.created_at >= start.isoformat(), FoodOrder.created_at < end.isoformat(),
            )
        ).all()

    current_orders = _orders_between(period_start, now)
    previous_orders = _orders_between(prev_start, period_start)

    def _appts_between(start: datetime, end: datetime):
        return session.execute(
            select(AppointmentRow.status, AppointmentRow.scheduled_at)
            .where(
                AppointmentRow.hospital_id == hospital_id,
                AppointmentRow.scheduled_at >= start.isoformat(), AppointmentRow.scheduled_at < end.isoformat(),
                AppointmentRow.status != STATUS_RESCHEDULED,
            )
        ).all()

    current_appts = _appts_between(period_start, now)
    previous_appts = _appts_between(prev_start, period_start)

    # --- Headline KPIs, with a same-length-previous-period % change. ---
    def _pct_change(curr: float, prev: float) -> float | None:
        if prev == 0:
            return None
        return round(((curr - prev) / prev) * 100)

    revenue = sum(o.total_paise for o in current_orders)
    prev_revenue = sum(o.total_paise for o in previous_orders)
    total_orders = len(current_orders)
    prev_total_orders = len(previous_orders)
    total_reservations = len(current_appts)
    prev_total_reservations = len(previous_appts)
    avg_order_value = round(revenue / total_orders) if total_orders else 0
    prev_avg_order_value = round(prev_revenue / prev_total_orders) if prev_total_orders else 0

    all_patients = session.execute(
        select(PatientRow.id).where(PatientRow.hospital_id == hospital_id)
    ).all()
    # Repeat rate: of guests who've EVER visited (attended >=1 appointment), what share attended more than once.
    visited_counts = session.execute(
        select(AppointmentRow.patient_id, func.count(AppointmentRow.id))
        .where(AppointmentRow.hospital_id == hospital_id, AppointmentRow.status == STATUS_ATTENDED, AppointmentRow.patient_id.isnot(None))
        .group_by(AppointmentRow.patient_id)
    ).all()
    visited_total = len(visited_counts)
    repeat_visited = sum(1 for _pid, c in visited_counts if c >= 2)
    repeat_customers_pct = round((repeat_visited / visited_total) * 100) if visited_total else None

    # --- Revenue & orders trend, last `days` days. ---
    by_day: dict[str, dict[str, int]] = {}
    for o in current_orders:
        day = o.created_at[:10]
        entry = by_day.setdefault(day, {"revenue_paise": 0, "orders": 0})
        entry["revenue_paise"] += o.total_paise
        entry["orders"] += 1
    trend = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        entry = by_day.get(day, {"revenue_paise": 0, "orders": 0})
        trend.append({"date": day, "label": (now - timedelta(days=i)).strftime("%d %b"), **entry})

    # --- Reservation outcomes (for a donut, same shape DepartmentDonut already expects). ---
    outcome_counts = {"Attended": 0, "Booked / upcoming": 0, "No-show": 0, "Cancelled": 0}
    for a in current_appts:
        if a.status == STATUS_ATTENDED:
            outcome_counts["Attended"] += 1
        elif a.status == STATUS_NO_SHOW:
            outcome_counts["No-show"] += 1
        elif a.status == STATUS_CANCELLED:
            outcome_counts["Cancelled"] += 1
        else:
            outcome_counts["Booked / upcoming"] += 1
    reservation_outcomes = [{"department_name": k, "count": v} for k, v in outcome_counts.items() if v > 0]

    # --- Peak order hours (24-length array, local server time -- same shape PeakHoursChart already takes). ---
    hours = [0] * 24
    for o in current_orders:
        try:
            hour = datetime.fromisoformat(o.created_at.replace("Z", "+00:00")).hour
            hours[hour] += 1
        except ValueError:
            continue

    # --- Top selling items, by quantity, over the period. ---
    top_items_rows = session.execute(
        select(
            FoodOrderItem.item_name_snapshot, func.sum(FoodOrderItem.quantity).label("qty"),
            func.sum(FoodOrderItem.quantity * FoodOrderItem.unit_price_paise_snapshot).label("revenue_paise"),
        )
        .select_from(FoodOrderItem)
        .join(FoodOrder, FoodOrder.id == FoodOrderItem.order_id)
        .where(
            FoodOrder.hospital_id == hospital_id, FoodOrder.status.not_in(_TERMINAL_CANCELLED_ORDER_STATUSES),
            FoodOrder.created_at >= period_start.isoformat(),
        )
        .group_by(FoodOrderItem.item_name_snapshot)
        .order_by(func.sum(FoodOrderItem.quantity).desc())
        .limit(8)
    ).all()
    top_items = [{"name": r.item_name_snapshot, "orders": r.qty, "revenue_paise": r.revenue_paise} for r in top_items_rows]

    return {
        "kpis": {
            "total_revenue_paise": revenue, "total_revenue_change_pct": _pct_change(revenue, prev_revenue),
            "total_orders": total_orders, "total_orders_change_pct": _pct_change(total_orders, prev_total_orders),
            "total_reservations": total_reservations,
            "total_reservations_change_pct": _pct_change(total_reservations, prev_total_reservations),
            "average_order_value_paise": avg_order_value,
            "average_order_value_change_pct": _pct_change(avg_order_value, prev_avg_order_value),
            "repeat_customers_pct": repeat_customers_pct,
            "total_customers": len(all_patients),
        },
        "trend": trend,
        "reservation_outcomes": reservation_outcomes,
        "peak_order_hours": hours,
        "top_items": top_items,
        "period_days": days,
    }
