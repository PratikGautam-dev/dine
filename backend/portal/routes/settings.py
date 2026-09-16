import re

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from admin.validation import _parse_offsets
import db.repository as db
from core.translations import SUPPORTED_LANGUAGES
from db.repositories.handoffs import DEFAULT_HANDOFF_AUTO_RESOLVE_HOURS
from db.repositories.hospital_settings import DEFAULT_FOLLOWUP_VALIDITY_DAYS
from portal.deps import _authenticate, get_current_staff, require_capability, require_permission

router = APIRouter()

# Table reservations: same day-abbreviation set
# db/repositories/tables.py's own _WEEKDAY_ABBREVS uses -- kept as a literal
# copy here (not imported) since that module is WhatsApp-flow-facing and
# this is a portal-only validation concern, same "each layer owns its own
# copy of a small fixed set" precedent this codebase already has elsewhere
# (e.g. appointment_types.py's own DEFAULT_APPOINTMENT_TYPES vs. onboarding's).
_VALID_OPERATING_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}

_TIME_RANGE_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$")

# Section 12.13: minutes bounds mirror db/schema.sql's session_timeout_minutes
# CHECK constraint exactly -- validated here too so a bad value gets a clear
# 400 from this endpoint instead of surfacing as a raw IntegrityError from
# the DB constraint.
_MIN_SESSION_TIMEOUT_MINUTES = 2
_MAX_SESSION_TIMEOUT_MINUTES = 120

# Messages page follow-up: bounds for hospitals.handoff_auto_resolve_hours,
# same "validate here for a clean 400" reasoning as the session-timeout
# bounds above. 1 hour minimum (shorter would risk auto-resolving a handoff
# staff simply hasn't gotten to yet within a normal shift), 1 week maximum
# (longer defeats the point of "don't leave it open indefinitely").
_MIN_HANDOFF_AUTO_RESOLVE_HOURS = 1
_MAX_HANDOFF_AUTO_RESOLVE_HOURS = 168

# Follow-up eligibility window (docs/per-appointment-type-flow-plan.md Phase 2
# Step 2 follow-up): same "validate here for a clean 400" reasoning as the
# bounds above. 1 day minimum (0 would mean no follow-up is ever eligible);
# 365 maximum is a generous ceiling against a fat-fingered entry.
_MIN_FOLLOWUP_VALIDITY_DAYS = 1
_MAX_FOLLOWUP_VALIDITY_DAYS = 365
# Fee ceiling is just a fat-finger guard (₹1,000,000), not a considered
# product limit -- consultation fees are always non-negative (DB CHECK
# constraint already enforces that floor).
_MAX_FEE = 1_000_000


