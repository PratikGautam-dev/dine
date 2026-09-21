# db/orm_models.py
"""SQLAlchemy ORM model classes, added one domain at a time as each
db/repositories/*.py file migrates off raw SQL (see the SQLAlchemy ORM +
Alembic migration plan). These map onto tables that already exist --
created/versioned by db/schema.sql + db/migrations/ -- never by
Base.metadata.create_all(); a new column still needs its own Alembic
revision, adding it here alone changes nothing in the database.

Datetime columns are mapped as String, not DateTime: every timestamp in this
schema is stored as ISO-8601 TEXT (db/schema.sql's own header comment
explains why), not a native Postgres TIMESTAMP -- mapping them as DateTime
here would silently change how SQLAlchemy binds/reads these columns from
what every existing raw-SQL repository function already does.

ForeignKey() below mirrors constraints db/schema.sql already enforces in
Postgres -- it's metadata only (documents cardinality/relations so they're
visible by reading this file), not a behavior change: no relationship()
pairs, no cascade, no lazy-loading. A column only gets ForeignKey() here if
the table actually has that REFERENCES clause in schema.sql; a few TEXT
columns that look like foreign keys (e.g. appointments.appointment_type_id)
aren't DB-enforced and are deliberately left plain to match."""
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class CareConnectAccount(Base):
    """db/schema.sql's care_connect_accounts table -- see that file's own
    comment for the "why global, not hospital-scoped" identity-layer
    reasoning. status/created_at are Postgres-side defaults ('active',
    now()::text) -- always created via a Core `insert(CareConnectAccount)
    .values()` with NO columns set (never the ORM's own instance-persistence
    path), matching the original `INSERT ... DEFAULT VALUES` exactly; the
    ORM's own new-instance INSERT path sends an explicit NULL for any unset
    column instead of omitting it, which would violate this table's NOT NULL
    constraints -- verified empirically before relying on it."""
    __tablename__ = "care_connect_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str]
    created_at: Mapped[str]
    updated_at: Mapped[str | None]
    # migration 0006 -- global, id-derived (db/display_ids.py), not yet
    # surfaced in any UI; see patients.patient_display_id for the precedent.
    # Nullable at the DB level only for the same "INSERT can't know its own
    # id yet" reason patient_display_id is -- always set in practice by the
    # time any caller reads the row (see that migration's own docstring).
    display_id: Mapped[str | None]
    # Language-persistence follow-up (confirmed with the user): a chosen
    # language is GLOBAL to the account (same language at every hospital
    # this person messages), not per-hospital like dpdp_consents --
    # language is a personal preference, not a hospital-specific compliance
    # matter. NULL means "never chosen yet" -- flows/router.py's
    # _enter_idle() still shows the picker in that case, same as before
    # this column existed.
    language: Mapped[str | None]


class WhatsappIdentity(Base):
    """db/schema.sql's whatsapp_identities table. Same Core-insert-only
    caveat as CareConnectAccount above applies to created_at.
    care_connect_account_id is UNIQUE in the DB -- genuinely 1:1 with
    CareConnectAccount today, not 1:M (modeled as a separate table anyway to
    leave room for a future second channel identity per account)."""
    __tablename__ = "whatsapp_identities"

    id: Mapped[int] = mapped_column(primary_key=True)
    care_connect_account_id: Mapped[int] = mapped_column(ForeignKey("care_connect_accounts.id"), unique=True)
    provider_user_id: Mapped[str]
    username: Mapped[str | None]
    phone_number: Mapped[str | None]
    created_at: Mapped[str]
    updated_at: Mapped[str | None]


class AppointmentType(Base):
    """db/schema.sql's appointment_types table -- one row per (hospital, type
    id), PRIMARY KEY (hospital_id, id) matching the table's own composite
    key. is_active/requires_consent/requires_doctor_selection all have
    Postgres-side defaults, but every write path today (db/init_db.py,
    db/seed.py, db/repositories/hospitals.py) always sets every column
    explicitly, so unlike CareConnectAccount above there's no unset-column-
    vs-server-default pitfall to worry about here -- nothing currently
    inserts a row via this model regardless (see appointment_types.py, read-
    only so far)."""
    __tablename__ = "appointment_types"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), primary_key=True)
    label: Mapped[str]
    requires_consent: Mapped[bool]
    requires_doctor_selection: Mapped[bool]
    is_active: Mapped[bool]
    # Platform-admin-controlled whitelist (edit-tenant page): whether this
    # tenant may use this type AT ALL. is_active is the tenant's own portal-
    # level on/off switch WITHIN that whitelist -- a type can never be
    # is_active=True while is_allowed=False, enforced in
    # db/repositories/appointment_types.py's set_appointment_type_active().
    is_allowed: Mapped[bool]
    sort_order: Mapped[int]


