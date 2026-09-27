# --- Human handoff queue (Section 14.5 follow-up) ---
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from core.money import format_price
from core.whatsapp import WhatsAppClient
from db.repositories.food_orders import STATUS_PENDING_PAYMENT, STATUS_PREPARING, STATUS_READY_FOR_PICKUP, STATUS_OUT_FOR_DELIVERY
from portal.deps import _authenticate, _session_id, authorize

router = APIRouter()


@router.get("/api/portal/handoffs")
async def portal_get_handoffs(
    status: str = "open", date: str | None = None, reason: str | None = None,
    authorization: str | None = Header(default=None),
):
    """Item 6 (Spec.md Section 0): date ("YYYY-MM-DD"), when given, scopes
    to requests created that one calendar day -- status filtering
    (open/resolved/all) already existed. Messages page follow-up: reason
    ("system_error"), when given, is the "Errored" tab -- passed with
    status="all" by the frontend so an already-resolved bot error still
    shows up, not just currently-open ones."""
    principal, error = authorize(authorization, "messages", "view")
    if error:
        return error
    hospital = principal.hospital
    status_filter = None if status == "all" else status
    handoffs = db.get_handoff_requests(hospital.id, status=status_filter, date_str=date, reason=reason)
    # The guest's name, as the other portal lists show it: from their profile at THIS restaurant (one batched lookup).
    names = db.get_patient_names_by_phone(hospital.id, [h["phone"] for h in handoffs])
    return JSONResponse({"handoffs": [{**h, "patient_name": names.get(h["phone"])} for h in handoffs]})


@router.post("/api/portal/handoffs/{handoff_id}/delete")
async def portal_delete_handoff(handoff_id: int, authorization: str | None = Header(default=None)):
    """Item 3: soft-delete only, same convention as bookings above."""
    principal, error = authorize(authorization, "messages", "delete")
    if error:
        return error
    hospital = principal.hospital
    ok = db.soft_delete_handoff(hospital.id, handoff_id)
    if not ok:
        return JSONResponse({"error": "No such handoff request."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "handoffs.delete",
        entity_type="handoff", entity_id=str(handoff_id),
    )
    return JSONResponse({"ok": True})


@router.post("/api/portal/handoffs/{handoff_id}/resolve")
async def portal_resolve_handoff(handoff_id: int, authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "messages", "write")
    if error:
        return error
    hospital = principal.hospital
    ok = db.resolve_handoff_request(hospital.id, handoff_id, resolved_by=_session_id(authorization))
    if not ok:
        return JSONResponse({"error": "No such open handoff request."}, status_code=404)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "handoffs.resolve",
        entity_type="handoff", entity_id=str(handoff_id),
    )
    return JSONResponse({"ok": True})


@router.post("/api/portal/handoffs/bulk-resolve")
async def portal_bulk_resolve_handoffs(payload: dict, authorization: str | None = Header(default=None)):
    """Messages page bulk action. payload = {"handoff_ids": [1, 2, 3]} --
    silently skips any id that isn't this hospital's own, or isn't currently
    open (see bulk_resolve_handoff_requests()'s own docstring); the response
    reports exactly which ids were actually resolved so the frontend can
    show a caller a real count, not an optimistic one."""
    principal, error = authorize(authorization, "messages", "write")
    if error:
        return error
    hospital = principal.hospital
    handoff_ids = (payload or {}).get("handoff_ids")
    if not isinstance(handoff_ids, list) or not handoff_ids:
        return JSONResponse({"error": "handoff_ids (a non-empty list) is required."}, status_code=400)
    resolved_ids = db.bulk_resolve_handoff_requests(hospital.id, handoff_ids, resolved_by=_session_id(authorization))
    for handoff_id in resolved_ids:
        db.record_audit_log(
            "portal", hospital.id, "tenant portal", "handoffs.resolve",
            entity_type="handoff", entity_id=str(handoff_id),
        )
    return JSONResponse({"ok": True, "resolved": resolved_ids})