@router.get("/api/portal/settings")
async def portal_get_settings(authorization: str | None = Header(default=None)):
    hospital = _authenticate(authorization)
    if hospital is None:
        return JSONResponse({"error": "Not authenticated."}, status_code=401)
    hospital_settings = db.get_hospital_settings(hospital.id)
    return JSONResponse(
        {
            "name": hospital.name,
            "welcome_message_text": hospital.welcome_message_text or "",
            "reminder_offsets_hours": ",".join(str(h) for h in hospital.reminder_offsets_hours),
            "reminder_template_name": hospital.reminder_template_name or "",
            # Section 12.13: self-serve bot customization.
            "enabled_features": hospital.enabled_features,
            "closing_message_text": hospital.closing_message_text or "",
            "business_hours_text": hospital.business_hours_text or "",
            "default_language": hospital.default_language,
            "language_prompt_enabled": hospital.language_prompt_enabled,
            "session_timeout_minutes": hospital.session_timeout_minutes or 30,
            "handoff_auto_resolve_hours": hospital.handoff_auto_resolve_hours or DEFAULT_HANDOFF_AUTO_RESOLVE_HOURS,
            # CareConnect architecture doc alignment (Spec.md Section 0):
            # unlike enabled_features (operator-only, /admin/edit-tenant),
            # these two ARE genuine self-serve bot customization -- same
            # category as closing_message_text/business_hours_text above.
            "require_patient_confirmation": hospital.require_patient_confirmation,
            "privacy_notice_text": hospital.privacy_notice_text or "",
            # docs/per-appointment-type-flow-plan.md Phase 2 Step 2 follow-up:
            # per-hospital Follow-up settings (db/repositories/hospital_settings.py),
            # not columns on `hospitals` itself.
            "followup_validity_days": hospital_settings["followup_validity_days"] or DEFAULT_FOLLOWUP_VALIDITY_DAYS,
            "followup_fee": hospital_settings["followup_fee"],
            "new_consultation_fee": hospital_settings["new_consultation_fee"],
            # Lab Test Phase 2 follow-up: flat fee added to a home-collection
            # Lab Test booking's price review.
            "home_collection_charge": hospital_settings["home_collection_charge"],
            # Table reservations (migration 0030): restaurant-wide operating
            # hours/turnover -- get_available_table_slots() returns [] with
            # these unset, which is what made a freshly onboarded hospital's
            # WhatsApp table booking silently unbookable until this portal
            # form existed (only the seeded dev/test hospitals had this data,
            # via db/seed.py's own hardcoded values).
            "operating_days": hospital_settings["operating_days"],
            "operating_hours": hospital_settings["operating_hours"],
            "default_turnover_minutes": hospital_settings["default_turnover_minutes"],
            "booking_interval_minutes": hospital_settings["booking_interval_minutes"],
        },
        # Settings-not-updating bug follow-up (Spec.md Section 0): defensive
        # -- rules out any browser/CDN-level HTTP caching of this
        # authenticated GET as a contributing cause, even though the
        # in-process reproduction found the real bug was the frontend
        # trusting its own stale optimistic state after a save, not caching.
        headers={"Cache-Control": "no-store"},
    )