class Procedure(Base):
    """db/schema.sql's procedures table (Daycare/Procedure rebuild) -- the
    hospital-configurable procedure catalog (Step 1's list, Step 2's booking
    mode)."""
    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    category: Mapped[str]
    name: Mapped[str]
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    booking_mode: Mapped[str]
    duration_minutes: Mapped[int]
    estimated_price_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
    estimated_price_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool]
    sort_order: Mapped[int]


class ProcedureRequiredResourceType(Base):
    """db/schema.sql's procedure_required_resource_types table -- which
    resource pools (bed_chair/equipment/staff) a procedure needs, combined."""
    __tablename__ = "procedure_required_resource_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"))
    resource_type: Mapped[str]


class ProcedureInstruction(Base):
    """db/schema.sql's procedure_instructions table -- Step 5's hospital-
    configured pre-procedure instructions, one row per line item."""
    __tablename__ = "procedure_instructions"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedures.id"))
    instruction_type: Mapped[str]
    instruction_text: Mapped[str]
    sort_order: Mapped[int]


class ProcedureResource(Base):
    """db/schema.sql's procedure_resources table -- one row per physical
    bed/chair, machine, or nursing/technician slot-line."""
    __tablename__ = "procedure_resources"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    resource_type: Mapped[str]
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    name: Mapped[str]
    working_days: Mapped[str]
    working_hours: Mapped[str]
    slot_duration_minutes: Mapped[int]
    breaks: Mapped[str]
    max_bookings_per_slot: Mapped[int]
    daily_booking_limit: Mapped[int | None]
    effective_from: Mapped[str | None]
    is_active: Mapped[bool]


class ProcedureResourceLeave(Base):
    """db/schema.sql's procedure_resource_leave table."""
    __tablename__ = "procedure_resource_leave"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    resource_id: Mapped[str] = mapped_column(ForeignKey("procedure_resources.id"))
    date: Mapped[str]
    reason: Mapped[str | None]


class ProcedureResourceSlot(Base):
    """db/schema.sql's procedure_resource_slots table."""
    __tablename__ = "procedure_resource_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    resource_id: Mapped[str] = mapped_column(ForeignKey("procedure_resources.id"))
    scheduled_at: Mapped[str]
    blocked: Mapped[bool]
    block_reason: Mapped[str | None]


class AppointmentProcedureResource(Base):
    """db/schema.sql's appointment_procedure_resources table -- N concrete
    resources bound to one procedure appointment (bed #3 + IV pump #1 +
    nurse-line B, all at the same scheduled_at)."""
    __tablename__ = "appointment_procedure_resources"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    appointment_id: Mapped[int] = mapped_column(ForeignKey("appointments.id"))
    resource_id: Mapped[str] = mapped_column(ForeignKey("procedure_resources.id"))
    resource_type: Mapped[str]
    resource_name: Mapped[str]


class FaqTopic(Base):
    """db/schema.sql's faq_topics table -- the faq_flow_type's entire data
    model (SPEC Section 14.2)."""
    __tablename__ = "faq_topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    topic_label: Mapped[str]
    answer_text: Mapped[str]
    display_order: Mapped[int]


class DoctorLeave(Base):
    """db/schema.sql's doctor_leave table -- one row per date a doctor is
    unavailable for the whole day (Section 14.7)."""
    __tablename__ = "doctor_leave"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    doctor_id: Mapped[str] = mapped_column(ForeignKey("doctors.id"))
    date: Mapped[str]
    reason: Mapped[str | None]


class DoctorSlot(Base):
    """db/schema.sql's doctor_slots table -- real, persisted bookable slots
    (Section 12.1.1). created_at isn't mapped -- nothing ORM-migrated so far
    (leave.py's DELETE, slots.py's own reads/writes) reads or writes it."""
    __tablename__ = "doctor_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    doctor_id: Mapped[str] = mapped_column(ForeignKey("doctors.id"))
    scheduled_at: Mapped[str]
    blocked: Mapped[bool]
    block_reason: Mapped[str | None]


