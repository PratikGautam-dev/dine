from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import authorize

router = APIRouter()

_VALID_DAYS = (1, 7, 30, 90)


@router.get("/api/portal/reports")
async def portal_reports(days: int = 30, authorization: str | None = Header(default=None)):
    """The Reports page's one real data source: an aggregate over food_orders + appointments +
    patients (migration-free -- no new tables). No multi-channel/payment-split/export exists."""
    principal, error = authorize(authorization, "reports", "view")
    if error:
        return error
    hospital = principal.hospital
    if days not in _VALID_DAYS:
        days = 30
    return JSONResponse(db.get_reports_summary(hospital.id, days=days))
