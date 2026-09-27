# auth/customer_session.py
"""Web Storefront customer login (migration 0051) -- modeled directly on auth/jwt_session.py's
PyJWT pattern, but a structurally separate token type: `typ: "customer"`, its own secret
(CUSTOMER_JWT_SECRET), and a 30-day TTL instead of staff's deliberately-short 15 minutes -- a
guest ordering food shouldn't have to re-verify an OTP every 15 minutes the way a staff member
re-authenticates against a live, revocable session. There is no token_version/revocation mechanism
here (unlike staff tokens) -- a customer token is just "this phone number was OTP-verified"; the
worst a stolen one can do is see someone's own order history and place orders as them, not touch
another restaurant's data or staff-only anything, so the short-lived-refresh-token machinery staff
auth needs isn't worth the complexity here.

Same "a leaked secret should only forge the one thing it's for" precedent JWT_SECRET vs
SUPER_ADMIN_JWT_SECRET vs DOCTOR_SECRET already established: a leaked CUSTOMER_JWT_SECRET must never
verify as a staff or super-admin token, and vice versa -- verify_customer_token() checks `typ`
explicitly, not just signature validity, same as verify_access_token()."""
import hashlib
import hmac
import time

import jwt

from core.config import get_settings

_CUSTOMER_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60


def _secret() -> str:
    settings = get_settings()
    if settings.CUSTOMER_JWT_SECRET:
        return settings.CUSTOMER_JWT_SECRET
    # Derived, never blank -- an empty JWT_SECRET is a deployment-config problem the rest of the
    # app already has to deal with; this just avoids ALSO being silently forgeable when only
    # CUSTOMER_JWT_SECRET (not JWT_SECRET) was left unset.
    return hmac.new(settings.JWT_SECRET.encode(), b"customer", hashlib.sha256).hexdigest()


def issue_customer_token(phone: str, name: str | None) -> str:
    now = int(time.time())
    payload = {"sub": phone, "name": name, "typ": "customer", "iat": now, "exp": now + _CUSTOMER_TOKEN_TTL_SECONDS}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def verify_customer_token(token: str) -> dict | None:
    try:
        claims = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != "customer":
        return None
    return claims


def get_current_customer(authorization: str | None) -> dict | None:
    """Parses "Bearer <token>" and returns {"phone", "name"} or None. Every /api/public customer
    route calls this directly (there's no dependency-injection principal object like portal/deps.py's
    staff `authorize()`, since a public route has no hospital/role to resolve -- just a phone)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    claims = verify_customer_token(authorization[len("Bearer "):])
    if claims is None:
        return None
    return {"phone": claims["sub"], "name": claims.get("name")}
