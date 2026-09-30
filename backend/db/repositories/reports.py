# db/repositories/reports.py
"""Reports page: one aggregate read over the two real revenue-generating domains this app
actually has -- food orders (now two real sources: whatsapp and web, since the Web Storefront
migration 0051 added FoodOrder.source) and table reservations. No payment-method-split (only
"online"/"pay_at_restaurant" exist) is computed -- that's still decorative on the frontend --
but channel filtering and CSV export below are both real, not placeholders."""
import csv
import io
from datetime import datetime, timedelta

from sqlalchemy import func, select

from db.connection import get_session
from db.models import STATUS_ATTENDED, STATUS_CANCELLED, STATUS_NO_SHOW, STATUS_RESCHEDULED
from db.orm_models import AppointmentRow, Department, FoodOrder, FoodOrderItem, PatientRow, TableRow

_TERMINAL_CANCELLED_ORDER_STATUSES = ("cancelled",)

_VALID_CHANNELS = ("whatsapp", "web", "takeaway", "delivery", "dine_in")


def _channel_where(channel: str | None):
    """A "channel" mixes two real, independent axes this app actually has: how the order
    arrived (source: whatsapp/web) and how it's fulfilled (fulfillment_type: pickup/delivery),
    plus table reservations (which aren't orders at all -- "dine_in" excludes every order,
    matching nothing here, since a dine-in visit is an appointment, not a FoodOrder row).
    Reservation KPIs (reservations/repeat-rate/retention) stay unfiltered by channel always --
    a guest's visit history isn't scoped to a single order channel. Returns a SQLAlchemy
    condition to AND into an order query's WHERE, or None for "no filter" (channel is
    None/"all"/unrecognized)."""
    if channel == "whatsapp":
        return FoodOrder.source == "whatsapp"
    if channel == "web":
        return FoodOrder.source == "web"
    if channel == "takeaway":
        return FoodOrder.fulfillment_type == "pickup"
    if channel == "delivery":
        return FoodOrder.fulfillment_type == "delivery"
    if channel == "dine_in":
        return FoodOrder.id.is_(None)  # matches no order row -- dine-in isn't a FoodOrder
    return None


