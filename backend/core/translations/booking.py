# core/translations/booking.py
"""The booking flow itself: appointment type, per-type consent,
department/doctor/date/time selection, patient name/age collection, the
confirmation card, and the booking-conflict/follow-up variants."""
from core.translations._common import Language


SELECT_APPOINTMENT_TYPE = "select_appointment_type"
VIEW_APPOINTMENT_TYPES_BUTTON = "view_appointment_types_button"
APPOINTMENT_TYPES_SECTION_TITLE = "appointment_types_section_title"
CHANGE_APPOINTMENT_TYPE_OPTION = "change_appointment_type_option"
CONSENT_PROMPT = "consent_prompt"
CONSENT_AGREE_BUTTON = "consent_agree_button"
CONSENT_DECLINED = "consent_declined"
# Stage 4 (table-availability): party size -> optional section preference
# -> date -> time -> auto-assigned table -> confirm. The guest never picks a
# table by name (ARCHITECTURE_REFERENCE_FOR_FORKING.md Section 4, confirmed
# with the user) -- these replace department/doctor selection for this flow
# only; the department/doctor keys above stay as-is for any other type.
ASK_PARTY_SIZE = "ask_party_size"
PARTY_SIZE_SECTION_TITLE = "party_size_section_title"
VIEW_PARTY_SIZES_BUTTON = "view_party_sizes_button"
PARTY_SIZE_LARGE_OPTION = "party_size_large_option"
LARGE_PARTY_HANDOFF_TEXT = "large_party_handoff_text"
ASK_TABLE_SECTION = "ask_table_section"
TABLE_SECTIONS_SECTION_TITLE = "table_sections_section_title"
VIEW_TABLE_SECTIONS_BUTTON = "view_table_sections_button"
NO_SECTION_PREFERENCE_OPTION = "no_section_preference_option"
ASK_RESERVATION_DATE_FOR_PARTY = "ask_reservation_date_for_party"
NO_TABLES_AVAILABLE = "no_tables_available"
TABLE_RESERVATION_CONFIRMATION_SUMMARY = "table_reservation_confirmation_summary"
TABLE_RESERVATION_CONFIRMED = "table_reservation_confirmed"

SELECT_DEPARTMENT = "select_department"
VIEW_DEPARTMENTS_BUTTON = "view_departments_button"
DEPARTMENTS_SECTION_TITLE = "departments_section_title"
SELECT_DOCTOR = "select_doctor"
VIEW_DOCTORS_BUTTON = "view_doctors_button"
DOCTOR_SELECTED_ASK_DATE = "doctor_selected_ask_date"
VIEW_DATES_BUTTON = "view_dates_button"
AVAILABLE_DATES_SECTION_TITLE = "available_dates_section_title"
SELECT_TIME_SLOT = "select_time_slot"
VIEW_TIMES_BUTTON = "view_times_button"
AVAILABLE_TIMES_SECTION_TITLE = "available_times_section_title"
CONSULTATION_FEE_LINE = "consultation_fee_line"
SELECT_SLOT = "select_slot"
VIEW_SLOTS_BUTTON = "view_slots_button"
AVAILABLE_SLOTS_SECTION_TITLE = "available_slots_section_title"
NO_DOCTORS_AVAILABLE = "no_doctors_available"
NO_SLOTS_AVAILABLE = "no_slots_available"
SLOT_TAKEN_NO_ALTERNATIVES = "slot_taken_no_alternatives"
SLOT_TAKEN_CHOOSE_ANOTHER = "slot_taken_choose_another"
ASK_BOOKING_FOR = "ask_booking_for"
BOOKING_FOR_SELF_BUTTON = "booking_for_self_button"
BOOKING_FOR_OTHER_BUTTON = "booking_for_other_button"
ASK_PATIENT_NAME = "ask_patient_name"
INVALID_PATIENT_NAME = "invalid_patient_name"
ASK_PATIENT_CONTACT_NUMBER = "ask_patient_contact_number"
INVALID_PATIENT_CONTACT_NUMBER = "invalid_patient_contact_number"
ASK_PATIENT_AGE = "ask_patient_age"
INVALID_PATIENT_AGE = "invalid_patient_age"
ASK_PATIENT_GENDER = "ask_patient_gender"
INVALID_PATIENT_GENDER = "invalid_patient_gender"
GENDER_MALE = "gender_male"
GENDER_FEMALE = "gender_female"
GENDER_OTHER = "gender_other"
CONFIRM_BOOKING_SUMMARY = "confirm_booking_summary"
CONFIRM_BUTTON = "confirm_button"
CANCEL_BUTTON = "cancel_button"
WHAT_WOULD_YOU_LIKE_TO_CHANGE = "what_would_you_like_to_change"
VIEW_CHANGE_OPTIONS_BUTTON = "view_change_options_button"
CHANGE_OPTIONS_SECTION_TITLE = "change_options_section_title"
CHANGE_DEPARTMENT_OPTION = "change_department_option"
CHANGE_DOCTOR_OPTION = "change_doctor_option"
CHANGE_DATE_OPTION = "change_date_option"
CHANGE_TIME_OPTION = "change_time_option"
BOOKING_CONFIRMED = "booking_confirmed"
BOOKING_NOT_CONFIRMED = "booking_not_confirmed"
DUPLICATE_BOOKING_TEXT = "duplicate_booking_text"
DEPARTMENT_APPOINTMENT_CONFLICT = "department_appointment_conflict"
NEW_CONSULTATION_DEPARTMENT_CONFLICT = "new_consultation_department_conflict"
NEW_CONSULTATION_SAME_DAY_CONFLICT = "new_consultation_same_day_conflict"
NO_PREVIOUS_APPOINTMENT_FOR_FOLLOWUP = "no_previous_appointment_for_followup"
FOLLOWUP_ELIGIBLE_LIST_PROMPT = "followup_eligible_list_prompt"
VIEW_FOLLOWUP_OPTIONS_BUTTON = "view_followup_options_button"
FOLLOWUP_ELIGIBLE_SECTION_TITLE = "followup_eligible_section_title"
FOLLOWUP_CONFIRMATION_SUMMARY = "followup_confirmation_summary"
FOLLOWUP_APPOINTMENT_CONFIRMED = "followup_appointment_confirmed"
MANAGE_APPOINTMENT_PROMPT = "manage_appointment_prompt"