class Department(Base):
    """db/schema.sql's departments table. id is a caller-generated opaque
    string (h{hospital_id}_{uuid}), not a DB-assigned SERIAL -- see
    create_department()'s own docstring."""
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    name: Mapped[str]
    # migration 0038 -- display order among the restaurant's sections (1.., 0 = unset)
    sort_order: Mapped[int]


class DoctorRow(Base):
    """db/schema.sql's doctors table -- the FULL, authoritative mapping, per
    doctors.py's own migration (slots.py originally added this as a partial
    model with just max_bookings_per_slot; extended here to every column,
    per that model's own "doctors.py's own migration should define the
    complete model" instruction). Named DoctorRow, not Doctor, to leave that
    name free for a future dataclass -- see UserAccount's docstring for the
    same naming precedent."""
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    name: Mapped[str]
    working_days: Mapped[str]
    working_hours: Mapped[str]
    slot_duration_minutes: Mapped[int]
    breaks: Mapped[str]
    max_bookings_per_slot: Mapped[int]
    daily_booking_limit: Mapped[int | None]
    online_quota: Mapped[int | None]
    walkin_quota: Mapped[int | None]
    followup_duration_minutes: Mapped[int | None]
    effective_from: Mapped[str | None]
    is_active: Mapped[bool]
    email: Mapped[str | None]
    password_hash: Mapped[str | None]


class TableRow(Base):
    """db/schema.sql's tables table (migration 0030, Stage 4) -- a single-
    pool bookable resource, unlike DoctorRow/ProcedureResource: no
    working_days/working_hours/slot_duration_minutes/max_bookings_per_slot
    columns, since restaurant operating hours are shared across every table
    (see hospital_settings' own new columns) rather than scheduled per-table,
    and a table holds exactly one party at a time by definition. Named
    TableRow, not Table, to leave that name free for a future dataclass (same
    precedent DoctorRow/AppointmentRow's own docstrings establish) and to
    avoid colliding with sqlalchemy's own Table construct."""
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    name: Mapped[str]
    capacity: Mapped[int]
    is_active: Mapped[bool]


class TableLeave(Base):
    """db/schema.sql's table_leave table (migration 0030) -- mirrors
    ProcedureResourceLeave: a one-off date a specific table is unavailable
    (maintenance, a private buyout), on top of the shared restaurant
    operating hours every table otherwise follows."""
    __tablename__ = "table_leave"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    table_id: Mapped[str] = mapped_column(ForeignKey("tables.id"))
    date: Mapped[str]
    reason: Mapped[str | None]


class MenuItem(Base):
    """db/schema.sql's menu_items table (migration 0031, food ordering
    Sub-stage 1) -- id follows TableRow's own opaque "h{hospital_id}_{uuid8}"
    TEXT id convention (create_table()/create_department()), assigned in
    application code, not this model. stock_count is nullable = unlimited;
    v1's "sold out today" design is a plain atomic decrement/reset on this
    column (confirmed with the user), not a time-window/capacity concept."""
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    name: Mapped[str]
    description: Mapped[str | None]
    price_paise: Mapped[int]
    category: Mapped[str | None]
    is_available: Mapped[bool]
    stock_count: Mapped[int | None]
    # migration 0033 -- merchant-pasted photo link; NULL = text-only item.
    image_url: Mapped[str | None]
    created_at: Mapped[str]
    updated_at: Mapped[str]


