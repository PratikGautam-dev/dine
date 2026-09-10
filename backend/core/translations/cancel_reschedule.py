# core/translations/cancel_reschedule.py
"""Cancel and reschedule flows, plus the appointment-selection menu they
both share."""
from core.translations._common import Language


NO_UPCOMING_TO_CANCEL = "no_upcoming_to_cancel"
WHICH_APPOINTMENT_CANCEL = "which_appointment_cancel"
APPOINTMENT_LOOKUP_ERROR = "appointment_lookup_error"
CANCEL_CONFIRM_QUESTION = "cancel_confirm_question"
APPOINTMENT_CANCELLED = "appointment_cancelled"
CANCELLATION_ABORTED = "cancellation_aborted"
NO_UPCOMING_TO_RESCHEDULE = "no_upcoming_to_reschedule"
WHICH_APPOINTMENT_RESCHEDULE = "which_appointment_reschedule"
RESCHEDULE_CONFIRM_SUMMARY = "reschedule_confirm_summary"
APPOINTMENT_RESCHEDULED = "appointment_rescheduled"
RESCHEDULE_ABORTED = "reschedule_aborted"
VIEW_APPOINTMENTS_BUTTON = "view_appointments_button"
YOUR_APPOINTMENTS_SECTION_TITLE = "your_appointments_section_title"

STRINGS: dict[str, dict[Language, str]] = {
    # --- Cancel flow ---
    NO_UPCOMING_TO_CANCEL: {
        "en": "You don't have any upcoming reservations to cancel.",
        "hi": "रद्द करने के लिए आपका कोई आगामी रिज़र्वेशन नहीं है।",
    },
    WHICH_APPOINTMENT_CANCEL: {
        "en": "Which reservation would you like to cancel?",
        "hi": "आप कौन सा रिज़र्वेशन रद्द करना चाहते हैं?",
    },
    APPOINTMENT_LOOKUP_ERROR: {
        "en": "Something went wrong finding that reservation. Please start over.",
        "hi": "उस रिज़र्वेशन को खोजने में कुछ गलत हो गया। कृपया फिर से शुरू करें।",
    },
    CANCEL_CONFIRM_QUESTION: {
        "en": "Are you sure you want to cancel your reservation at {doctor_name} on {when}?",
        "hi": "क्या आप वाकई {doctor_name} में {when} का अपना रिज़र्वेशन रद्द करना चाहते हैं?",
    },
    APPOINTMENT_CANCELLED: {
          "en": "✅ *Reservation Cancelled*\n\n"
              "Venue: {doctor_name}\nDate: {when}\n\n"
              "Your reservation has been cancelled successfully.",
          "hi": "✅ *रिज़र्वेशन रद्द*\n\n"
              "स्थान: {doctor_name}\nतारीख: {when}\n\n"
              "आपका रिज़र्वेशन सफलतापूर्वक रद्द कर दिया गया है।",
    },
    CANCELLATION_ABORTED: {
        "en": "Okay, your reservation was not cancelled.",
        "hi": "ठीक है, आपका रिज़र्वेशन रद्द नहीं किया गया।",
    },

    # --- Reschedule flow ---
    NO_UPCOMING_TO_RESCHEDULE: {
        "en": "You don't have any upcoming reservations to reschedule.",
        "hi": "समय बदलने के लिए आपका कोई आगामी रिज़र्वेशन नहीं है।",
    },
    WHICH_APPOINTMENT_RESCHEDULE: {
        "en": "Which reservation would you like to reschedule?",
        "hi": "आप किस रिज़र्वेशन का समय बदलना चाहते हैं?",
    },
    RESCHEDULE_CONFIRM_SUMMARY: {
        "en": "Please confirm your new reservation time:\n\nVenue: {doctor_name}\nNew Slot: {slot_label}",
        "hi": "कृपया अपने नए रिज़र्वेशन के समय की पुष्टि करें:\n\nस्थान: {doctor_name}\nनया स्लॉट: {slot_label}",
    },
    APPOINTMENT_RESCHEDULED: {
          "en": "✅ *Reservation Rescheduled*\n\n"
              "Venue: {doctor_name}\nNew Slot: {slot_label}\n\n"
              "We look forward to welcoming you.",
          "hi": "✅ *रिज़र्वेशन का समय बदला गया*\n\n"
              "स्थान: {doctor_name}\nनया स्लॉट: {slot_label}\n\n"
              "हम आपका स्वागत करने के लिए उत्सुक हैं।",
    },
    RESCHEDULE_ABORTED: {
        "en": "Okay, your reservation was not rescheduled.",
        "hi": "ठीक है, आपके रिज़र्वेशन का समय नहीं बदला गया।",
    },

    # --- Shared: appointment-selection menu (cancel + reschedule) ---
    VIEW_APPOINTMENTS_BUTTON: {"en": "View Reservations", "hi": "रिज़र्वेशन देखें"},
    YOUR_APPOINTMENTS_SECTION_TITLE: {"en": "Your Reservations", "hi": "आपके रिज़र्वेशन"},
}