def get_reports_summary(
    hospital_id: int, days: int = 30, now: datetime | None = None, channel: str | None = None,
    branch_id: str | None = None,
) -> dict:
    """branch_id=None (the topbar switcher's "All Branches") returns every branch, same
    "unfiltered means all" convention `channel` above already uses."""
    now = now or datetime.now()
    period_start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)
    session = get_session()
    channel_cond = _channel_where(channel)

    def _orders_between(start: datetime, end: datetime):
        stmt = select(FoodOrder.total_paise, FoodOrder.created_at, FoodOrder.fulfillment_type, FoodOrder.source).where(
            FoodOrder.hospital_id == hospital_id, FoodOrder.status.not_in(_TERMINAL_CANCELLED_ORDER_STATUSES),
            FoodOrder.created_at >= start.isoformat(), FoodOrder.created_at < end.isoformat(),
        )
        if channel_cond is not None:
            stmt = stmt.where(channel_cond)
        if branch_id is not None:
            stmt = stmt.where(FoodOrder.branch_id == branch_id)
        return session.execute(stmt).all()

    current_orders = _orders_between(period_start, now)
    previous_orders = _orders_between(prev_start, period_start)

    def _appts_between(start: datetime, end: datetime):
        stmt = (
            select(AppointmentRow.status, AppointmentRow.scheduled_at)
            .where(
                AppointmentRow.hospital_id == hospital_id,
                AppointmentRow.scheduled_at >= start.isoformat(), AppointmentRow.scheduled_at < end.isoformat(),
                AppointmentRow.status != STATUS_RESCHEDULED,
            )
        )
        if branch_id is not None:
            stmt = stmt.where(AppointmentRow.branch_id == branch_id)
        return session.execute(stmt).all()

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
    top_items_stmt = (
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
    )
    if channel_cond is not None:
        top_items_stmt = top_items_stmt.where(channel_cond)
    if branch_id is not None:
        top_items_stmt = top_items_stmt.where(FoodOrder.branch_id == branch_id)
    top_items_rows = session.execute(top_items_stmt).all()
    top_items = [{"name": r.item_name_snapshot, "orders": r.qty, "revenue_paise": r.revenue_paise} for r in top_items_rows]

    # --- Order channel breakdown: pickup ("Takeaway") vs delivery -- the two real fulfillment
    # types this app has (no Swiggy/Zomato order channel exists). Dine-in's order COUNT is real
    # (table reservations in this period); its revenue has no real source (a table booking
    # doesn't record spend) so it's estimated at the same average order value as WhatsApp food
    # orders -- an estimate, not a measurement, flagged as such in the field name. ---
    _FULFILLMENT_LABEL = {"pickup": "Takeaway", "delivery": "Delivery"}
    channel_totals: dict[str, dict[str, int]] = {"Takeaway": {"orders": 0, "revenue_paise": 0}, "Delivery": {"orders": 0, "revenue_paise": 0}}
    for o in current_orders:
        label = _FULFILLMENT_LABEL.get(o.fulfillment_type)
        if label is None:
            continue
        channel_totals[label]["orders"] += 1
        channel_totals[label]["revenue_paise"] += o.total_paise
    channel_breakdown = [
        {
            "channel": label, "total_orders": t["orders"], "revenue_paise": t["revenue_paise"],
            "average_order_value_paise": round(t["revenue_paise"] / t["orders"]) if t["orders"] else 0,
            "revenue_is_estimated": False,
        }
        for label, t in channel_totals.items()
    ]
    channel_breakdown.append({
        "channel": "Dine-in", "total_orders": total_reservations,
        "revenue_paise": total_reservations * avg_order_value, "average_order_value_paise": avg_order_value,
        "revenue_is_estimated": True,
    })

    # --- Retention trend: last 6 weeks, % of that week's attended-visit guests who'd ALSO
    # attended before that week started -- a real, if simple, repeat-rate-over-time series. ---
    all_attended = session.execute(
        select(AppointmentRow.patient_id, AppointmentRow.scheduled_at)
        .where(AppointmentRow.hospital_id == hospital_id, AppointmentRow.status == STATUS_ATTENDED, AppointmentRow.patient_id.isnot(None))
        .order_by(AppointmentRow.scheduled_at)
    ).all()
    retention_trend = []
    for w in range(5, -1, -1):
        week_end = now - timedelta(days=7 * w)
        week_start = week_end - timedelta(days=7)
        seen_before = {r.patient_id for r in all_attended if r.scheduled_at < week_start.isoformat()}
        this_week = {r.patient_id for r in all_attended if week_start.isoformat() <= r.scheduled_at < week_end.isoformat()}
        pct = round((len(this_week & seen_before) / len(this_week)) * 100) if this_week else 0
        retention_trend.append({"label": week_start.strftime("%d %b"), "repeat_pct": pct})

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
        "channel_breakdown": channel_breakdown,
        "retention_trend": retention_trend,
        "period_days": days,
        "channel": channel if channel in _VALID_CHANNELS else None,
        "branch_id": branch_id,
    }