class FoodOrder(Base):
    """db/schema.sql's food_orders table (migration 0031, food ordering
    Sub-stage 1) -- NOT a resource-pool booking (no doctor/table/procedure
    slot is reserved), so it's a standalone table, not another row shape
    packed into appointments. patient_id reuses the existing patients/
    patient_links guest-identity system directly (confirmed with the user)
    -- no parallel "customers" table. reference_id is ORD-<DDMMYY>-<NNN>,
    its own independent daily counter (db/display_ids.py, reference_id_
    counters widened to (hospital_id, day, prefix) by this same migration)
    so it can never collide with or be confused for an appointment's
    APT-<DDMMYY>-<NNN> reference_id. status transitions (Sub-stage 2) use a
    guarded UPDATE ... WHERE status = '<prior-state>', not this repo's
    advisory-lock pattern -- there's no shared resource pool being
    contended over for a food order."""
    __tablename__ = "food_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"))
    phone: Mapped[str]
    status: Mapped[str]
    fulfillment_type: Mapped[str | None]
    delivery_address: Mapped[str | None]
    subtotal_paise: Mapped[int]
    delivery_fee_paise: Mapped[int | None]
    total_paise: Mapped[int]
    razorpay_order_id: Mapped[str | None]
    razorpay_payment_id: Mapped[str | None]
    # migration 0032 -- the actual Payment Links URL sent to the guest (see
    # modules/payments/razorpay_client.py's create_payment_link() docstring
    # for why the Orders API's own id alone isn't enough for this product's
    # WhatsApp-text delivery mechanism).
    razorpay_payment_link_url: Mapped[str | None]
    # migration 0033 -- 'pay_at_restaurant' | 'online'.
    payment_method: Mapped[str]
    reference_id: Mapped[str | None]
    created_at: Mapped[str]
    updated_at: Mapped[str]


class FoodOrderItem(Base):
    """db/schema.sql's food_order_items table (migration 0031) --
    item_name_snapshot/unit_price_paise_snapshot are captured AT ORDER TIME,
    not read live off MenuItem, so editing a menu item's name/price later
    never retroactively changes an already-placed order -- same "don't
    reinterpret a historical booking" precedent appointments.
    turnover_minutes established (migration 0030)."""
    __tablename__ = "food_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("food_orders.id"))
    menu_item_id: Mapped[str] = mapped_column(ForeignKey("menu_items.id"))
    item_name_snapshot: Mapped[str]
    unit_price_paise_snapshot: Mapped[int]
    quantity: Mapped[int]


class AppointmentRow(Base):
    """db/schema.sql's appointments table -- the FULL, authoritative mapping,
    per appointments.py's own migration (closing the "partial, extend later"
    deferrals slots.py and patients.py both left on this model). Named
    AppointmentRow, not Appointment, since db/models.py already has an
    Appointment dataclass with a different (fuller, JOINED-with-department/
    doctor/patient) shape -- _row_to_appointment() in that module still maps
    the JOIN result (raw or ORM) onto that dataclass unchanged.

    _upsert_patient()/create_appointment() (db/repositories/appointments.py)
    do NOT use this model for their writes -- see those functions' own
    docstrings (advisory-lock + multi-statement-transaction code stays raw
    SQL permanently, same reasoning as patients.py's create_patient_profile()
    trio). appointment_type_id is deliberately plain (no ForeignKey()) --
    schema.sql adds that column with no REFERENCES clause, so it isn't
    DB-enforced against appointment_types' composite (hospital_id, id) key."""
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    phone: Mapped[str]
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    doctor_id: Mapped[str | None] = mapped_column(ForeignKey("doctors.id"))
    scheduled_at: Mapped[str]
    status: Mapped[str]
    source: Mapped[str]
    booking_ordinal: Mapped[int]
    reference_id: Mapped[str | None]
    created_at: Mapped[str]
    updated_at: Mapped[str | None]
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"))
    patient_name: Mapped[str | None]
    patient_phone: Mapped[str | None]
    patient_age: Mapped[int | None]
    deleted_at: Mapped[str | None]
    appointment_type_id: Mapped[str | None]
    consent_given_at: Mapped[str | None]
    video_link: Mapped[str | None]
    followup_override_until: Mapped[str | None]
    # Daycare/Procedure rebuild: which catalog procedure, its own approval
    # sub-status (None for every other appointment type), a price-at-booking
    # snapshot, an optional order/prescription reference, and a pending
    # "Request Reschedule" slot -- see db/schema.sql's own column comments.
    # The bound resources (N rows) live in AppointmentProcedureResource, not here.
    procedure_id: Mapped[int | None] = mapped_column(ForeignKey("procedures.id"))
    procedure_status: Mapped[str | None]
    procedure_estimated_price_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
    procedure_estimated_price_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
    procedure_order_reference: Mapped[str | None]
    procedure_reschedule_requested_at: Mapped[str | None]
    # Stage 4 (migration 0030): which table this reservation is assigned to
    # (None for every other appointment type -- see the doctor_or_resource_
    # or_procedure_or_table check constraint), the party size, and the
    # turnover duration stamped at booking time (not dynamically read from
    # hospital_settings.default_turnover_minutes on every read).
    table_id: Mapped[str | None] = mapped_column(ForeignKey("tables.id"))
    party_size: Mapped[int | None]
    turnover_minutes: Mapped[int | None]


