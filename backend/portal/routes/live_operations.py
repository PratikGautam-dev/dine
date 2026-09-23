# portal/routes/live_operations.py
"""Live Operations page -- one aggregate GET composing bookings, food orders, WhatsApp handoffs and table
occupancy (db/repositories/live_operations.py's get_live_operations_summary). All writes go through each
domain's own existing route (tables.py's seat/clear/needs_cleaning, food_ordering.py's order actions,
bookings.py's attendance, handoffs.py's resolve) -- this page is a read-only composition, no new write path
of its own."""
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import _authenticate, authorize

router = APIRouter()


@router.get("/api/portal/live-operations")
async def portal_live_operations(authorization: str | None = Header(default=None)):
    principal, error = authorize(authorization, "live_operations", "view")
    if error:
        return error
    return JSONResponse(db.get_live_operations_summary(principal.hospital.id))
