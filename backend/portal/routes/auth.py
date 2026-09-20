# portal/routes/auth.py
"""
The old shared-password portal login, now retired.

Every restaurant used to be able to set one shared "portal password" and sign in with it.
That session carried no person and no role, so it passed every permission check -- anyone
holding the password had full access to the restaurant, whatever role the owner had
configured for their staff. It is gone: staff sign in individually at
/api/portal/staff/login (portal/routes/staff_auth.py), and every portal route now checks
the signed-in person's role (portal/deps.py's authorize()).

The route is kept only so an old client gets a clear, permanent answer instead of a 404.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/api/portal/login")
async def portal_login(payload: dict | None = None):
    return JSONResponse(
        {"error": "The shared portal password has been retired. Sign in with your own staff account."},
        status_code=410,
    )
