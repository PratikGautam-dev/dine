from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import db.repository as db
from portal.deps import authorize

router = APIRouter()


@router.get("/api/portal/feedback")
async def portal_feedback(authorization: str | None = Header(default=None)):
    """The Feedback page's one real data source: WhatsApp guest ratings (migration 0045).
    No sentiment/NPS/complaint-category data exists, so none is returned."""
    principal, error = authorize(authorization, "feedback", "view")
    if error:
        return error
    hospital = principal.hospital
    return JSONResponse({
        "summary": db.get_feedback_summary(hospital.id),
        "entries": db.list_feedback(hospital.id),
    })