class AppointmentReminder(Base):
    """db/schema.sql's appointment_reminders table."""
    __tablename__ = "appointment_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    appointment_id: Mapped[int] = mapped_column(ForeignKey("appointments.id"))
    offset_hours: Mapped[float]
    sent_at: Mapped[str]


# UserAccount ("users" table) and HospitalUser ("hospital_users" table)
# used to live here -- Google-OAuth accounts and the hospital-ownership join
# table (Section 15). Migration 0016 replaced them with Identity/
# HospitalOwner; migration 0017 dropped both tables once the new ones were
# verified correct in production. See Identity's own docstring.


class HandoffRequest(Base):
    """db/schema.sql's handoff_requests table -- the human-handoff queue
    (see that file's own comment for the two unrelated triggers that share
    this one table)."""
    __tablename__ = "handoff_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    phone: Mapped[str]
    reason: Mapped[str]
    message_text: Mapped[str | None]
    status: Mapped[str]
    created_at: Mapped[str]
    resolved_at: Mapped[str | None]
    deleted_at: Mapped[str | None]
    resolved_by: Mapped[str | None]


class HandoffMessage(Base):
    """db/schema.sql's handoff_messages table -- real two-way conversation
    threading for an active handoff."""
    __tablename__ = "handoff_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    handoff_request_id: Mapped[int] = mapped_column(ForeignKey("handoff_requests.id"))
    direction: Mapped[str]
    message_text: Mapped[str]
    created_at: Mapped[str]


class HospitalRow(Base):
    """db/schema.sql's hospitals table -- the FULL, authoritative mapping
    (every column the table has), named HospitalRow (not Hospital, which is
    db/models.py's dataclass _row_to_hospital() below maps onto). This is
    the model db/repositories/users.py's get_hospitals_for_user() deferred
    to, per that function's own docstring -- update that deferral note if
    this model's shape ever changes in a way that affects it.

    is_active/language_prompt_enabled are genuinely INTEGER columns in
    Postgres (not BOOLEAN) -- db/schema.sql's own column definitions --
    mapped as int here to match; require_patient_confirmation/
    dpdp_consent_required ARE real BOOLEAN columns. Mixed on purpose,
    matching the schema exactly rather than normalizing them to look
    consistent."""
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    whatsapp_phone_number_id: Mapped[str | None]
    meta_access_token_ref: Mapped[str | None]
    app_secret_ref: Mapped[str | None]
    timezone: Mapped[str]
    welcome_message_text: Mapped[str | None]
    reminder_offsets_hours: Mapped[str]
    reminder_template_name: Mapped[str | None]
    data_tier: Mapped[str]
    external_api_base_url: Mapped[str | None]
    external_api_key: Mapped[str | None]
    portal_password_hash: Mapped[str | None]
    flow_type: Mapped[str]
    enabled_features: Mapped[str | None]
    feature_labels: Mapped[str | None]
    closing_message_text: Mapped[str | None]
    business_hours_text: Mapped[str | None]
    default_language: Mapped[str | None]
    language_prompt_enabled: Mapped[int | None]
    session_timeout_minutes: Mapped[int | None]
    handoff_auto_resolve_hours: Mapped[int | None]
    is_active: Mapped[int]
    created_at: Mapped[str]
    patient_id_prefix: Mapped[str | None]
    require_patient_confirmation: Mapped[bool]
    privacy_notice_text: Mapped[str | None]
    dpdp_consent_required: Mapped[bool]
    tenant_type: Mapped[str]
    admin_capabilities: Mapped[str | None]
    # migration 0006 -- global, id-derived (db/display_ids.py); shown to
    # hospital users the same way patients.patient_display_id is shown to
    # patients. Nullable at the DB level for the same reason
    # CareConnectAccount.display_id is -- see that model's own comment.
    display_id: Mapped[str | None]
    # migration 0031 (food ordering) -- same per-tenant credential-storage
    # shape as whatsapp_phone_number_id/meta_access_token_ref/app_secret_ref
    # above; "_ref" suffix on the two secret-bearing columns matches that
    # existing naming (a secret-store reference, not the raw secret).
    razorpay_key_id: Mapped[str | None]
    razorpay_key_secret_ref: Mapped[str | None]
    razorpay_webhook_secret_ref: Mapped[str | None]


