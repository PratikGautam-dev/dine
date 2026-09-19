export type DataTier = "tier1" | "tier2" | "tier3";

export type TenantType = "hospital" | "clinic";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type TimeRange = { start: string; end: string };

export type TableForm = {
  name: string;
  // Kept as the raw <input> string; the backend validates/parses it.
  capacity: string;
};

export type DepartmentForm = {
  name: string;
  tables: TableForm[];
};

export type TopicForm = {
  topicLabel: string;
  answerText: string;
};

// Must match backend flows.patient_identity.menu's _FEATURE_MENU keys exactly --
// the onboarding API rejects any key not in that set.
export type FeatureKey =
  | "book_appointment"
  | "order_food"
  | "reschedule"
  | "cancel"
  | "view_appointments"
  | "manage_patients"
  | "consent_privacy"
  | "manage_language"
  | "faq";

export type WizardState = {
  dataTier: DataTier;
  apiBaseUrl: string;
  apiKey: string;
  metaAccountDone: boolean;
  whatsappAppDone: boolean;
  verifyBusinessDone: boolean;
  accessToken: string;
  whatsappPhoneNumberId: string;
  appSecret: string;
  enabledFeatures: FeatureKey[];
  tenantType: TenantType;
  name: string;
  welcomeMessageText: string;
  reminderOffsetsHours: string;
  reminderTemplateName: string;
  portalPassword: string;
  departments: DepartmentForm[];
  // Restaurant-wide reservation hours (backend update_restaurant_hours()):
  // one open/close range on the selected days, plus how long a party holds a
  // table and how often a new seating time starts.
  operatingDays: string[];
  openTime: string;
  closeTime: string;
  turnoverMinutes: string;
  bookingIntervalMinutes: string;
  topics: TopicForm[];
  // RBAC (docs/rbac-redis-plan.md): this hospital's first staff_users admin
  // login -- replaces the old shared portalPassword as the real ongoing
  // login. portalPassword above is still collected/sent (still accepted
  // during the dual-path migration window) but is no longer the field
  // required for onboarding to succeed.
  adminEmail: string;
  adminPassword: string;
};

export function emptyTable(): TableForm {
  return { name: "", capacity: "2" };
}

export function emptyDepartment(): DepartmentForm {
  return { name: "", tables: [] };
}

export function emptyTopic(): TopicForm {
  return { topicLabel: "", answerText: "" };
}

export function initialWizardState(): WizardState {
  return {
    dataTier: "tier1",
    apiBaseUrl: "",
    apiKey: "",
    metaAccountDone: false,
    whatsappAppDone: false,
    verifyBusinessDone: false,
    accessToken: "",
    whatsappPhoneNumberId: "",
    appSecret: "",
    enabledFeatures: ["book_appointment", "reschedule", "cancel", "view_appointments", "faq"],
    tenantType: "hospital",
    name: "",
    welcomeMessageText: "",
    reminderOffsetsHours: "24",
    reminderTemplateName: "",
    portalPassword: "",
    departments: [{ name: "", tables: [{ name: "", capacity: "2" }] }],
    operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openTime: "10:00",
    closeTime: "22:00",
    turnoverMinutes: "90",
    bookingIntervalMinutes: "30",
    topics: [],
    adminEmail: "",
    adminPassword: "",
  };
}

export const RAIL_TITLES = [
  "Data Connection",
  "Business Account",
  "WhatsApp on Meta",
  "Verify Business",
  "Access Token",
  "Phone & App Secret",
  "Guest Experience",
  "Restaurant Details",
  "Review & Submit",
];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  book_appointment: "Book a Table",
  order_food: "Order Food",
  reschedule: "Reschedule Reservation",
  cancel: "Cancel Reservation",
  view_appointments: "View My Reservations",
  manage_patients: "Manage Guests",
  consent_privacy: "Consent & Privacy",
  manage_language: "Manage Language",
  faq: "FAQ / Information",
};

/** Builds the JSON payload the FastAPI /api/onboarding endpoint expects --
 * the open/close times collapse into one "HH:MM-HH:MM" range here, the one
 * place that format matters, so every step component upstream can work with
 * plain structured values instead of that string format. */
export function buildSubmissionPayload(state: WizardState) {
  return {
    // super_admin_token is NOT read off `state` here -- it's the platform
    // operator's own super-admin session (lib/adminAuth.ts), not part of
    // the wizard's persisted form state, so OnboardingWizard's submit
    // handler merges it into this object right before POSTing (same
    // pattern getUserToken() already follows for the Google-auth header).
    tenant_type: state.tenantType,
    name: state.name,
    whatsapp_phone_number_id: state.whatsappPhoneNumberId,
    access_token: state.accessToken,
    app_secret: state.appSecret,
    welcome_message_text: state.welcomeMessageText,
    reminder_offsets_hours: state.reminderOffsetsHours,
    reminder_template_name: state.reminderTemplateName,
    portal_password: state.portalPassword,
    admin_email: state.adminEmail,
    admin_password: state.adminPassword,
    enabled_features: state.enabledFeatures,
    data_tier: state.dataTier,
    api_base_url: state.apiBaseUrl,
    api_key: state.apiKey,
    // Blank starter rows the user never filled in are dropped here, so they
    // can't trip the backend's "table is missing a name" validation.
    sections: state.departments
      .map((dept) => ({
        name: dept.name,
        tables: dept.tables
          .filter((table) => table.name.trim())
          .map((table) => ({ name: table.name, capacity: table.capacity })),
      }))
      .filter((section) => section.name.trim() || section.tables.length > 0),
    operating_days: state.operatingDays,
    operating_hours: state.openTime && state.closeTime ? [`${state.openTime}-${state.closeTime}`] : [],
    default_turnover_minutes: state.turnoverMinutes,
    booking_interval_minutes: state.bookingIntervalMinutes,
    topics: state.topics.map((t) => ({ topic_label: t.topicLabel, answer_text: t.answerText })),
  };
}