@router.post("/api/portal/settings")
async def portal_update_settings(payload: dict, authorization: str | None = Header(default=None)):
    hospital = _authenticate(authorization)
    if hospital is None:
        return JSONResponse({"error": "Not authenticated."}, status_code=401)

    # Section 12.13 validation -- a clear 400 instead of a raw DB error/silent
    # bad value.
    default_language = payload.get("default_language") or "en"
    if default_language not in SUPPORTED_LANGUAGES:
        return JSONResponse({"error": f"default_language must be one of {sorted(SUPPORTED_LANGUAGES)}."}, status_code=400)

    session_timeout_raw = payload.get("session_timeout_minutes")
    if session_timeout_raw in (None, ""):
        session_timeout_minutes = None
    else:
        try:
            session_timeout_minutes = int(session_timeout_raw)
        except (TypeError, ValueError):
            return JSONResponse({"error": "session_timeout_minutes must be a whole number of minutes."}, status_code=400)
        if not (_MIN_SESSION_TIMEOUT_MINUTES <= session_timeout_minutes <= _MAX_SESSION_TIMEOUT_MINUTES):
            return JSONResponse({
                "error": f"session_timeout_minutes must be between {_MIN_SESSION_TIMEOUT_MINUTES} and {_MAX_SESSION_TIMEOUT_MINUTES}.",
            }, status_code=400)

    handoff_hours_raw = payload.get("handoff_auto_resolve_hours")
    if handoff_hours_raw in (None, ""):
        handoff_auto_resolve_hours = None
    else:
        try:
            handoff_auto_resolve_hours = int(handoff_hours_raw)
        except (TypeError, ValueError):
            return JSONResponse({"error": "handoff_auto_resolve_hours must be a whole number of hours."}, status_code=400)
        if not (_MIN_HANDOFF_AUTO_RESOLVE_HOURS <= handoff_auto_resolve_hours <= _MAX_HANDOFF_AUTO_RESOLVE_HOURS):
            return JSONResponse({
                "error": f"handoff_auto_resolve_hours must be between {_MIN_HANDOFF_AUTO_RESOLVE_HOURS} and {_MAX_HANDOFF_AUTO_RESOLVE_HOURS}.",
            }, status_code=400)

    followup_days_raw = payload.get("followup_validity_days")
    if followup_days_raw in (None, ""):
        followup_validity_days = None
    else:
        try:
            followup_validity_days = int(followup_days_raw)
        except (TypeError, ValueError):
            return JSONResponse({"error": "followup_validity_days must be a whole number of days."}, status_code=400)
        if not (_MIN_FOLLOWUP_VALIDITY_DAYS <= followup_validity_days <= _MAX_FOLLOWUP_VALIDITY_DAYS):
            return JSONResponse({
                "error": f"followup_validity_days must be between {_MIN_FOLLOWUP_VALIDITY_DAYS} and {_MAX_FOLLOWUP_VALIDITY_DAYS}.",
            }, status_code=400)

    def _parse_fee(raw, field_name):
        if raw in (None, ""):
            return None, None
        try:
            fee = float(raw)
        except (TypeError, ValueError):
            return None, JSONResponse({"error": f"{field_name} must be a number."}, status_code=400)
        if not (0 <= fee <= _MAX_FEE):
            return None, JSONResponse({"error": f"{field_name} must be between 0 and {_MAX_FEE}."}, status_code=400)
        return fee, None

    followup_fee, error = _parse_fee(payload.get("followup_fee"), "followup_fee")
    if error:
        return error
    new_consultation_fee, error = _parse_fee(payload.get("new_consultation_fee"), "new_consultation_fee")
    if error:
        return error
    home_collection_charge, error = _parse_fee(payload.get("home_collection_charge"), "home_collection_charge")
    if error:
        return error

    # Same restriction as portal.py's own settings form: credentials/data_tier/
    # portal_password_hash/enabled_features are never touched here, only
    # passed through unchanged -- WhatsApp connection details stay
    # operator-only via /admin/edit-tenant.
    db.update_hospital(
        hospital.id,
        name=hospital.name,
        whatsapp_phone_number_id=hospital.whatsapp_phone_number_id,
        access_token=hospital.access_token,
        app_secret=hospital.app_secret,
        timezone=hospital.timezone,
        welcome_message_text=(payload.get("welcome_message_text") or "").strip() or None,
        reminder_offsets_hours=_parse_offsets(payload.get("reminder_offsets_hours") or ""),
        reminder_template_name=(payload.get("reminder_template_name") or "").strip() or None,
        data_tier=hospital.data_tier,
        external_api_base_url=hospital.external_api_base_url,
        external_api_key=hospital.external_api_key,
        portal_password_hash=hospital.portal_password_hash,
        enabled_features=hospital.enabled_features,
        # Migration 0014: feature_labels is no longer a per-hospital,
        # self-serve setting (moved to platform_settings, see that
        # migration's docstring) -- passed through unchanged, same
        # "operator-only, never touched here" discipline as enabled_features
        # above.
        feature_labels=hospital.feature_labels,
        closing_message_text=(payload.get("closing_message_text") or "").strip() or None,
        business_hours_text=(payload.get("business_hours_text") or "").strip() or None,
        default_language=default_language,
        language_prompt_enabled=bool(payload.get("language_prompt_enabled", True)),
        session_timeout_minutes=session_timeout_minutes,
        handoff_auto_resolve_hours=handoff_auto_resolve_hours,
        require_patient_confirmation=bool(payload.get("require_patient_confirmation", False)),
        privacy_notice_text=(payload.get("privacy_notice_text") or "").strip() or None,
        # Tenant-type-driven capability gating (tenant-capability-gating-plan.md):
        # not self-serve -- passed straight through unchanged, same
        # discipline every other operator-only field on this call already
        # follows (enabled_features, portal_password_hash, ...). Only
        # admin/tenants_api.py's tenant-edit endpoint actually changes these.
        tenant_type=hospital.tenant_type,
        admin_capabilities=hospital.admin_capabilities,
        # Migration 0014: same "moved to platform_settings, pass through
        # unchanged" treatment as feature_labels above.
        dpdp_consent_required=hospital.dpdp_consent_required,
    )
    db.update_hospital_settings(
        hospital.id, followup_validity_days=followup_validity_days,
        followup_fee=followup_fee, new_consultation_fee=new_consultation_fee,
        home_collection_charge=home_collection_charge,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "settings.update",
        entity_type="hospital", entity_id=str(hospital.id),
        before={"default_language": hospital.default_language, "session_timeout_minutes": hospital.session_timeout_minutes},
        after={"default_language": default_language, "session_timeout_minutes": session_timeout_minutes},
    )
    return JSONResponse({"ok": True})


