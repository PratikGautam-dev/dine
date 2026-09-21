# db/repositories/food_orders.py
"""Food ordering plan, Sub-stage 2 of 4: order creation (checkout),
Razorpay payment initiation, the guarded-UPDATE status-transition mechanism,
and the two-phase Razorpay webhook handler.

Cart itself is NOT persisted here -- per the plan (confirmed with the user),
cart contents live in the WhatsApp session's own `context` dict (Sub-stage 3),
the same way an in-progress table reservation's date/time/party_size live in
context before create_table_reservation() ever runs. create_food_order()
below is the checkout step: it's called ONCE, with the full item list, and
persists a real food_orders/food_order_items row starting directly at
status='pending_payment' -- there is no persisted 'cart' status row in
practice (the CHECK constraint still allows it, for a future "recall my
abandoned cart" feature, but nothing writes one today).

No pg_advisory_xact_lock here, unlike create_table_reservation() -- confirmed
with the user in the approved plan: a food order isn't contending for a
scarce shared resource (a table, a time slot). Stock is a per-row atomic
guard (menu_items.decrement_stock()), which is the right-sized protection,
not a bigger lock."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, cast, select

from db.connection import IntegrityError, get_connection, get_session
from db.display_ids import ORDER_REFERENCE_ID_PREFIX, _generate_reference_id
from db.orm_models import FoodOrder, FoodOrderItem
from db.repositories.menu_items import decrement_stock, restore_stock

_CURRENCY = "INR"

# food_orders.status -- mirrors the migration's CHECK constraint exactly.
STATUS_CART = "cart"
STATUS_PENDING_PAYMENT = "pending_payment"
# A confirmed pay-at-restaurant order waiting for the kitchen: the role STATUS_PAID
# plays for an online order.
STATUS_PLACED = "placed"
STATUS_PAID = "paid"
STATUS_ACCEPTED = "accepted"
STATUS_PREPARING = "preparing"
STATUS_READY_FOR_PICKUP = "ready_for_pickup"
STATUS_OUT_FOR_DELIVERY = "out_for_delivery"
STATUS_COMPLETED = "completed"
STATUS_CANCELLED = "cancelled"

# food_orders.payment_method -- mirrors migration 0033's CHECK constraint.
PAYMENT_ONLINE = "online"
PAYMENT_AT_RESTAURANT = "pay_at_restaurant"


def get_delivery_fee_paise(hospital_id: int, fulfillment_type: str) -> int | None:
    """The flat delivery fee for this restaurant, in paise -- None (not a fake
    0) for takeaway or when no fee is configured. The one place the fee is
    computed, so the guest's order review shows exactly what create_food_order()
    will later charge."""
    if fulfillment_type != "delivery":
        return None
    from db.repositories.hospital_settings import get_hospital_settings

    fee = get_hospital_settings(hospital_id)["home_collection_charge"]
    return round(fee * 100) if fee is not None else None


def create_food_order(
    hospital_id: int, phone: str, items: list[dict], fulfillment_type: str,
    delivery_address: str | None = None, patient_name: str | None = None, patient_id: int | None = None,
    payment_method: str = PAYMENT_ONLINE,
) -> dict:
    """Checkout. `items` is [{"menu_item_id": str, "quantity": int}, ...] --
    every item's current name/price is read and snapshotted here (not passed
    in by the caller), and stock is decremented atomically per item inside
    ONE transaction: if any single item is out of stock, the whole order is
    rolled back (IntegrityError), not partially created -- same
    all-or-nothing discipline create_table_reservation() gives a lost
    availability race, just without needing a lock to get there."""
    from db.repositories.appointments import _upsert_patient

    if not items:
        raise ValueError("create_food_order() requires at least one item")
    if fulfillment_type not in ("pickup", "delivery"):
        raise ValueError(f"Invalid fulfillment_type: {fulfillment_type!r}")
    if payment_method not in (PAYMENT_ONLINE, PAYMENT_AT_RESTAURANT):
        raise ValueError(f"Invalid payment_method: {payment_method!r}")

    conn = get_connection()

    if patient_id is not None:
        patient_row = conn.execute(
            "SELECT id, name FROM patients WHERE hospital_id = ? AND id = ?", (hospital_id, patient_id),
        ).fetchone()
        if patient_row is None:
            raise ValueError(f"patient_id {patient_id} not found for hospital {hospital_id}")
        resolved_patient_id = patient_row["id"]
    else:
        patient = _upsert_patient(conn, hospital_id, phone, patient_name, None)
        resolved_patient_id = patient["id"]

    conn.execute("BEGIN")
    try:
        line_items = []
        subtotal_paise = 0
        for item in items:
            menu_row = conn.execute(
                "SELECT name, price_paise FROM menu_items WHERE hospital_id = ? AND id = ?",
                (hospital_id, item["menu_item_id"]),
            ).fetchone()
            if menu_row is None:
                raise IntegrityError(f"Menu item {item['menu_item_id']} not found")
            quantity = item["quantity"]
            if not decrement_stock(conn, item["menu_item_id"], quantity):
                raise IntegrityError(f"{menu_row['name']} is no longer available in the requested quantity")
            line_items.append({
                "menu_item_id": item["menu_item_id"], "name": menu_row["name"],
                "unit_price_paise": menu_row["price_paise"], "quantity": quantity,
            })
            subtotal_paise += menu_row["price_paise"] * quantity

        # Flat delivery fee (hospital_settings.home_collection_charge, shown in the
        # portal as "Delivery fee"); no distance-based pricing.
        delivery_fee_paise = get_delivery_fee_paise(hospital_id, fulfillment_type)
        total_paise = subtotal_paise + (delivery_fee_paise or 0)

        reference_id = _generate_reference_id(conn, hospital_id, prefix=ORDER_REFERENCE_ID_PREFIX)
        cur = conn.execute(
            "INSERT INTO food_orders (hospital_id, patient_id, phone, status, fulfillment_type, "
            "delivery_address, subtotal_paise, delivery_fee_paise, total_paise, reference_id, payment_method, "
            "created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
            (hospital_id, resolved_patient_id, phone,
             STATUS_PLACED if payment_method == PAYMENT_AT_RESTAURANT else STATUS_PENDING_PAYMENT,
             fulfillment_type, delivery_address, subtotal_paise, delivery_fee_paise, total_paise, reference_id,
             payment_method,
             datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
        )
        order_id_row = cur.fetchone()
        assert order_id_row is not None
        order_id = order_id_row["id"]

        for line in line_items:
            conn.execute(
                "INSERT INTO food_order_items (order_id, menu_item_id, item_name_snapshot, "
                "unit_price_paise_snapshot, quantity) VALUES (?, ?, ?, ?, ?)",
                (order_id, line["menu_item_id"], line["name"], line["unit_price_paise"], line["quantity"]),
            )
        conn.execute("COMMIT")
    except BaseException:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        raise

    created = get_food_order(hospital_id, order_id)
    assert created is not None
    return created


async def create_razorpay_payment(hospital_id: int, order_id: int) -> dict:
    """Initiates payment for an already-created (status='pending_payment')
    order via a Razorpay Payment Link (see modules/payments/razorpay_client.py's
    create_payment_link() docstring for why Payment Links, not Orders).
    Idempotent: if this order already has a razorpay_order_id (e.g. the
    guest's WhatsApp session retried after a transient send failure),
    returns the EXISTING link rather than minting a second one Razorpay
    would happily also accept payment against -- one food order must map to
    exactly one Razorpay payment link."""
    from modules.payments.razorpay_client import RazorpayError, create_payment_link
    from db.repositories.hospitals import get_razorpay_credentials

    order = get_food_order(hospital_id, order_id)
    if order is None:
        raise ValueError(f"food_order {order_id} not found for hospital {hospital_id}")
    if order["razorpay_order_id"]:
        return {
            "razorpay_order_id": order["razorpay_order_id"], "payment_link_url": order["razorpay_payment_link_url"],
            "amount_paise": order["total_paise"], "currency": _CURRENCY,
        }
    if order["status"] != STATUS_PENDING_PAYMENT:
        raise ValueError(f"food_order {order_id} is not awaiting payment (status={order['status']!r})")

    credentials = get_razorpay_credentials(hospital_id)
    if credentials is None:
        raise RazorpayError(f"Hospital {hospital_id} has not configured Razorpay credentials")

    payment_link = await create_payment_link(
        credentials["key_id"], credentials["key_secret"], order["total_paise"], _CURRENCY,
        description=f"Order {order['reference_id']}", receipt=order["reference_id"],
        notes={"hospital_id": str(hospital_id), "food_order_id": str(order_id)}, customer_phone=order["phone"],
    )
    session = get_session()
    session.execute(
        FoodOrder.__table__.update().where(FoodOrder.hospital_id == hospital_id, FoodOrder.id == order_id).values(
            razorpay_order_id=payment_link["id"], razorpay_payment_link_url=payment_link["short_url"],
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    )
    session.commit()
    return {
        "razorpay_order_id": payment_link["id"], "payment_link_url": payment_link["short_url"],
        "amount_paise": order["total_paise"], "currency": _CURRENCY,
    }


def advance_order_status(hospital_id: int, order_id: int, new_status: str, expected_status: str) -> dict | None:
    """The guarded UPDATE ... WHERE status = '<expected_status>' pattern
    borrowed from the commerce reference doc (flagged in Spec.md as a future
    retrofit candidate for cancel_appointment() and similar -- not done yet,
    tracked separately). Returns None if the row's actual status didn't
    match `expected_status` (already transitioned, or the wrong prior
    state) -- callers (portal actions, the Razorpay webhook) treat None as a
    no-op, not an error, which is what makes this safe against duplicate
    webhook deliveries and double-tapped portal buttons alike."""
    conn = get_connection()
    row = conn.execute(
        "UPDATE food_orders SET status = ?, updated_at = ? WHERE hospital_id = ? AND id = ? AND status = ? "
        "RETURNING id",
        (new_status, datetime.now(timezone.utc).isoformat(), hospital_id, order_id, expected_status),
    ).fetchone()
    if row is None:
        return None
    if new_status == STATUS_CANCELLED:
        # The transition above is guarded, so this runs exactly once per order:
        # a cancelled order gives its stock back.
        for item in conn.execute(
            "SELECT menu_item_id, quantity FROM food_order_items WHERE order_id = ?", (order_id,)
        ).fetchall():
            restore_stock(conn, item["menu_item_id"], item["quantity"])
    return get_food_order(hospital_id, order_id)


_ORDER_COLUMNS = (
    FoodOrder.id, FoodOrder.hospital_id, FoodOrder.patient_id, FoodOrder.phone, FoodOrder.status,
    FoodOrder.fulfillment_type, FoodOrder.delivery_address, FoodOrder.subtotal_paise,
    FoodOrder.delivery_fee_paise, FoodOrder.total_paise, FoodOrder.razorpay_order_id,
    FoodOrder.razorpay_payment_id, FoodOrder.razorpay_payment_link_url, FoodOrder.payment_method,
    FoodOrder.reference_id,
    FoodOrder.created_at, FoodOrder.updated_at,
)


def get_food_order(hospital_id: int, order_id: int) -> dict | None:
    session = get_session()
    order_row = session.execute(
        select(*_ORDER_COLUMNS).where(FoodOrder.hospital_id == hospital_id, FoodOrder.id == order_id)
    ).first()
    if order_row is None:
        return None
    order = dict(order_row._mapping)
    item_rows = session.execute(
        select(
            FoodOrderItem.menu_item_id, FoodOrderItem.item_name_snapshot,
            FoodOrderItem.unit_price_paise_snapshot, FoodOrderItem.quantity,
        ).where(FoodOrderItem.order_id == order_id)
    ).all()
    order["items"] = [dict(r._mapping) for r in item_rows]
    return order


def list_food_orders(hospital_id: int, status: str | None = None, since: datetime | None = None) -> list[dict]:
    """Portal's order-list read point -- newest first. `since` (a timezone-aware datetime) leaves out orders placed
    before it, so a page load doesn't return every order the restaurant has ever taken. Includes each order's
    line items via one batched query (same "fetch once, group in-memory"
    shape _booked_spans_by_table() uses for table availability), not N+1 --
    a kitchen/front-of-house view genuinely needs to see what was ordered,
    not just the header row."""
    session = get_session()
    stmt = select(*_ORDER_COLUMNS).where(FoodOrder.hospital_id == hospital_id)
    if status is not None:
        stmt = stmt.where(FoodOrder.status == status)
    if since is not None:
        # created_at is stored as ISO text; compare it as the instant it is
        stmt = stmt.where(cast(FoodOrder.created_at, DateTime(timezone=True)) >= since)
    rows = session.execute(stmt.order_by(FoodOrder.created_at.desc())).all()
    orders = [dict(r._mapping) for r in rows]

    order_ids = [o["id"] for o in orders]
    items_by_order: dict[int, list[dict]] = {}
    if order_ids:
        item_rows = session.execute(
            select(
                FoodOrderItem.order_id, FoodOrderItem.menu_item_id, FoodOrderItem.item_name_snapshot,
                FoodOrderItem.unit_price_paise_snapshot, FoodOrderItem.quantity,
            ).where(FoodOrderItem.order_id.in_(order_ids))
        ).all()
        for row in item_rows:
            items_by_order.setdefault(row.order_id, []).append({
                "menu_item_id": row.menu_item_id, "item_name_snapshot": row.item_name_snapshot,
                "unit_price_paise_snapshot": row.unit_price_paise_snapshot, "quantity": row.quantity,
            })
    for order in orders:
        order["items"] = items_by_order.get(order["id"], [])
    return orders


def handle_razorpay_webhook(body: bytes, signature: str, payload: dict) -> dict | None:
    """Two-phase handling, same shape as webhook/routes.py's own Meta webhook
    handler (approved in the plan): resolve which HOSPITAL this event is for
    from the payload's own structure first (notes.hospital_id, which WE set
    at create_razorpay_payment() time and Razorpay echoes back verbatim on
    both payment_link.entity.notes and payment.entity.notes -- this is a
    structural read of routing metadata, not "processing" the event), THEN
    verify the signature with THAT hospital's own webhook secret. A payload
    claiming to be for hospital A can never pass verification with hospital
    B's secret, even though every hospital's Razorpay events land on this
    one shared endpoint.

    Returns None (caller acks 200, nothing further to do) for anything
    unroutable/unconfigured/unverifiable/non-actionable/already-transitioned
    -- same "nothing to usefully retry" discipline the Meta webhook handler
    uses for a payload shape it doesn't recognize, and the same idempotent-
    no-op discipline advance_order_status() itself already established.
    Returns the now-'paid' order dict when a real transition just happened
    -- webhook/razorpay_routes.py uses that (phone, hospital_id, items,
    reference_id) to send the guest their WhatsApp confirmation and reset
    their session, mirroring table_reservation.py's own post-booking
    success-summary send."""
    from modules.payments.razorpay_client import verify_webhook_signature
    from db.repositories.hospitals import get_razorpay_credentials

    entity = payload.get("payload", {})
    notes = (
        entity.get("payment_link", {}).get("entity", {}).get("notes")
        or entity.get("payment", {}).get("entity", {}).get("notes")
        or entity.get("order", {}).get("entity", {}).get("notes")
        or {}
    )
    hospital_id_raw = notes.get("hospital_id")
    food_order_id_raw = notes.get("food_order_id")
    if hospital_id_raw is None or food_order_id_raw is None:
        return None
    try:
        hospital_id = int(hospital_id_raw)
        food_order_id = int(food_order_id_raw)
    except (TypeError, ValueError):
        return None

    credentials = get_razorpay_credentials(hospital_id)
    if credentials is None:
        return None
    if not verify_webhook_signature(body, signature, credentials["webhook_secret"]):
        return None

    event = payload.get("event", "")
    if event in ("payment_link.paid", "payment.captured", "order.paid"):
        return advance_order_status(hospital_id, food_order_id, STATUS_PAID, expected_status=STATUS_PENDING_PAYMENT)
    return None