class PatientRow(Base):
    """db/schema.sql's patients table -- the full mapping (12 columns, matches
    the table exactly). Named PatientRow, not Patient, to leave that name
    free for a future dataclass -- see UserAccount's docstring for the same
    naming precedent. create_patient_profile()/link_existing_patient()/
    _link_patient_under_cap() (db/repositories/patients.py) do NOT use this
    model -- see those functions' own docstrings for why (advisory-lock +
    multi-statement-transaction code stays raw SQL permanently).
    patient_display_id (DCCP-<year>-<seq>) and mrn (MRN-<hospital short
    code>-<year>-<seq>) are generated together, same sequence number, by
    db/models.py's _generate_patient_identifiers() -- see migration 0003
    (original format) and db/display_ids.py (yearly-resetting format)."""
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    phone: Mapped[str]
    name: Mapped[str | None]
    date_of_birth: Mapped[str | None]
    gender: Mapped[str | None]
    address: Mapped[str | None]
    age: Mapped[int | None]
    created_at: Mapped[str]
    status: Mapped[str]
    patient_display_id: Mapped[str | None]
    mrn: Mapped[str | None]


class PatientLink(Base):
    """db/schema.sql's patient_links table -- the full mapping. See
    PatientRow's docstring for the same "advisory-lock code stays raw"
    caveat on the write path (_link_patient_under_cap). patient_id has no
    unique constraint here (unlike WhatsappIdentity.care_connect_account_id
    above) -- this is the genuine M:M join between whatsapp_phone and
    patients: one phone can hold up to MAX_ACTIVE_PATIENT_LINKS active
    links, and nothing stops the same patient being linked from a second
    phone. care_connect_account_id is NOT NULL (migration 0002) -- every
    write path (patients.py's _link_patient_under_cap(), init_db.py's
    _backfill_patient_links()) stamps it via _get_or_create_account_in_conn()
    at INSERT time; whatsapp_phone remains the actual join key, this column
    is not yet read by any lookup."""
    __tablename__ = "patient_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    whatsapp_phone: Mapped[str]
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    relationship_label: Mapped[str | None]
    linked_at: Mapped[str]
    unlinked_at: Mapped[str | None]
    service_consent: Mapped[bool]
    marketing_consent: Mapped[bool]
    care_connect_account_id: Mapped[int] = mapped_column(ForeignKey("care_connect_accounts.id"))


class DpdpConsent(Base):
    """db/schema.sql's dpdp_consents table -- one row per (hospital,
    whatsapp_phone) that has an on-file AGREED DPDP consent decision. See
    db/repositories/consent.py for the read/write logic; only the read side
    (has_agreed_to_dpdp_consent) is ORM-based so far -- record_dpdp_consent()
    is still raw SQL, see that function's own docstring for why."""
    __tablename__ = "dpdp_consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    whatsapp_phone: Mapped[str]
    care_connect_account_id: Mapped[int | None] = mapped_column(ForeignKey("care_connect_accounts.id"))
    consented_at: Mapped[str]


