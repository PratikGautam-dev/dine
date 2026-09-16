# flows/food_ordering/__init__.py
"""Food ordering plan (ARCHITECTURE_REFERENCE_FOR_FORKING.md alongside the
sibling "Commerce Architecture Reference" doc), Sub-stage 3 of 4: WhatsApp
flow states. Full plan (data model, flow states, portal changes) reported
and approved by the user before any code was written, same review-before-
build discipline as every other major feature this project.

A genuinely new TOP-LEVEL feature (flows/patient_identity/menu.py's
_FEATURE_MENU, key "order_food"), not a booking TypeFlow -- confirmed by the
approved plan: food ordering is a peer to booking/faq/manage_patients, not a
reservation sub-type, so it gets its own package/state-machine here rather
than growing flows/booking/types/ with an unrelated concern.

Cart lives in session context (menu_browse -> cart_action loop), NOT
persisted, until checkout (connector.create_food_order(), called once with
the full item list) -- same "in-progress state in context, real DB row only
at the point of commitment" shape flows/booking/types/table_reservation.py
already establishes before create_table_reservation() runs. No
pg_advisory_xact_lock anywhere in this flow (confirmed in the approved
plan): a food order isn't contending for a scarce shared resource the way a
table/time-slot is; db/repositories/menu_items.py's per-row atomic stock
guard is the right-sized protection."""
from flows.food_ordering.dispatch import _HANDLERS as HANDLERS, start_food_ordering_flow  # noqa: F401
from flows.food_ordering.state import FREE_TEXT_INPUT_STATES  # noqa: F401