# --- Daycare/Procedure rebuild (Step 1's catalog through the approval
# workflow and "Request Reschedule") ---
SELECT_PROCEDURE = "select_procedure"
VIEW_PROCEDURES_BUTTON = "view_procedures_button"
PROCEDURES_SECTION_TITLE = "procedures_section_title"
NO_PROCEDURES_CONFIGURED = "no_procedures_configured"
PROCEDURE_REQUEST_CONFIRM_SUMMARY = "procedure_request_confirm_summary"
PROCEDURE_REQUEST_SUBMITTED = "procedure_request_submitted"
PROCEDURE_APPROVED = "procedure_approved"
PROCEDURE_REJECTED = "procedure_rejected"
PROCEDURE_CONFIRMATION_SUMMARY = "procedure_confirmation_summary"
PROCEDURE_ESTIMATE_LINE = "procedure_estimate_line"
PROCEDURE_ORDER_REFERENCE_LINE = "procedure_order_reference_line"
PROCEDURE_INSTRUCTIONS_LINE = "procedure_instructions_line"
PROCEDURE_BOOKING_CONFIRMED = "procedure_booking_confirmed"
PROCEDURE_RESCHEDULE_REQUEST_PROMPT = "procedure_reschedule_request_prompt"
PROCEDURE_RESCHEDULE_REQUESTED = "procedure_reschedule_requested"
PROCEDURE_RESCHEDULE_APPROVED = "procedure_reschedule_approved"
PROCEDURE_RESCHEDULE_REJECTED = "procedure_reschedule_rejected"