@router.post("/api/portal/handoffs/bulk-delete")
async def portal_bulk_delete_handoffs(payload: dict, authorization: str | None = Header(default=None)):
    """Messages page bulk action -- soft-delete only, same convention
    portal_delete_handoff() above already follows."""
    principal, error = authorize(authorization, "messages", "delete")
    if error:
        return error
    hospital = principal.hospital
    handoff_ids = (payload or {}).get("handoff_ids")
    if not isinstance(handoff_ids, list) or not handoff_ids:
        return JSONResponse({"error": "handoff_ids (a non-empty list) is required."}, status_code=400)
    deleted_ids = db.bulk_soft_delete_handoffs(hospital.id, handoff_ids)
    for handoff_id in deleted_ids:
        db.record_audit_log(
            "portal", hospital.id, "tenant portal", "handoffs.delete",
            entity_type="handoff", entity_id=str(handoff_id),
        )
    return JSONResponse({"ok": True, "deleted": deleted_ids})


@router.post("/api/portal/handoffs/{handoff_id}/reply")
async def portal_reply_handoff(handoff_id: int, payload: dict, authorization: str | None = Header(default=None)):
    """Sends a real WhatsApp message back to the patient (does NOT itself
    resolve the handoff -- a staff member may reply more than once before
    marking it done, e.g. asking a clarifying question first).

    Two-way threading follow-up (Spec.md Section 0): now also records the
    reply as an outbound handoff_messages row -- ONLY after the WhatsApp
    send actually succeeds, so the thread never shows a reply that wasn't
    really delivered."""
    principal, error = authorize(authorization, "messages", "write")
    if error:
        return error
    hospital = principal.hospital

    text = (payload or {}).get("text", "").strip()
    if not text:
        return JSONResponse({"error": "Reply text is required."}, status_code=400)

    matches = [h for h in db.get_handoff_requests(hospital.id, status=None) if h["id"] == handoff_id]
    if not matches:
        return JSONResponse({"error": "No such handoff request."}, status_code=404)
    phone = matches[0]["phone"]

    if not (hospital.whatsapp_phone_number_id and hospital.access_token):
        return JSONResponse({"error": "WhatsApp is not configured for this hospital yet."}, status_code=400)
    wa = WhatsAppClient(phone_number_id=hospital.whatsapp_phone_number_id, access_token=hospital.access_token, hospital_id=hospital.id)
    await wa.send_text(phone, text)
    message = db.add_handoff_message(hospital.id, handoff_id, "outbound", text)
    return JSONResponse({"ok": True, "message": message})


def _menu_text(hospital_id: int) -> str | None:
    items = db.get_menu_items(hospital_id, available_only=True)
    if not items:
        return None
    by_category: dict[str, list[dict]] = {}
    for item in items:
        by_category.setdefault(item["category"] or "Menu", []).append(item)
    lines = ["*Today's menu*"]
    for category, group in by_category.items():
        lines.append(f"\n*{category}*")
        lines += [f"- {i['name']} — {format_price(i['price_paise'])}" for i in group]
    lines.append("\nReply with what you'd like and we'll get it started!")
    return "\n".join(lines)


def _ready_status_for_order(order: dict) -> str:
    return STATUS_OUT_FOR_DELIVERY if order["fulfillment_type"] == "delivery" else STATUS_READY_FOR_PICKUP


