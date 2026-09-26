# portal/permissions.py
"""
Per-role, per-page view/write/delete permissions (docs/rbac-redis-plan.md) --
the direct sibling of portal/capabilities.py, same fixed-set-+-membership-
tests shape, just one level more granular: capabilities.py gates whole
PAGES/features on for a TENANT (hospital vs. clinic); this module gates
individual ACTIONS on those pages for a ROLE within one tenant (Admin can
delete a patient, Receptionist can only view/write, Doctor can't see
Settings at all). The two are orthogonal and both apply -- a clinic tenant
without MANAGE_DOCTORS capability shows no Doctors nav item to ANY role
regardless of what role_permissions says, since capabilities.py's gate runs
first, at the tenant level.

Permissions are per-ROLE only (locked in with the user, docs/rbac-redis-plan.md's
own "Decisions locked in" section) -- not per-individual overrides. Every
Admin at a hospital has identical permissions to every other Admin there;
editing "Admin" changes it for every admin at that hospital at once. This is
what makes ONE row per (hospital, role, page) (db/schema.sql's
role_permissions table) sufficient, rather than needing a row per staff
member.
"""
import re

from db.repositories.role_permissions import get_role_permissions
from portal.permission_cache import get_cached_matrix, set_cached_matrix

PAGE_DASHBOARD = "dashboard"
PAGE_APPOINTMENTS = "appointments"
PAGE_PATIENTS = "patients"
PAGE_DOCTORS = "doctors"
PAGE_MESSAGES = "messages"
PAGE_SETTINGS = "settings"
PAGE_STAFF = "staff"  # staff management page (create/deactivate staff_users)
PAGE_ROLES = "roles"  # roles & permissions editor (this module's own admin UI)
PAGE_SCHEDULE = "schedule"  # a doctor's own working hours/breaks/leave editor
# Diagnostic/Lab Phase 2 (docs/per-appointment-type-flow-plan.md Step 5): the
# Diagnostic Tests management page (tests/variants + resources/machines) --
# same weight as PAGE_DOCTORS, off by default for receptionist/doctor.
PAGE_DIAGNOSTIC_TESTS = "diagnostic_tests"
# Food ordering plan, Sub-stage 4: menu-item CRUD and the orders list/detail
# + status-action page, split into two page keys (unlike manage_food_ordering
# being one tenant-level capability) since a role reasonably might need one
# without the other (e.g. a kitchen-facing role that only touches orders,
# never edits the menu) -- same granularity PAGE_DOCTORS/PAGE_SCHEDULE
# already split for an analogous "manage the catalog" vs. "work the
# day-to-day" distinction.
PAGE_FOOD_MENU = "food_menu"
PAGE_FOOD_ORDERS = "food_orders"
# Table reservations, portal follow-up: the real tables (physical dining
# tables) CRUD page -- a separate page key from PAGE_DOCTORS, which stays
# the staff/schedule entity's own page (see PortalSidebar.tsx's own comment
# on why "doctors" wasn't deleted).
PAGE_TABLES = "tables"
# Live Operations follow-up: a read-only composite view over bookings/orders/handoffs/tables that
# already-existing page permissions gate individually -- this page key exists only so it can be
# independently shown/hidden per role, same "own page key even though it has no unique write action"
# precedent PAGE_DASHBOARD sets.
PAGE_LIVE_OPERATIONS = "live_operations"
# Feedback (migration 0045): the WhatsApp star-rating/comment page -- own page key so it can be
# shown/hidden per role independently, same PAGE_LIVE_OPERATIONS precedent.
PAGE_FEEDBACK = "feedback"
# Reports: a read-only aggregate over food_orders/appointments/patients -- own page key, same
# "no unique write action but still independently visible" precedent as Live Operations/Feedback.
PAGE_REPORTS = "reports"
# Offers & Coupons (migration 0046): real coupon codes redeemable at WhatsApp food-order checkout.
PAGE_OFFERS = "offers"
# Automations (migration 0047): real trigger -> WhatsApp message rules (feedback_received wired
# first) -- the Messages & Automations page's one real section.
PAGE_AUTOMATIONS = "automations"

# Staff HR: leave and attendance (docs: the CareConnect reference, adapted). my_leave is every
# person's own leave page (and their notifications); leave_requests is the Manager's review queue;
# check_in_out is clocking in/out plus your own history; attendance is the whole team's view and
# corrections; attendance_settings is the shift/location rules.
PAGE_MY_LEAVE = "my_leave"
PAGE_LEAVE_REQUESTS = "leave_requests"
PAGE_CHECK_IN_OUT = "check_in_out"
PAGE_ATTENDANCE = "attendance"
PAGE_ATTENDANCE_SETTINGS = "attendance_settings"

