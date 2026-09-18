# db/feature_keys.py
"""Feature keys the onboarding wizard (and older stored tenant rows) used
before flows/patient_identity/menu.py's _FEATURE_MENU became the single
source of truth for which WhatsApp features exist. "book_doctor_appointment"
is the same capability under its current name ("book_appointment"); the
others no longer exist as WhatsApp features at all. Kept dependency-free so
both admin/onboarding_api.py and db/init_db.py can import it."""

LEGACY_FEATURE_ALIASES = {"book_doctor_appointment": "book_appointment"}
DEAD_FEATURE_KEYS = {"tests_diagnostics", "hospital_info", "reception_handoff", "reports_prescriptions"}


def normalize_feature_keys(features: list[str]) -> list[str]:
    result: list[str] = []
    for key in features:
        key = LEGACY_FEATURE_ALIASES.get(key, key)
        if key in DEAD_FEATURE_KEYS or key in result:
            continue
        result.append(key)
    return result