# action -> a function of (hospital, phone) returning (text, error) -- exactly one is not None.
# Each either performs a real state change (confirm_booking/advance_order_status) or composes a
# message from real, already-stored data (the menu, a stored payment link, an order's own status).
# None of these fabricate anything: an action with no matching real record for this guest errors
# instead of sending something misleading.
async def _run_quick_action(action: str, hospital, phone: str) -> tuple[str | None, str | None]:
    if action == "send_menu":
        text = _menu_text(hospital.id)
        return (text, None) if text else (None, "No available menu items to send.")

    if action == "confirm_booking":
        appt = db.get_pending_appointment_for_phone(hospital.id, phone)
        if appt is None:
            return None, "No pending booking to confirm for this guest."
        if not db.confirm_booking(hospital.id, appt.id):
            return None, "That booking isn't pending confirmation any more."
        where = appt.table_name or appt.department_name
        text = (
            f"✅ Your reservation is confirmed!\n\n"
            f"🆔 Reservation ID: {appt.reference_id}\n"
            f"📍 {where}\n"
            f"📅 Date: {appt.scheduled_at.strftime('%A, %d %B %Y')}\n"
            f"🕐 Time: {appt.scheduled_at.strftime('%I:%M %p')}\n\n"
            f"We look forward to seeing you."
        )
        return text, None

    if action == "mark_ready":
        order = next((o for o in db.list_food_orders(hospital.id, phone=phone, limit=5) if o["status"] == STATUS_PREPARING), None)
        if order is None:
            return None, "No order in preparation for this guest to mark ready."
        updated = db.advance_order_status(hospital.id, order["id"], _ready_status_for_order(order), expected_status=STATUS_PREPARING)
        if updated is None:
            return None, "That order isn't in preparation any more."
        verb = "out for delivery" if updated["fulfillment_type"] == "delivery" else "ready for pickup"
        return f"🍽️ Your order #{updated['reference_id']} is {verb}!", None

    if action == "send_payment_link":
        order = next(
            (o for o in db.list_food_orders(hospital.id, phone=phone, limit=5)
             if o["status"] == STATUS_PENDING_PAYMENT and o["razorpay_payment_link_url"]),
            None,
        )
        if order is None:
            return None, "No order awaiting payment for this guest."
        return f"Here's your payment link for order #{order['reference_id']}: {order['razorpay_payment_link_url']}", None

    if action == "take_order":
        return "Ready to order? Reply with what you'd like from our menu, or say \"menu\" to browse first.", None

    if action == "reschedule":
        upcoming = db.get_upcoming_appointments_for_phone(hospital.id, phone)
        if upcoming:
            when = upcoming[0].scheduled_at.strftime("%A, %d %B at %I:%M %p")
            return f"Would you like to reschedule your reservation currently set for {when}? Reply with your preferred new date and time.", None
        return "Would you like to reschedule? Reply with your preferred new date and time.", None

    if action == "send_update":
        orders = db.list_food_orders(hospital.id, phone=phone, limit=1)
        if orders:
            o = orders[0]
            return f"Update on order #{o['reference_id']}: it's currently {o['status'].replace('_', ' ')}.", None
        upcoming = db.get_upcoming_appointments_for_phone(hospital.id, phone)
        if upcoming:
            when = upcoming[0].scheduled_at.strftime("%A, %d %B at %I:%M %p")
            return f"Update on your reservation: still confirmed for {when}.", None
        return None, "Nothing to send an update about for this guest yet."

    return None, f"Unknown quick action: {action!r}"


@router.post("/api/portal/handoffs/{handoff_id}/quick-action")
async def portal_handoff_quick_action(handoff_id: int, payload: dict, authorization: str | None = Header(default=None)):
    """WhatsApp Inbox's quick-action row above the reply box -- one click does a real thing (confirm
    a pending booking, mark an in-progress order ready, resend a stored payment link, ...) and sends
    the guest a real WhatsApp text about it, logged into the same two-way thread portal_reply_handoff()
    writes to. Errors (no matching order/booking for this guest) come back as a message, not a silent
    no-op or a fabricated send."""
    principal, error = authorize(authorization, "messages", "write")
    if error:
        return error
    hospital = principal.hospital

    action = (payload or {}).get("action", "").strip()
    if not action:
        return JSONResponse({"error": "action is required."}, status_code=400)

    matches = [h for h in db.get_handoff_requests(hospital.id, status=None) if h["id"] == handoff_id]
    if not matches:
        return JSONResponse({"error": "No such handoff request."}, status_code=404)
    phone = matches[0]["phone"]

    text, action_error = await _run_quick_action(action, hospital, phone)
    if action_error:
        return JSONResponse({"error": action_error}, status_code=409)

    if not (hospital.whatsapp_phone_number_id and hospital.access_token):
        return JSONResponse({"error": "WhatsApp is not configured for this hospital yet."}, status_code=400)
    wa = WhatsAppClient(phone_number_id=hospital.whatsapp_phone_number_id, access_token=hospital.access_token, hospital_id=hospital.id)
    await wa.send_text(phone, text)
    message = db.add_handoff_message(hospital.id, handoff_id, "outbound", text)
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", f"handoff.quick_action.{action}",
        entity_type="handoff", entity_id=str(handoff_id),
    )
    return JSONResponse({"ok": True, "message": message})


@router.get("/api/portal/handoffs/{handoff_id}/messages")
async def portal_get_handoff_messages(handoff_id: int, authorization: str | None = Header(default=None)):
    """Two-way threading follow-up: the full ordered thread for one handoff
    -- single source of truth for the portal's chat-thread UI."""
    principal, error = authorize(authorization, "messages", "view")
    if error:
        return error
    hospital = principal.hospital
    matches = [h for h in db.get_handoff_requests(hospital.id, status=None) if h["id"] == handoff_id]
    if not matches:
        return JSONResponse({"error": "No such handoff request."}, status_code=404)
    return JSONResponse({"messages": db.get_handoff_messages(hospital.id, handoff_id)})