ALL_PAGES = {
    PAGE_DASHBOARD, PAGE_APPOINTMENTS, PAGE_PATIENTS, PAGE_DOCTORS,
    PAGE_MESSAGES, PAGE_SETTINGS, PAGE_STAFF, PAGE_ROLES, PAGE_SCHEDULE, PAGE_DIAGNOSTIC_TESTS,
    PAGE_FOOD_MENU, PAGE_FOOD_ORDERS, PAGE_TABLES, PAGE_LIVE_OPERATIONS, PAGE_FEEDBACK, PAGE_REPORTS, PAGE_OFFERS,
    PAGE_AUTOMATIONS,
    PAGE_MY_LEAVE, PAGE_LEAVE_REQUESTS, PAGE_CHECK_IN_OUT, PAGE_ATTENDANCE, PAGE_ATTENDANCE_SETTINGS,
}
ACTIONS = ("view", "write", "delete")

_ALL_TRUE = {"view": True, "write": True, "delete": True}
_VIEW_ONLY = {"view": True, "write": False, "delete": False}
_VIEW_WRITE = {"view": True, "write": True, "delete": False}
_NONE = {"view": False, "write": False, "delete": False}

# Single source of truth for both onboarding's explicit seeding write
# (submit_onboarding() below) and get_permission_matrix()'s runtime fallback
# for a hospital that predates this feature -- same role
# DEFAULT_CAPABILITIES_BY_TYPE plays for portal/capabilities.py's
# get_capabilities(). Admin defaults to all-true on every page (including
# STAFF/ROLES -- an admin manages other staff and edits this very matrix by
# default) but, per the plan, is editable like everything else -- this is
# only ever the STARTING point for a hospital's admin role, not a floor.
# Everyone: apply for their own leave, clock in and out, see their own history. The review queue, the
# team-wide attendance view and the attendance rules are Owner/Manager only (admin is all-true above).
_STAFF_SELF_SERVICE = {
    PAGE_MY_LEAVE: dict(_VIEW_WRITE),
    PAGE_CHECK_IN_OUT: dict(_VIEW_WRITE),
    PAGE_LEAVE_REQUESTS: dict(_NONE),
    PAGE_ATTENDANCE: dict(_NONE),
    PAGE_ATTENDANCE_SETTINGS: dict(_NONE),
}

DEFAULT_PERMISSIONS_BY_ROLE: dict[str, dict[str, dict[str, bool]]] = {
    "admin": {page: dict(_ALL_TRUE) for page in ALL_PAGES},
    # Front of House (host / server): works the floor -- reservations, guests, messages
    # and orders. Reads the menu and the table layout but cannot change either, and can
    # never delete anything.
    "receptionist": {
        PAGE_DASHBOARD: dict(_VIEW_ONLY),
        PAGE_APPOINTMENTS: dict(_VIEW_WRITE),
        PAGE_PATIENTS: dict(_VIEW_WRITE),
        PAGE_MESSAGES: dict(_VIEW_WRITE),
        PAGE_DOCTORS: dict(_NONE),
        PAGE_SETTINGS: dict(_NONE),
        PAGE_STAFF: dict(_NONE),
        PAGE_ROLES: dict(_NONE),
        PAGE_SCHEDULE: dict(_NONE),
        PAGE_DIAGNOSTIC_TESTS: dict(_NONE),
        PAGE_FOOD_MENU: dict(_VIEW_ONLY),
        PAGE_FOOD_ORDERS: dict(_VIEW_WRITE),
        # Live Operations follow-up: front-of-house is who actually seats/clears tables, so this
        # moved from _VIEW_ONLY to _VIEW_WRITE (same "write" gate the new seat/clear actions use) --
        # also unlocks the existing table create/edit form, which a host arranging the floor
        # reasonably needs too.
        PAGE_TABLES: dict(_VIEW_WRITE),
        PAGE_LIVE_OPERATIONS: dict(_VIEW_ONLY),
        PAGE_FEEDBACK: dict(_VIEW_ONLY),
        PAGE_REPORTS: dict(_VIEW_ONLY),
        PAGE_OFFERS: dict(_VIEW_ONLY),
        PAGE_AUTOMATIONS: dict(_NONE),
        **_STAFF_SELF_SERVICE,
    },
    # Kitchen Staff: works the orders and the menu's availability (sold out / stock).
    # Sees today's reservations and the table layout for prep, never guest records,
    # messages, staff or settings.
    "kitchen": {
        PAGE_DASHBOARD: dict(_VIEW_ONLY),
        PAGE_APPOINTMENTS: dict(_VIEW_ONLY),
        PAGE_PATIENTS: dict(_NONE),
        PAGE_MESSAGES: dict(_NONE),
        PAGE_DOCTORS: dict(_NONE),
        PAGE_SETTINGS: dict(_NONE),
        PAGE_STAFF: dict(_NONE),
        PAGE_ROLES: dict(_NONE),
        PAGE_SCHEDULE: dict(_NONE),
        PAGE_DIAGNOSTIC_TESTS: dict(_NONE),
        PAGE_FOOD_MENU: dict(_VIEW_WRITE),
        PAGE_FOOD_ORDERS: dict(_VIEW_WRITE),
        PAGE_TABLES: dict(_VIEW_ONLY),
        PAGE_LIVE_OPERATIONS: dict(_VIEW_ONLY),
        PAGE_FEEDBACK: dict(_VIEW_ONLY),
        PAGE_REPORTS: dict(_NONE),
        PAGE_OFFERS: dict(_NONE),
        PAGE_AUTOMATIONS: dict(_NONE),
        **_STAFF_SELF_SERVICE,
    },
}