def _csv_from_rows(header: list[str], rows: list[list]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


def export_report_csv(
    hospital_id: int, kind: str, days: int = 30, channel: str | None = None, now: datetime | None = None,
    branch_id: str | None = None,
) -> str:
    """Real CSV rows for the Reports page's "Download Reports" card -- built from the exact same
    tables/period the on-screen summary above uses, not a re-serialization of the aggregate KPIs.
    "sales" and "orders" respect the channel filter (they're order-shaped); "customers" and
    "bookings" don't (a guest or a table reservation isn't scoped to one order channel). branch_id
    applies to "sales"/"orders" (FoodOrder) and "bookings" (AppointmentRow) -- "customers" doesn't,
    same "a guest isn't scoped to one branch" reasoning channel already follows for that kind."""
    now = now or datetime.now()
    period_start = now - timedelta(days=days)
    session = get_session()
    channel_cond = _channel_where(channel) if kind in ("sales", "orders") else None

    if kind == "sales":
        stmt = select(FoodOrder.created_at, FoodOrder.total_paise).where(
            FoodOrder.hospital_id == hospital_id, FoodOrder.status.not_in(_TERMINAL_CANCELLED_ORDER_STATUSES),
            FoodOrder.created_at >= period_start.isoformat(),
        )
        if channel_cond is not None:
            stmt = stmt.where(channel_cond)
        if branch_id is not None:
            stmt = stmt.where(FoodOrder.branch_id == branch_id)
        by_day: dict[str, dict[str, int]] = {}
        for created_at, total_paise in session.execute(stmt).all():
            day = created_at[:10]
            entry = by_day.setdefault(day, {"orders": 0, "revenue_paise": 0})
            entry["orders"] += 1
            entry["revenue_paise"] += total_paise
        rows = [[day, v["orders"], round(v["revenue_paise"] / 100, 2)] for day, v in sorted(by_day.items())]
        return _csv_from_rows(["Date", "Orders", "Revenue (INR)"], rows)

    if kind == "orders":
        stmt = select(
            FoodOrder.id, FoodOrder.reference_id, FoodOrder.created_at, FoodOrder.phone, FoodOrder.source,
            FoodOrder.fulfillment_type, FoodOrder.payment_method, FoodOrder.status, FoodOrder.total_paise,
        ).where(
            FoodOrder.hospital_id == hospital_id, FoodOrder.created_at >= period_start.isoformat(),
        ).order_by(FoodOrder.created_at.desc())
        if channel_cond is not None:
            stmt = stmt.where(channel_cond)
        if branch_id is not None:
            stmt = stmt.where(FoodOrder.branch_id == branch_id)
        rows = [
            [oid, ref or "", created_at, phone, source, fulfillment_type, payment_method, status, round(total_paise / 100, 2)]
            for oid, ref, created_at, phone, source, fulfillment_type, payment_method, status, total_paise in session.execute(stmt).all()
        ]
        return _csv_from_rows(
            ["Order ID", "Reference", "Placed At", "Phone", "Source", "Fulfillment", "Payment Method", "Status", "Total (INR)"], rows,
        )

    if kind == "customers":
        from db.repositories.patients import list_patients
        patients = list_patients(hospital_id, limit=100000)
        rows = [
            [
                p["id"], p["name"] or "", p["phone"], p.get("visit_count") or 0, p.get("total_orders") or 0,
                round((p.get("total_spend_paise") or 0) / 100, 2), p.get("loyalty_tier") or "", p.get("last_visit") or "",
            ]
            for p in patients
        ]
        return _csv_from_rows(
            ["Patient ID", "Name", "Phone", "Visit Count", "Total Orders", "Total Spend (INR)", "Loyalty Tier", "Last Visit"], rows,
        )

    if kind == "bookings":
        stmt = (
            select(
                AppointmentRow.id, AppointmentRow.reference_id, AppointmentRow.phone, Department.name,
                TableRow.name, AppointmentRow.scheduled_at, AppointmentRow.status,
            )
            .select_from(AppointmentRow)
            .join(Department, Department.id == AppointmentRow.department_id)
            .outerjoin(TableRow, TableRow.id == AppointmentRow.table_id)
            .where(
                AppointmentRow.hospital_id == hospital_id, AppointmentRow.scheduled_at >= period_start.isoformat(),
                AppointmentRow.status != STATUS_RESCHEDULED, AppointmentRow.deleted_at.is_(None),
            )
            .order_by(AppointmentRow.scheduled_at.desc())
        )
        if branch_id is not None:
            stmt = stmt.where(AppointmentRow.branch_id == branch_id)
        rows = [
            [bid, ref or "", phone, dept or "", table or "", scheduled_at, status]
            for bid, ref, phone, dept, table, scheduled_at, status in session.execute(stmt).all()
        ]
        return _csv_from_rows(["Booking ID", "Reference", "Phone", "Section", "Table", "Scheduled At", "Status"], rows)

    raise ValueError(f"Unknown report kind: {kind!r}")
