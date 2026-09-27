from datetime import datetime

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse, Response

import db.repository as db
from portal.deps import authorize

router = APIRouter()

_VALID_DAYS = (1, 7, 30, 90)
_VALID_EXPORT_KINDS = ("sales", "orders", "customers", "bookings")


@router.get("/api/portal/reports")
async def portal_reports(days: int = 30, channel: str = "", authorization: str | None = Header(default=None)):
    """The Reports page's one real data source: an aggregate over food_orders + appointments +
    patients (migration-free -- no new tables). `channel` (whatsapp/web/takeaway/delivery/
    dine_in) is a real filter, not decorative -- see reports.py's _channel_where()."""
    principal, error = authorize(authorization, "reports", "view")
    if error:
        return error
    hospital = principal.hospital
    if days not in _VALID_DAYS:
        days = 30
    return JSONResponse(db.get_reports_summary(hospital.id, days=days, channel=channel or None))


@router.get("/api/portal/reports/export")
async def portal_reports_export(
    kind: str, days: int = 30, channel: str = "", authorization: str | None = Header(default=None),
):
    """Real CSV downloads for the Reports page's "Download Reports" card -- built from the same
    underlying tables the summary above reads, not a re-serialization of aggregate KPIs."""
    principal, error = authorize(authorization, "reports", "view")
    if error:
        return error
    if kind not in _VALID_EXPORT_KINDS:
        return JSONResponse({"error": f"Unknown report kind {kind!r}."}, status_code=400)
    if days not in _VALID_DAYS:
        days = 30
    csv_text = db.export_report_csv(principal.hospital.id, kind, days=days, channel=channel or None)
    filename = f"{kind}-report-{datetime.now().strftime('%Y-%m-%d')}.csv"
    return Response(
        content=csv_text, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
