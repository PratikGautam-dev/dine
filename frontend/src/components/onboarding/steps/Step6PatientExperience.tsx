import {
  Calendar,
  CalendarClock,
  CalendarX,
  FlaskConical,
  HelpCircle,
  IdCard,
  Info,
  Languages,
  ListChecks,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { FEATURE_LABELS, FeatureKey, WizardState } from "../types";
import type { WizardDispatch } from "../useWizardState";

const FEATURE_ICONS: Record<FeatureKey, typeof Calendar> = {
  book_doctor_appointment: Calendar,
  tests_diagnostics: FlaskConical,
  reschedule: CalendarClock,
  cancel: CalendarX,
  view_appointments: ListChecks,
  reports_prescriptions: IdCard,
  manage_patients: Users,
  consent_privacy: ShieldCheck,
  manage_language: Languages,
  hospital_info: Info,
  reception_handoff: UserRound,
  faq: HelpCircle,
};

const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  book_doctor_appointment: "Guests choose a section, table, and seating time for a reservation.",
  tests_diagnostics: "Guests can request a special seating arrangement or large-party reservation, depending on your setup.",
  reschedule: "Move an existing reservation to a new time.",
  cancel: "Cancel an existing reservation.",
  view_appointments: "See a list of upcoming reservations.",
  reports_prescriptions: "Guests can browse ordering-ahead options when that feature is available.",
  manage_patients: "One phone can link up to 5 guests, each with their own profile.",
  consent_privacy: "Privacy notice, consent status, and a marketing-messages opt-in/out.",
  manage_language: "Guests can switch their conversation language at any time from the main menu.",
  hospital_info: "Hours, location, parking, and general restaurant information.",
  reception_handoff: "Hand off to a host or staff member through the portal's Messages inbox.",
  faq: "Guests pick a topic (hours, location, pricing...) and get an instant answer.",
};

const FEATURE_ORDER = Object.keys(FEATURE_LABELS) as FeatureKey[];

type Props = { state: WizardState; dispatch: WizardDispatch; error?: string };

export function Step6PatientExperience({ state, dispatch, error }: Props) {
  return (
    <div>
      <p className="text-eyebrow mb-space-2">Step 6 of 9</p>
      <h2 className="text-display mb-space-2">What should guests be able to do on WhatsApp?</h2>
      <p className="text-body mb-space-4">
        Select every capability this restaurant wants to offer — guests only ever see the ones you turn on here.
        You can change this later.
      </p>

      <div className="grid grid-cols-1 gap-space-3 md:grid-cols-2 lg:grid-cols-3">
        {FEATURE_ORDER.map((key) => {
          const Icon = FEATURE_ICONS[key];
          const selected = state.enabledFeatures.includes(key);
          return (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer flex-col rounded-lg border bg-card p-space-4 shadow-[var(--shadow-sm)] transition-all duration-150 ease-(--ease-standard)",
                "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
                selected ? "border-brand-400 ring-2 ring-brand-100" : "border-line",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected}
                onChange={() => dispatch({ type: "toggleFeature", key })}
              />
              <div className="mb-space-2 flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-[10px]",
                    selected ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
                  )}
                >
                  <Icon size={16} strokeWidth={2} />
                </div>
              </div>
              <h3 className="mb-space-1 text-[14.5px] font-bold text-ink-900">{FEATURE_LABELS[key]}</h3>
              <p className="text-[12.5px] leading-relaxed text-ink-600">{FEATURE_DESCRIPTIONS[key]}</p>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-space-3 text-[12.5px] font-medium text-error">{error}</p>}
    </div>
  );
}

export function validateStep6(state: WizardState): string | null {
  if (state.enabledFeatures.length === 0) return "Select at least one capability for guests to use.";
  return null;
}