@router.post("/api/portal/settings/restaurant-hours")
async def portal_update_restaurant_hours(payload: dict, authorization: str | None = Header(default=None)):
    """Table reservations (migration 0030): a separate route from
    portal_update_settings() above, matching update_restaurant_hours()'s own
    "separate write path, this group has no portal UI yet" docstring --
    that existing route's full-object-save body needs zero changes. Minimal
    on purpose: a single operating_hours range, not multiple (the repository
    function itself supports a list, but one range is enough to unblock a
    freshly onboarded hospital's WhatsApp table booking, which is the actual
    gap this closes)."""
    hospital = _authenticate(authorization)
    if hospital is None:
        return JSONResponse({"error": "Not authenticated."}, status_code=401)
    forbidden = require_capability(hospital, "manage_settings")
    if forbidden:
        return forbidden

    operating_days = payload.get("operating_days") or []
    if not isinstance(operating_days, list) or any(d not in _VALID_OPERATING_DAYS for d in operating_days):
        return JSONResponse({"error": f"operating_days must be a list drawn from {sorted(_VALID_OPERATING_DAYS)}."}, status_code=400)

    operating_hours = payload.get("operating_hours") or []
    if not isinstance(operating_hours, list) or any(not _TIME_RANGE_RE.match(h) for h in operating_hours):
        return JSONResponse({"error": "operating_hours must be a list of \"HH:MM-HH:MM\" ranges."}, status_code=400)
    for time_range in operating_hours:
        start, end = time_range.split("-")
        if start >= end:
            return JSONResponse({"error": f"Invalid time range {time_range!r}: start must be before end."}, status_code=400)

    try:
        default_turnover_minutes = int(payload.get("default_turnover_minutes"))
        booking_interval_minutes = int(payload.get("booking_interval_minutes"))
    except (TypeError, ValueError):
        return JSONResponse({"error": "default_turnover_minutes and booking_interval_minutes must be whole numbers."}, status_code=400)
    if default_turnover_minutes <= 0 or booking_interval_minutes <= 0:
        return JSONResponse({"error": "default_turnover_minutes and booking_interval_minutes must both be positive."}, status_code=400)

    db.update_restaurant_hours(
        hospital.id, operating_days, operating_hours, default_turnover_minutes, booking_interval_minutes,
    )
    db.record_audit_log(
        "portal", hospital.id, "tenant portal", "restaurant_hours.update",
        entity_type="hospital", entity_id=str(hospital.id),
        after={
            "operating_days": operating_days, "operating_hours": operating_hours,
            "default_turnover_minutes": default_turnover_minutes, "booking_interval_minutes": booking_interval_minutes,
        },
    )
    return JSONResponse({"ok": True})


@router.get("/api/portal/audit-log")
async def portal_audit_log(authorization: str | None = Header(default=None)):
    """This tenant's own 'portal'-level audit rows only -- never
    'platform_admin' rows (data_tier/API-key/tenant_type changes stay
    operator-only, visible through admin/tenants_api.py's own audit-log
    route instead). Gated by manage_settings, same capability that already
    gates this file's own settings-update route, rather than inventing a
    new one just for reading history."""
    hospital = _authenticate(authorization)
    if hospital is None:
        return JSONResponse({"error": "Not authenticated."}, status_code=401)
    forbidden = require_capability(hospital, "manage_settings")
    if forbidden:
        return forbidden
    return JSONResponse({"entries": db.get_audit_logs(hospital_id=hospital.id, actor_level="portal")})