class AuditLog(Base):
    """db/schema.sql's audit_logs table -- two-level audit trail
    (tenant-capability-gating-plan.md's follow-up). actor_level is
    'platform_admin' or 'portal' (see db/repositories/audit_logs.py for the
    single source of truth on valid actions/redaction). hospital_id is
    nullable only for a hypothetical cross-tenant platform action; every row
    written today sets it."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_level: Mapped[str]
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id"))
    actor_label: Mapped[str]
    action: Mapped[str]
    entity_type: Mapped[str | None]
    entity_id: Mapped[str | None]
    before_value: Mapped[str | None]
    after_value: Mapped[str | None]
    created_at: Mapped[str]


class CodeSequence(Base):
    """db/schema.sql's code_sequences table -- the single shared atomic
    counter every yearly-resetting display id (DCCG/DCCH/DCCC/DCCP, see
    db/display_ids.py's module docstring) increments through, keyed on
    (prefix, scope_key, period_key). scope_key is "global" for CareConnect
    account/hospital/clinic ids, or str(hospital_id) for patient ids;
    period_key is str(year) for all of them today. Deliberately NOT used by
    APT (appointment reference ids) -- that one predates this table and
    resets daily, not yearly, via its own reference_id_counters table."""
    __tablename__ = "code_sequences"

    id: Mapped[int] = mapped_column(primary_key=True)
    prefix: Mapped[str]
    scope_key: Mapped[str]
    period_key: Mapped[str]
    last_value: Mapped[int]


# StaffUser ("staff_users" table) used to live here -- unified per-person
# staff login (docs/rbac-redis-plan.md). Migration 0016 replaced it with
# Identity + StaffDetail; migration 0017 dropped the table. See Identity's
# own docstring.


class RolePermission(Base):
    """db/schema.sql's role_permissions table -- one row per (hospital, role,
    page), not a JSON blob, since portal/permissions.py reads this on every
    permission check and the Roles & Permissions admin UI edits it
    cell-by-cell."""
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    role: Mapped[str]
    page_key: Mapped[str]
    can_view: Mapped[bool]
    can_write: Mapped[bool]
    can_delete: Mapped[bool]


# SuperAdmin ("super_admins" table) used to live here -- global,
# not hospital-scoped platform-operator accounts. Migration 0016 replaced it
# with Identity + SuperAdminDetail; migration 0017 dropped the table. See
# Identity's own docstring.


class Identity(Base):
    """db/schema.sql's identities table (migration 0016) -- the shared
    identity/credential row for every principal in this app: a Google-OAuth
    hospital owner (google_id set, password_hash NULL), a password-login
    hospital staff member, or a password-login super admin (password_hash
    set for both, google_id NULL). email is globally unique
    (ux_identities_email, case-insensitive) across ALL of them.

    Deliberately carries NO privilege/role column of its own (no
    is_super_admin flag) -- which kind of principal a row is comes ONLY from
    whether a matching StaffDetail or SuperAdminDetail row exists. A flag on
    this shared, widely-written table would be one stray UPDATE (or a bug in
    some unrelated staff/OAuth write path) away from silently granting
    platform-wide access; a separate table means super-admin status
    requires an actual row, only ever inserted by the dedicated super-admin
    provisioning path (db/repositories/super_admins.py's create_super_admin)
    -- confirmed with the user, this safety property matters more than the
    extra table's minimal storage overhead. See migration 0016's own
    docstring for why this replaced the old users/staff_users/super_admins
    tables (and hospital_users), all four of which migration 0017 later
    dropped once these new tables were verified correct in production."""
    __tablename__ = "identities"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str]
    name: Mapped[str | None]
    google_id: Mapped[str | None]
    password_hash: Mapped[str | None]
    is_active: Mapped[bool]
    token_version: Mapped[int]
    created_at: Mapped[str]
    updated_at: Mapped[str | None]


class StaffDetail(Base):
    """db/schema.sql's staff_details table (migration 0016) -- the
    hospital/role/doctor_id extension for an Identity that's a hospital
    staff member, replacing StaffUser's own columns of the same name.
    identity_id is the primary key (1:1 with Identity, mirroring StaffUser's
    old "one staff_users row per person" cardinality). Since migration 0018,
    this also covers Google-OAuth hospital owners (role='admin' -- no
    separate 'owner' role; confirmed with the user, a hospital's role
    vocabulary stays exactly admin/receptionist/doctor) -- see the comment
    where HospitalOwner used to be defined, just below."""
    __tablename__ = "staff_details"

    identity_id: Mapped[int] = mapped_column(ForeignKey("identities.id"), primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"))
    role: Mapped[str]
    # Legacy (the retired "doctor" login role linked a login to a doctors row). Always NULL now.
    doctor_id: Mapped[str | None] = mapped_column(ForeignKey("doctors.id"))
    # migration 0035 -- the Staff page's profile fields
    phone: Mapped[str | None]
    address: Mapped[str | None]
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))  # the section they work
    reports_to_id: Mapped[int | None] = mapped_column(ForeignKey("identities.id"))
    employee_id: Mapped[str | None]  # EMP-ST-00001, unique per restaurant
    # migration 0037 -- the weekly working pattern (comma-joined Mon..Sun, and an HH:MM shift)
    working_days: Mapped[str | None]
    shift_start: Mapped[str | None]
    shift_end: Mapped[str | None]


class SuperAdminDetail(Base):
    """db/schema.sql's super_admin_details table (migration 0016) -- a bare
    marker row: an Identity with a matching row here is a platform/super
    admin. Deliberately a separate table, not a flag on Identity itself --
    see Identity's own docstring for the security reasoning (privilege
    requires a row only the dedicated provisioning path ever inserts, not a
    column any Identity-writing code could accidentally flip)."""
    __tablename__ = "super_admin_details"

    identity_id: Mapped[int] = mapped_column(ForeignKey("identities.id"), primary_key=True)


# HospitalOwner ("hospital_owners" table) used to live here -- migration
# 0016 introduced it as an M:M ownership link (Identity <-> Hospital) for
# Google-OAuth sign-ins, repointed from the old HospitalUser table.
# Migration 0018 folded it into StaffDetail: confirmed with the user, no
# identity actually owns more than one hospital in practice, so the M:M
# shape was pure redundancy with StaffDetail's own (identity_id, hospital_id,
# role) columns. A hospital owner is now just a StaffDetail row with
# role='admin' -- same table, same login path (portal/routes/staff_auth.py)
# as every other staff member. See StaffDetail's own docstring.


class PlatformSettings(Base):
    """db/schema.sql's platform_settings table -- a SINGLETON row (id is
    always 1, enforced by a CHECK constraint, not per-hospital) holding
    cross-tenant values only a platform/super admin can change, as opposed
    to hospitals' own self-serve settings (business_hours_text,
    session_timeout_minutes, ...). max_active_patient_links starts as
    db/models.py's former MAX_ACTIVE_PATIENT_LINKS=5 hardcoded constant --
    see db/repositories/platform_settings.py for the read/update API and
    admin/platform_settings_api.py for the TENANTS_ADMIN_SECRET-gated
    endpoint that edits it."""
    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    max_active_patient_links: Mapped[int]
    # Migration 0014: moved off hospitals.feature_labels/dpdp_consent_required
    # -- ONE value for every tenant now, not a per-hospital override. Stored
    # as JSON text, same convention as HospitalRow.feature_labels.
    feature_labels: Mapped[str | None]
    dpdp_consent_required: Mapped[bool]


class HospitalSettings(Base):
    """db/schema.sql's hospital_settings table (migration 0021) -- a
    PER-HOSPITAL counterpart to platform_settings above: exactly one row per
    hospital (hospital_id is both the primary key and the FK, 1:1), holding
    self-serve settings that don't belong as more columns on the already very
    wide `hospitals` table (confirmed with the user). Row is created lazily,
    on first read or write (db/repositories/hospital_settings.py's
    get_hospital_settings()), not at hospital-creation time -- so this is
    safe to introduce without touching every hospital-creation code path
    (create_hospital(), db/seed.py, admin onboarding)."""
    __tablename__ = "hospital_settings"

    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), primary_key=True)
    # Follow-up eligibility window: an ATTENDED appointment stops being
    # eligible for Follow-up this many days after its own scheduled_at. NULL
    # means "use the 30-day code-level default" (db/repositories/
    # appointments.py's DEFAULT_FOLLOWUP_VALIDITY_DAYS).
    followup_validity_days: Mapped[int | None]
    # Fee lines shown on Follow-up's confirm/success cards (followup_fee) and
    # reserved for New Consultation's cards once that's wired up
    # (new_consultation_fee, stored but not displayed yet -- confirmed with
    # the user). NULL means "no fee configured," which omits the fee line
    # entirely rather than showing a fake ₹0.
    followup_fee: Mapped[float | None] = mapped_column(Numeric(10, 2))
    new_consultation_fee: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # Lab Test Phase 2 follow-up: flat fee added to a home-collection Lab
    # Test booking's price review, same "unset omits the line" convention as
    # the two fees above.
    home_collection_charge: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # Stage 4 (migration 0030): restaurant-wide operating hours/turnover --
    # shared across every table (confirmed with the user), not scheduled
    # per-table the way a doctor's working_days/working_hours are. NULL
    # operating_days/operating_hours means "not configured yet" (no code
    # reads these until Stage 2's availability logic exists); the two
    # duration columns have real DB defaults so they're never NULL.
    operating_days: Mapped[str | None]
    operating_hours: Mapped[str | None]
    default_turnover_minutes: Mapped[int]
    booking_interval_minutes: Mapped[int]


# Dine Connect fork: GoogleCalendarConnection (google_calendar_connections
# table -- tele-consultation Meet integration) removed. No video-
# consultation concept in dining (ARCHITECTURE_REFERENCE_FOR_FORKING.md
# Section 5).