# The three built-in roles every restaurant starts with (Owner/Manager, Front of House, Kitchen
# Staff), in display order. The old "doctor" (linked table manager) login role is retired.
ASSIGNABLE_ROLES = ("admin", "receptionist", "kitchen")
VALID_ROLES = ASSIGNABLE_ROLES

def role_key_from_name(name: str) -> str:
    """"Cashier" -> "cashier", "Front Desk Lead" -> "front_desk_lead" -- the same role string
    stored on staff_details.role and role_permissions.role. Collapses any run of non-alphanumeric
    characters to a single underscore and strips leading/trailing ones, so two names that only
    differ in punctuation/spacing land on the same key (caught as a duplicate, not silently
    creating two rows for what a staff member would read as the same role)."""
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


def get_assignable_roles(hospital_id: int) -> tuple[str, ...]:
    """The 3 built-in roles plus any custom role this hospital has created (create_role() in
    db/repositories/role_permissions.py seeds a full, real permission-grid row per page for a new
    role_key -- any role_permissions row for this hospital whose role isn't one of the built-in 3
    IS a custom role by definition, no separate roles table needed). Used everywhere a role
    assignment gets validated: staff create/edit (portal/routes/staff.py) and the
    permission-matrix PUT (portal/routes/roles.py)."""
    custom = sorted({row["role"] for row in get_role_permissions(hospital_id)} - set(ASSIGNABLE_ROLES))
    return ASSIGNABLE_ROLES + tuple(custom)


def resolve_default_permissions(role: str) -> dict[str, dict[str, bool]]:
    """Onboarding's own explicit-write helper (mirrors
    capabilities.resolve_default_capabilities()) -- returns a plain dict
    (not the shared DEFAULT_PERMISSIONS_BY_ROLE reference) so a caller can
    freely pass it into a DB write without risking a later in-place mutation
    corrupting the module-level default for every other hospital."""
    return {page: dict(actions) for page, actions in DEFAULT_PERMISSIONS_BY_ROLE.get(role, {}).items()}


def get_permission_matrix(hospital_id: int) -> dict[str, dict[str, dict[str, bool]]]:
    """{role: {page_key: {view, write, delete}}} for every role -- Redis-
    cached (portal/permission_cache.py) since this is read on every
    permission-gated request via has_permission() below. Falls back to
    DEFAULT_PERMISSIONS_BY_ROLE for any (role, page) this hospital has no row
    for at all -- covers both a hospital that predates this feature entirely
    (zero rows) and a hospital with rows for some roles/pages but not a
    newly-added page_key (a future page added after this hospital was
    onboarded), so a permission check never has to treat "no row" as
    "access denied" by default."""
    cached = get_cached_matrix(hospital_id)
    if cached is not None:
        return cached

    rows = get_role_permissions(hospital_id)
    matrix: dict[str, dict[str, dict[str, bool]]] = {
        role: resolve_default_permissions(role) for role in DEFAULT_PERMISSIONS_BY_ROLE
    }
    for row in rows:
        role, page_key = row["role"], row["page_key"]
        matrix.setdefault(role, {})[page_key] = {
            "view": row["can_view"], "write": row["can_write"], "delete": row["can_delete"],
        }
    set_cached_matrix(hospital_id, matrix)
    return matrix


def has_permission(hospital_id: int, role: str, page_key: str, action: str) -> bool:
    """The check every route calls (via portal/deps.py's require_permission())
    -- an unrecognized role or page_key resolves to False (fail closed),
    matching this codebase's general "an unrecognized key is simply never
    granted/read" discipline (e.g. capabilities.get_capabilities()'s
    `& ALL_CAPABILITIES` intersection)."""
    matrix = get_permission_matrix(hospital_id)
    return bool(matrix.get(role, {}).get(page_key, {}).get(action, False))