STRINGS: dict[str, dict[Language, str]] = {
    # --- Booking: appointment type (shown right after patient resolution,
    # before department selection) ---
    SELECT_APPOINTMENT_TYPE: {
        "en": "Please choose the type of reservation you would like to make.",
        "hi": "कृपया वह रिज़र्वेशन प्रकार चुनें जिसे आप करना चाहते हैं।",
    },
    VIEW_APPOINTMENT_TYPES_BUTTON: {"en": "View Types", "hi": "प्रकार देखें"},
    APPOINTMENT_TYPES_SECTION_TITLE: {"en": "Reservation Type", "hi": "रिज़र्वेशन प्रकार"},
    CHANGE_APPOINTMENT_TYPE_OPTION: {"en": "Reservation Type", "hi": "रिज़र्वेशन प्रकार"},

    # --- Booking: consent (shown after confirmation, only for an
    # appointment type with requires_consent=TRUE, e.g. tele-consultation) ---
    CONSENT_PROMPT: {
        "en": "This is a {appointment_type_label} reservation. Do you consent to proceed with this reservation type?",
        "hi": "यह एक {appointment_type_label} रिज़र्वेशन है। क्या आप इस रिज़र्वेशन प्रकार के साथ आगे बढ़ने के लिए सहमत हैं?",
    },
    CONSENT_AGREE_BUTTON: {"en": "I Agree", "hi": "मैं सहमत हूँ"},
    CONSENT_DECLINED: {
        "en": "No problem -- this reservation type needs your consent to proceed, so it hasn't been made.",
        "hi": "कोई बात नहीं -- इस रिज़र्वेशन प्रकार के लिए आपकी सहमति आवश्यक है, इसलिए इसे नहीं बनाया गया है।",
    },

    # --- Booking: department/doctor/date/time menus ---
    SELECT_DEPARTMENT: {"en": "Please choose the section where you would like to sit.", "hi": "कृपया वह सेक्शन चुनें जहां आप बैठना चाहते हैं।"},
    VIEW_DEPARTMENTS_BUTTON: {"en": "View Sections", "hi": "सेक्शन देखें"},
    DEPARTMENTS_SECTION_TITLE: {"en": "Sections", "hi": "सेक्शन"},

    SELECT_DOCTOR: {
        "en": "Please select a table in {department_name}:",
        "hi": "कृपया {department_name} में एक टेबल चुनें:",
    },
    VIEW_DOCTORS_BUTTON: {"en": "View Tables", "hi": "टेबल देखें"},

    # Section 12.12: booking's date/time step is now two separate prompts
    # (was one combined slot list) -- "select_slot"/"view_slots_button"/
    # "available_slots_section_title" below are kept as-is for the
    # RESCHEDULE flow only (_send_slot_menu), which the reference screenshot
    # this section is based on doesn't cover and so was deliberately left
    # as a single combined list, unchanged from before this section.
    # NOTE: doctor_name already includes a "Dr." prefix everywhere in this
    # codebase (db/seed.py's own seeded names, e.g. "Dr. Anjali Rao") -- do
    # NOT hardcode a second "Dr."/"डॉ." here, or every real send doubles it
    # ("You have selected Dr. Dr. Anjali Rao."), caught live via a full
    # conversation trace before this shipped.
    DOCTOR_SELECTED_ASK_DATE: {
        # Previous body (kept for reference, not deleted):
        # "en": "You have selected {doctor_name}. Now please select a consulting date:",
        # "hi": "आपने {doctor_name} को चुना है। अब कृपया परामर्श की तारीख चुनें:",
        "en": "✅ Table {doctor_name} selected\nPlease choose your preferred reservation date.",
        "hi": "✅ टेबल {doctor_name} चुनी गई\nकृपया अपनी पसंदीदा रिज़र्वेशन तारीख चुनें।",
    },
    VIEW_DATES_BUTTON: {"en": "View Dates", "hi": "तारीखें देखें"},
    AVAILABLE_DATES_SECTION_TITLE: {"en": "Available Dates", "hi": "उपलब्ध तारीखें"},

    SELECT_TIME_SLOT: {
        "en": "Please select a preferred seating time:",
        "hi": "कृपया अपनी पसंदीदा बैठने का समय चुनें:",
    },
    VIEW_TIMES_BUTTON: {"en": "View Times", "hi": "समय देखें"},
    AVAILABLE_TIMES_SECTION_TITLE: {"en": "Available Times", "hi": "उपलब्ध समय"},

    # --- Booking: daycare duration (Phase 2, docs/per-appointment-type-
    # flow-plan.md) -- shown right after time-slot selection, daycare only ---
    CONSULTATION_FEE_LINE: {"en": "💰 Deposit / Minimum Spend: ₹{amount}\n\n", "hi": "💰 जमा / न्यूनतम खर्च: ₹{amount}\n\n"},

    SELECT_SLOT: {
        "en": "Please select a seating time for table {doctor_name}:",
        "hi": "कृपया टेबल {doctor_name} के लिए बैठने का समय चुनें:",
    },
    VIEW_SLOTS_BUTTON: {"en": "View Slots", "hi": "स्लॉट देखें"},
    AVAILABLE_SLOTS_SECTION_TITLE: {"en": "Available Slots", "hi": "उपलब्ध स्लॉट"},

    NO_DOCTORS_AVAILABLE: {
        "en": "Sorry, there are no tables available in {department_name} right now. Please check back later.",
        "hi": "क्षमा करें, {department_name} में अभी कोई टेबल उपलब्ध नहीं है। कृपया बाद में फिर देखें।",
    },
    NO_SLOTS_AVAILABLE: {
        "en": "Sorry, there are no available times for table {doctor_name} right now. Please check back later.",
        "hi": "क्षमा करें, टेबल {doctor_name} के लिए अभी कोई समय उपलब्ध नहीं है। कृपया बाद में फिर देखें।",
    },
    SLOT_TAKEN_NO_ALTERNATIVES: {
          "en": "Sorry, that time was just taken and there are no other times available for table {doctor_name} right now. "
              "Please check back later.",
          "hi": "क्षमा करें, वह समय अभी-अभी बुक हो गया और टेबल {doctor_name} के लिए अभी कोई अन्य समय उपलब्ध नहीं है। "
              "कृपया बाद में फिर देखें।",
    },
    SLOT_TAKEN_CHOOSE_ANOTHER: {
        "en": "Sorry, that time was just taken. Please choose another time.",
        "hi": "क्षमा करें, वह समय अभी-अभी बुक हो गया। कृपया कोई और समय चुनें।",
    },

    # --- Booking: patient name + age collection ---
    # Section 12.13 follow-up: age is BACK in the WhatsApp flow (Section 12.12
    # had dropped it to match a reference screenshot's exact wording, flagged
    # in Spec.md as a decision worth confirming -- confirmed the user did
    # want it, so it's restored here, now also shown on the confirmation card
    # per that follow-up's own explicit choice).
    # Patient identity/UX follow-up (Spec.md Section 0): "Almost done!" was
    # accurate when this was the LAST step before confirmation -- now that
    # name/age is asked FIRST (before department selection), that framing
    # was actively misleading, caught live and dropped.
    ASK_BOOKING_FOR: {
        "en": "Who is this reservation for?",
        "hi": "यह रिज़र्वेशन किसके लिए है?",
    },
    BOOKING_FOR_SELF_BUTTON: {"en": "Myself", "hi": "मैं खुद"},
    BOOKING_FOR_OTHER_BUTTON: {"en": "Someone Else", "hi": "कोई और"},
    ASK_PATIENT_NAME: {
        "en": "Please enter the guest's full name.",
        "hi": "कृपया अतिथि का पूरा नाम दर्ज करें।",
    },
    INVALID_PATIENT_NAME: {
        "en": "Please enter a valid name using letters only (3–50 characters).",
        "hi": "कृपया केवल अक्षरों का उपयोग करके एक मान्य नाम दर्ज करें (3–50 अक्षर)।",
    },
    ASK_PATIENT_CONTACT_NUMBER: {
        "en": "Please enter the guest's contact number",
        "hi": "कृपया अतिथि का संपर्क नंबर दर्ज करें।",
    },
    INVALID_PATIENT_CONTACT_NUMBER: {
        "en": "Please enter a valid 10-digit contact number, digits only, not starting with 0.",
        "hi": "कृपया केवल अंकों में एक मान्य 10 अंकों का संपर्क नंबर दर्ज करें, जो 0 से शुरू न हो।",
    },
    ASK_PATIENT_AGE: {
        "en": "Please select the guest's age.",
        "hi": "कृपया अतिथि की आयु दर्ज करें।",
    },
    INVALID_PATIENT_AGE: {
        "en": "Please enter a valid age (a number between 0 and 100).",
        "hi": "कृपया एक मान्य उम्र दर्ज करें (0 से 100 के बीच की संख्या)।",
    },
    ASK_PATIENT_GENDER: {
        "en": "Please share the guest's gender:",
        "hi": "कृपया अतिथि का लिंग बताएं:",
    },
    INVALID_PATIENT_GENDER: {
        "en": "Please select an option below.",
        "hi": "कृपया नीचे दिए गए विकल्पों में से एक चुनें।",
    },
    GENDER_MALE: {"en": "Male", "hi": "पुरुष"},
    GENDER_FEMALE: {"en": "Female", "hi": "महिला"},
    GENDER_OTHER: {"en": "Other", "hi": "अन्य"},

    # --- Booking: confirmation ---
    # Section 12.12: structured "card" style with WhatsApp *bold* markdown and
    # fixed emoji per field, matching the reference screenshot exactly, with
    # an added age line (Section 12.13 follow-up, not in the original
    # reference screenshot but explicitly requested).
    # Item 10 (Spec.md Section 0): patient name/age moved first, ahead of
    # department/doctor/date/time -- was department/doctor/date/time then
    # patient info last.
    # Appointment type step (WhatsApp flow alignment): {appointment_type_label}
    # line added above Patient. Always populated for real traffic --
    # _select_patient_and_continue's booking branch sets STATE_AWAITING_
    # APPOINTMENT_TYPE as the very first booking step now, before this
    # confirmation can ever be reached.
    CONFIRM_BOOKING_SUMMARY: {
        # Previous body (kept for reference, not deleted -- same
        # already-established convention as dpdp_consent.py/this hospital's
        # other recently-restyled templates):
        # "en": "*Confirm Booking Details:*\n"
        #       "📋 *Type:* {appointment_type_label}\n"
        #       "👤 *Patient:* {patient_name}\n"
        #       "🎂 *Age:* {patient_age}\n"
        #       "🏥 *Dept:* {department_name}\n"
        #       "👨‍⚕️ *Doctor:* {doctor_name}\n"
        #       "📅 *Date:* {date_label}\n"
        #       "🕐 *Slot:* {time_label}\n\n"
        #       "Please confirm this appointment:",
        # "hi": "*बुकिंग विवरण की पुष्टि करें:*\n"
        #       "📋 *प्रकार:* {appointment_type_label}\n"
        #       "👤 *मरीज़:* {patient_name}\n"
        #       "🎂 *उम्र:* {patient_age}\n"
        #       "🏥 *विभाग:* {department_name}\n"
        #       "👨‍⚕️ *डॉक्टर:* {doctor_name}\n"
        #       "📅 *तारीख:* {date_label}\n"
        #       "🕐 *स्लॉट:* {time_label}\n\n"
        #       "कृपया इस अपॉइंटमेंट की पुष्टि करें:",
        # fee_line: "💰 Consultation Fee: ₹{amount}\n\n" when hospital_settings.
        # new_consultation_fee is configured for a "new" (New Consultation)
        # booking, "" otherwise (flows/booking/messages.py's _send_confirmation
        # builds it) -- was a static "₹800 (if applicable)" placeholder before
        # a real per-hospital fee field existed; now sourced for real, and
        # omitted entirely (not shown as ₹0) when unset or not a New
        # Consultation booking.
        "en": (
            "*Confirm Reservation Details:*\n"
            "👤 Guest: {patient_name}\n"
            "🆔 Guest Reference: {patient_code}\n"
            "🎂 Age: {patient_age}\n"
            "📋 Reservation Type: {appointment_type_label}\n"
            "📍 Section: {department_name}\n"
            "🪑 Table: {doctor_name}\n"
            "📅 Date: {date_label}\n"
            "🕐 Seating Time: {time_label}\n\n"
            "{fee_line}"
            "Please review the details before confirming your reservation."
        ),
        "hi": (
            "*रिज़र्वेशन विवरण की पुष्टि करें:*\n"
            "👤 अतिथि: {patient_name}\n"
            "🆔 अतिथि संदर्भ: {patient_code}\n"
            "🎂 उम्र: {patient_age}\n"
            "📋 रिज़र्वेशन प्रकार: {appointment_type_label}\n"
            "📍 सेक्शन: {department_name}\n"
            "🪑 टेबल: {doctor_name}\n"
            "📅 तारीख: {date_label}\n"
            "🕐 बैठने का समय: {time_label}\n\n"
            "{fee_line}"
            "कृपया रिज़र्वेशन की पुष्टि करने से पहले विवरण की समीक्षा करें।"
        ),
    },
    CONFIRM_BUTTON: {"en": "Confirm", "hi": "पुष्टि करें"},
    CANCEL_BUTTON: {"en": "Cancel", "hi": "रद्द करें"},

    # Stage 4 (table-availability): party size -> optional section
    # preference -> date -> time -> auto-assigned table -> confirm.
    ASK_PARTY_SIZE: {
        "en": "How many guests will be joining?",
        "hi": "कितने मेहमान शामिल होंगे?",
    },
    PARTY_SIZE_SECTION_TITLE: {"en": "Party Size", "hi": "पार्टी का आकार"},
    VIEW_PARTY_SIZES_BUTTON: {"en": "Select", "hi": "चुनें"},
    PARTY_SIZE_LARGE_OPTION: {"en": "9 or more", "hi": "9 या अधिक"},
    LARGE_PARTY_HANDOFF_TEXT: {
        "en": (
            "For parties of 9 or more, our host will help arrange the best seating for your group.\n\n"
            "We've let the restaurant know — they'll reach out to you shortly."
        ),
        "hi": (
            "9 या अधिक मेहमानों के लिए, हमारा होस्ट आपके समूह के लिए सबसे अच्छी बैठने की व्यवस्था करने में मदद करेगा।\n\n"
            "हमने रेस्तरां को सूचित कर दिया है — वे जल्द ही आपसे संपर्क करेंगे।"
        ),
    },
    ASK_TABLE_SECTION: {
        "en": "Any section preference?",
        "hi": "कोई सेक्शन पसंद है?",
    },
    TABLE_SECTIONS_SECTION_TITLE: {"en": "Sections", "hi": "सेक्शन"},
    VIEW_TABLE_SECTIONS_BUTTON: {"en": "Select", "hi": "चुनें"},
    NO_SECTION_PREFERENCE_OPTION: {"en": "No preference", "hi": "कोई पसंद नहीं"},
    ASK_RESERVATION_DATE_FOR_PARTY: {
        "en": "Please choose your preferred date for {party_size} guest(s):",
        "hi": "कृपया {party_size} मेहमानों के लिए अपनी पसंदीदा तारीख चुनें:",
    },
    NO_TABLES_AVAILABLE: {
        "en": "Sorry, we don't have a table available for that party size right now. Please try a different size or contact us directly.",
        "hi": "क्षमा करें, अभी इतने मेहमानों के लिए कोई टेबल उपलब्ध नहीं है। कृपया एक अलग संख्या आज़माएं या सीधे हमसे संपर्क करें।",
    },
    TABLE_RESERVATION_CONFIRMATION_SUMMARY: {
        "en": (
            "*Confirm Reservation Details:*\n"
            "👤 Guest: {patient_name}\n"
            "🍽️ Party Size: {party_size}\n"
            "{section_line}"
            "📅 Date: {date_label}\n"
            "🕐 Time: {time_label}\n\n"
            "{fee_line}"
            "We'll have a table ready for you. Please review the details before confirming."
        ),
        "hi": (
            "*रिज़र्वेशन विवरण की पुष्टि करें:*\n"
            "👤 अतिथि: {patient_name}\n"
            "🍽️ पार्टी का आकार: {party_size}\n"
            "{section_line}"
            "📅 तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n\n"
            "{fee_line}"
            "हम आपके लिए एक टेबल तैयार रखेंगे। कृपया पुष्टि करने से पहले विवरण की समीक्षा करें।"
        ),
    },
    TABLE_RESERVATION_CONFIRMED: {
        "en": (
            "✅ *Reservation Confirmed*\n\n"
            "Your table reservation has been successfully booked.\n\n"
            "🆔 Reservation ID: {reference_id}\n"
            "👤 Guest: {patient_name}\n"
            "🍽️ Party Size: {party_size}\n"
            "📅 Date: {date_label}\n"
            "🕐 Time: {time_label}\n\n"
            "Please arrive on time — we look forward to seeing you."
        ),
        "hi": (
            "✅ *रिज़र्वेशन की पुष्टि हो गई*\n\n"
            "आपका टेबल रिज़र्वेशन सफलतापूर्वक बुक हो गया है।\n\n"
            "🆔 रिज़र्वेशन आईडी: {reference_id}\n"
            "👤 अतिथि: {patient_name}\n"
            "🍽️ पार्टी का आकार: {party_size}\n"
            "📅 तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n\n"
            "कृपया समय पर पहुंचें — हम आपका इंतज़ार करेंगे।"
        ),
    },

    # Confirmation's own Back routes here instead of popping one field --
    # "which one field" isn't knowable, so this asks instead of guessing.
    WHAT_WOULD_YOU_LIKE_TO_CHANGE: {
        "en": "No problem — what would you like to change?",
        "hi": "कोई बात नहीं — आप क्या बदलना चाहेंगे?",
    },
    VIEW_CHANGE_OPTIONS_BUTTON: {"en": "Choose", "hi": "चुनें"},
    CHANGE_OPTIONS_SECTION_TITLE: {"en": "Change", "hi": "बदलें"},
    CHANGE_DEPARTMENT_OPTION: {"en": "Department", "hi": "विभाग"},
    CHANGE_DOCTOR_OPTION: {"en": "Table", "hi": "टेबल"},
    CHANGE_DATE_OPTION: {"en": "Date", "hi": "तारीख"},
    CHANGE_TIME_OPTION: {"en": "Time", "hi": "समय"},
    BOOKING_CONFIRMED: {
        "en": (
            "✅ *Reservation Confirmed*\n\n"
            "Your reservation has been successfully booked.\n\n"
            "🆔 Reservation ID: {reference_id}\n"
            "👤 Guest: {patient_name}\n"
            "📍 Section: {department_name}\n"
            "🪑 Table: {doctor_name}\n"
            "📅 Date: {date_label}\n"
            "🕐 Time: {time_label}\n\n"
            "Please arrive 15 minutes before your reservation.\n"
            "We look forward to seeing you."
        ),
        "hi": (
            "✅ *रिज़र्वेशन की पुष्टि हो गई*\n\n"
            "आपका रिज़र्वेशन सफलतापूर्वक बुक हो गया है।\n\n"
            "🆔 रिज़र्वेशन आईडी: {reference_id}\n"
            "👤 अतिथि: {patient_name}\n"
            "📍 सेक्शन: {department_name}\n"
            "🪑 टेबल: {doctor_name}\n"
            "📅 तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n\n"
            "कृपया अपने रिज़र्वेशन से 15 मिनट पहले पहुंचें।\n"
            "हम आपसे मिलने के लिए उत्सुक हैं।"
        ),
    },
    BOOKING_NOT_CONFIRMED: {
        "en": "Okay, I've cancelled this booking. Send any message to start over.",
        "hi": "ठीक है, मैंने यह बुकिंग रद्द कर दी है। फिर से शुरू करने के लिए कोई भी संदेश भेजें।",
    },
    # Item 5 (Spec.md Section 0): shown when create_appointment() raises
    # DuplicateBookingError -- an active booking with this same doctor (and
    # age on file) already exists, so this attempt is blocked rather than
    # creating a second one.
    DUPLICATE_BOOKING_TEXT: {
        "en": "You already have a reservation booked with {doctor_name} — reply below to manage it.",
        "hi": "आपकी {doctor_name} के साथ पहले से ही एक रिज़र्वेशन बुक है — इसे प्रबंधित करने के लिए नीचे उत्तर दें।",
    },
    # Shared department-selection conflict (base.existing_department_appointment):
    # new/tele/second_opinion/daycare all block picking a department the
    # patient already has an active appointment (or follow-up) in, showing
    # that existing appointment's own details plus Main Menu/Cancel/Reschedule
    # quick actions -- same shape as DUPLICATE_BOOKING_TEXT above.
    DEPARTMENT_APPOINTMENT_CONFLICT: {
        "en": "You already have a reservation in {department_name} with {doctor_name} on {when} — reply below to manage it.",
        "hi": "आपकी {department_name} में {doctor_name} के साथ {when} को पहले से ही एक रिज़र्वेशन है — इसे प्रबंधित करने के लिए नीचे उत्तर दें।",
    },
    # docs/per-appointment-type-flow-plan.md Phase 2: New Consultation-only
    # booking rules -- flows/booking/types/new_consultation.py. (The
    # department half is now a same-day-of-booking safety net only --
    # DEPARTMENT_APPOINTMENT_CONFLICT above already blocks this earlier, at
    # department selection.)
    NEW_CONSULTATION_DEPARTMENT_CONFLICT: {
        "en": "You already have an active reservation in this department. Please cancel it first if you'd like to book again.",
        "hi": "इस विभाग में आपकी पहले से ही एक सक्रिय रिज़र्वेशन है। दोबारा बुक करने के लिए कृपया पहले उसे रद्द करें।",
    },
    NEW_CONSULTATION_SAME_DAY_CONFLICT: {
        "en": "You already have a reservation booked on this day. Please choose a different date, or manage your existing reservation first.",
        "hi": "इस दिन आपकी पहले से ही एक रिज़र्वेशन बुक है। कृपया कोई और तारीख चुनें, या पहले अपना मौजूदा रिज़र्वेशन प्रबंधित करें।",
    },
    # docs/per-appointment-type-flow-plan.md Phase 2 Step 2:
    # flows/booking/types/followup.py.
    NO_PREVIOUS_APPOINTMENT_FOR_FOLLOWUP: {
        # Previous body (kept for reference, not deleted):
        # "en": "We couldn't find any previous completed appointment for you, so Follow-up isn't available yet. Please choose New Consultation instead.",
        # "hi": "हमें आपकी कोई पिछली पूर्ण अपॉइंटमेंट नहीं मिली, इसलिए फॉलो-अप अभी उपलब्ध नहीं है। कृपया इसके बजाय नई परामर्श चुनें।",
        "en": (
            "No Previous Visit Found\n"
            "We couldn't find any completed visit for {name}.\n\n"
            "A follow-up reservation can only be booked after a previous visit. Please book a Table Reservation instead."
        ),
        "hi": (
            "कोई पिछली मुलाकात नहीं मिली\n"
            "हमें {name} के लिए कोई पूर्ण मुलाकात नहीं मिली।\n\n"
            "फॉलो-अप रिज़र्वेशन केवल पिछली मुलाकात के बाद ही बुक की जा सकती है। कृपया इसके बजाय टेबल रिज़र्वेशन बुक करें।"
        ),
    },
    # docs/per-appointment-type-flow-plan.md Phase 2 Step 2 follow-up: the
    # eligible-consultations list -- one row per department's most recent
    # ATTENDED appointment still within the hospital's eligibility window.
    FOLLOWUP_ELIGIBLE_LIST_PROMPT: {
        "en": (
            "✅ *Follow-up Reservation Available*\n\n"
            "Below are {patient_name}'s latest eligible visits for follow-up.\n"
            "For each section, only the most recent visit is shown.\n\n"
            "Please select the visit you would like to continue with."
        ),
        "hi": (
            "✅ *फॉलो-अप रिज़र्वेशन उपलब्ध है*\n\n"
            "नीचे {patient_name} के फॉलो-अप के लिए नवीनतम योग्य मुलाकातें दी गई हैं।\n"
            "प्रत्येक सेक्शन के लिए, केवल सबसे हालिया मुलाकात दिखाई गई है।\n\n"
            "कृपया वह मुलाकात चुनें जिसके साथ आप आगे बढ़ना चाहेंगे।"
        ),
    },
    VIEW_FOLLOWUP_OPTIONS_BUTTON: {"en": "View Options", "hi": "विकल्प देखें"},
    FOLLOWUP_ELIGIBLE_SECTION_TITLE: {"en": "Eligible Visits", "hi": "योग्य मुलाकातें"},
    # fee_line: CONSULTATION_FEE_LINE-shaped ("💰 ...Fee: ₹{amount}\n\n") when
    # hospital_settings.followup_fee is configured, "" otherwise -- same
    # omit-rather-than-fake-₹0 discipline CONFIRM_BOOKING_SUMMARY's own
    # fee_line uses.
    FOLLOWUP_CONFIRMATION_SUMMARY: {
        "en": (
            "📋 *Confirm Follow-up Reservation*\n\n"
            "👤 Guest: {patient_name}\n"
            "🆔 Guest ID: {patient_code}\n"
            "📋 Reservation Type: {appointment_type_label}\n"
            "📍 Section: {department_name}\n"
            "🪑 Table: {doctor_name}\n"
            "🔁 Previous Visit: {previous_visit_label}\n"
            "📅 Reservation Date: {date_label}\n"
            "🕐 Time: {time_label}\n"
            "{fee_line}\n"
            "Please review the details before confirming."
        ),
        "hi": (
            "📋 *फॉलो-अप रिज़र्वेशन की पुष्टि करें*\n\n"
            "👤 अतिथि: {patient_name}\n"
            "🆔 अतिथि आईडी: {patient_code}\n"
            "📋 रिज़र्वेशन प्रकार: {appointment_type_label}\n"
            "📍 सेक्शन: {department_name}\n"
            "🪑 टेबल: {doctor_name}\n"
            "🔁 पिछली मुलाकात: {previous_visit_label}\n"
            "📅 रिज़र्वेशन तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n"
            "{fee_line}\n"
            "कृपया पुष्टि करने से पहले विवरण की समीक्षा करें।"
        ),
    },
    FOLLOWUP_APPOINTMENT_CONFIRMED: {
        "en": (
            "✅ *Follow-up Reservation Confirmed*\n\n"
            "Your follow-up reservation has been successfully booked.\n\n"
            "🆔 Reservation ID: {reference_id}\n"
            "👤 Guest: {patient_name}\n"
            "🪑 Table: {doctor_name}\n"
            "📍 Section: {department_name}\n"
            "📅 Date: {date_label}\n"
            "🕐 Time: {time_label}\n\n"
            "Please arrive 15 minutes before your reservation.\n\n"
            "We look forward to seeing you."
        ),
        "hi": (
            "✅ *फॉलो-अप रिज़र्वेशन की पुष्टि हो गई*\n\n"
            "आपका फॉलो-अप रिज़र्वेशन सफलतापूर्वक बुक हो गया है।\n\n"
            "🆔 रिज़र्वेशन आईडी: {reference_id}\n"
            "👤 अतिथि: {patient_name}\n"
            "🪑 टेबल: {doctor_name}\n"
            "📍 सेक्शन: {department_name}\n"
            "📅 तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n\n"
            "कृपया अपने रिज़र्वेशन से 15 मिनट पहले पहुंचें।\n\n"
            "हम आपसे मिलने के लिए उत्सुक हैं।"
        ),
    },
    # Item 6 (Spec.md Section 0): shown after tapping one appointment in "My
    # Appointments" -- the same quick-action buttons item 3/5 use.
    MANAGE_APPOINTMENT_PROMPT: {
        "en": "Your reservation with {doctor_name} — what would you like to do?",
        "hi": "{doctor_name} के साथ आपका रिज़र्वेशन — आप क्या करना चाहेंगे?",
    },

    SELECT_PROCEDURE: {
        "en": "Please select the treatment or procedure recommended by your doctor.",
        "hi": "कृपया अपने डॉक्टर द्वारा सुझाई गई उपचार या प्रक्रिया चुनें।",
    },
    VIEW_PROCEDURES_BUTTON: {"en": "View Procedures", "hi": "प्रक्रियाएं देखें"},
    PROCEDURES_SECTION_TITLE: {"en": "Procedures", "hi": "प्रक्रियाएं"},
    NO_PROCEDURES_CONFIGURED: {
        "en": "Sorry, no procedures are available to book right now. Please check back later.",
        "hi": "क्षमा करें, अभी बुक करने के लिए कोई प्रक्रिया उपलब्ध नहीं है। कृपया बाद में फिर से देखें।",
    },
    # amount_line/order_line/instructions_line: built by procedure.py, "" when
    # unset -- same omit-rather-than-fake-value discipline as fee_line/
    # amount_line elsewhere.
    PROCEDURE_REQUEST_CONFIRM_SUMMARY: {
        "en": (
            "📋 *Review Your Request*\n\n"
            "👤 Guest: {patient_name}\n"
            "🩺 Procedure: {procedure_name}\n"
            "{estimate_line}"
            "{instructions_line}"
            "This procedure requires restaurant verification before a slot is confirmed. "
            "Please review the details above before sending your request."
        ),
        "hi": (
            "📋 *अपना अनुरोध जांचें*\n\n"
            "👤 अतिथि: {patient_name}\n"
            "🩺 प्रक्रिया: {procedure_name}\n"
            "{estimate_line}"
            "{instructions_line}"
            "इस प्रक्रिया के लिए स्लॉट कन्फर्म होने से पहले रेस्तरां की मंजूरी आवश्यक है। "
            "कृपया अनुरोध भेजने से पहले ऊपर दिए गए विवरण जांच लें।"
        ),
    },
    PROCEDURE_REQUEST_SUBMITTED: {
        "en": (
            "Your request for the selected procedure has been sent to the restaurant for verification.\n\n"
            "We will notify you once the request is approved and eligible slots are available."
        ),
        "hi": (
            "चुनी गई प्रक्रिया के लिए आपका अनुरोध सत्यापन हेतु रेस्तरां को भेज दिया गया है।\n\n"
            "अनुरोध स्वीकृत होने और स्लॉट उपलब्ध होने पर हम आपको सूचित करेंगे।"
        ),
    },
    PROCEDURE_APPROVED: {
        "en": (
            "Your procedure request has been approved.\n\n"
            "Please select an available date and time to continue with the booking."
        ),
        "hi": (
            "आपकी प्रक्रिया का अनुरोध स्वीकृत कर दिया गया है।\n\n"
            "बुकिंग जारी रखने के लिए कृपया एक उपलब्ध तारीख और समय चुनें।"
        ),
    },
    PROCEDURE_REJECTED: {
        "en": "Your request for {procedure_name} could not be approved at this time.{reason_line}",
        "hi": "इस समय {procedure_name} के लिए आपका अनुरोध स्वीकृत नहीं किया जा सका।{reason_line}",
    },
    PROCEDURE_CONFIRMATION_SUMMARY: {
        "en": (
            "🩺 *Review {appointment_type_label} Booking*\n\n"
            "👤 Guest: {patient_name}\n"
            "🆔 Guest ID: {patient_code}\n"
            "Procedure: {procedure_name}\n"
            "{order_reference_line}"
            "🏥 Location: {department_name}\n"
            "📅 Date: {date_label}\n"
            "🕐 Time: {time_label}\n"
            "{estimate_line}"
            "{instructions_line}"
            "Please review the details before confirming your booking."
        ),
        "hi": (
            "🩺 *{appointment_type_label} बुकिंग जांचें*\n\n"
            "👤 अतिथि: {patient_name}\n"
            "🆔 अतिथि आईडी: {patient_code}\n"
            "प्रक्रिया: {procedure_name}\n"
            "{order_reference_line}"
            "🏥 स्थान: {department_name}\n"
            "📅 तारीख: {date_label}\n"
            "🕐 समय: {time_label}\n"
            "{estimate_line}"
            "{instructions_line}"
            "कृपया बुकिंग कन्फर्म करने से पहले विवरण जांच लें।"
        ),
    },
    PROCEDURE_ESTIMATE_LINE: {
        "en": "💰 Estimated Charges: ₹{amount}\nNote: Medicines, consumables, investigations, or additional services may affect the final charge.\n\n",
        "hi": "💰 अनुमानित शुल्क: ₹{amount}\nनोट: दवाइयां, उपभोग्य सामग्री, जांच, या अतिरिक्त सेवाएं अंतिम शुल्क को प्रभावित कर सकती हैं।\n\n",
    },
    PROCEDURE_ORDER_REFERENCE_LINE: {"en": "🔗 Linked Order: {order_reference}\n", "hi": "🔗 संबंधित आदेश: {order_reference}\n"},
    PROCEDURE_INSTRUCTIONS_LINE: {
        "en": "📝 *Please note:* {instructions}\n\n",
        "hi": "📝 *कृपया ध्यान दें:* {instructions}\n\n",
    },
    PROCEDURE_BOOKING_CONFIRMED: {
        "en": (
            "✅ *Daycare / Procedure Booking Confirmed*\n"
            "Booking ID: {reference_id}\n"
            "Guest: {patient_name}\n"
            "Procedure: {procedure_name}\n"
            "Section: {department_name}\n"
            "Date: {date_label}\n"
            "Time: {time_label}\n\n"
            "Please arrive as instructed and carry the required documents/orders."
        ),
        "hi": (
            "✅ *डेकेयर / प्रक्रिया बुकिंग कन्फर्म*\n"
            "बुकिंग आईडी: {reference_id}\n"
            "अतिथि: {patient_name}\n"
            "प्रक्रिया: {procedure_name}\n"
            "सेक्शन: {department_name}\n"
            "तारीख: {date_label}\n"
            "समय: {time_label}\n\n"
            "कृपया निर्देशानुसार समय पर पहुंचें और आवश्यक दस्तावेज़/आदेश साथ लाएं।"
        ),
    },
    PROCEDURE_RESCHEDULE_REQUEST_PROMPT: {
        "en": "Please select your preferred new date and time. This procedure requires restaurant approval before the change is confirmed.",
        "hi": "कृपया अपनी पसंदीदा नई तारीख और समय चुनें। इस प्रक्रिया में बदलाव कन्फर्म होने से पहले रेस्तरां की मंजूरी आवश्यक है।",
    },
    PROCEDURE_RESCHEDULE_REQUESTED: {
        "en": "Your reschedule request has been sent to the restaurant for approval. We will notify you once it's confirmed.",
        "hi": "आपका रीशेड्यूल अनुरोध रेस्तरां को मंजूरी हेतु भेज दिया गया है। कन्फर्म होते ही हम आपको सूचित करेंगे।",
    },
    PROCEDURE_RESCHEDULE_APPROVED: {
        "en": (
            "✅ Your reschedule request has been approved.\n"
            "New Date: {date_label}\nNew Time: {time_label}"
        ),
        "hi": (
            "✅ आपका रीशेड्यूल अनुरोध स्वीकृत कर दिया गया है।\n"
            "नई तारीख: {date_label}\nनया समय: {time_label}"
        ),
    },
    PROCEDURE_RESCHEDULE_REJECTED: {
        "en": "Your reschedule request could not be approved. Your original reservation remains unchanged.",
        "hi": "आपका रीशेड्यूल अनुरोध स्वीकृत नहीं किया जा सका। आपका मूल रिज़र्वेशन अपरिवर्तित है।",
    },
}
