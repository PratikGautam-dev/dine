# portal/routes/__init__.py -- mounts one APIRouter per resource
# (auth, dashboard, patients, documents, bookings, doctors, appointment_types,
# settings, handoffs) into a single router app.py includes, mirroring the
# original portal_api.py's flat router but split along resource boundaries.
from fastapi import APIRouter

from portal.routes.appointment_types import router as appointment_types_router
from portal.routes.attendance import router as attendance_router
from portal.routes.auth import router as auth_router
from portal.routes.bookings import router as bookings_router
from portal.routes.dashboard import router as dashboard_router
from portal.routes.doctors import router as doctors_router
from portal.routes.food_ordering import router as food_ordering_router
from portal.routes.handoffs import router as handoffs_router
from portal.routes.leave import router as leave_router
from portal.routes.live_operations import router as live_operations_router
from portal.routes.patients import router as patients_router
from portal.routes.procedures import router as procedures_router
from portal.routes.roles import router as roles_router
from portal.routes.settings import router as settings_router
from portal.routes.staff import router as staff_router
from portal.routes.staff_auth import router as staff_auth_router
from portal.routes.tables import router as tables_router
from portal.routes.waitlist import router as waitlist_router
from portal.routes.chef_notes import router as chef_notes_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(dashboard_router)
router.include_router(patients_router)
router.include_router(bookings_router)
router.include_router(doctors_router)
router.include_router(appointment_types_router)
router.include_router(procedures_router)
router.include_router(food_ordering_router)
router.include_router(tables_router)
router.include_router(waitlist_router)
router.include_router(chef_notes_router)
router.include_router(settings_router)
router.include_router(handoffs_router)
router.include_router(live_operations_router)
# RBAC (docs/rbac-redis-plan.md): unified staff login + the roles/permissions
# and staff-management admin UIs -- additive alongside auth_router/
# doctor_auth_router above, not a replacement, during the dual-path
# migration window.
router.include_router(staff_auth_router)
router.include_router(staff_router)
router.include_router(roles_router)
router.include_router(leave_router)
router.include_router(attendance_router)
