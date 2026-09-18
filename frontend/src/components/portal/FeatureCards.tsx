import { Calendar, CalendarClock, CalendarX, HelpCircle, Languages, ListChecks, UtensilsCrossed } from "lucide-react";
import { Card } from "@/components/ui/Card";

const FEATURE_META: Record<string, { label: string; Icon: typeof Calendar }> = {
  book_appointment: { label: "Book a Table", Icon: Calendar },
  order_food: { label: "Order Food", Icon: UtensilsCrossed },
  reschedule: { label: "Reschedule Reservation", Icon: CalendarClock },
  cancel: { label: "Cancel Reservation", Icon: CalendarX },
  view_appointments: { label: "View Reservations", Icon: ListChecks },
  manage_language: { label: "Manage Language", Icon: Languages },
  faq: { label: "FAQ / Information", Icon: HelpCircle },
};

/** Display-only -- shows which patient-facing WhatsApp capabilities are
 * currently on for this hospital. Not clickable; enabling/disabling features
 * happens at onboarding/edit-tenant time, not from the dashboard. */
export function FeatureCards({ enabledFeatures }: { enabledFeatures: string[] }) {
  const known = enabledFeatures.filter((f) => FEATURE_META[f]);
  return (
    <Card className="p-space-4">
      <h3 className="text-label mb-space-3 font-bold text-ink-900">What we provide</h3>
      {known.length === 0 ? (
        <p className="py-space-2 text-center text-[13px] text-ink-400">No guest-facing features enabled yet.</p>
      ) : (
        <div className="flex flex-wrap gap-space-2">
          {known.map((key) => {
            const { label, Icon } = FEATURE_META[key];
            return (
              <span
                key={key}
                className="flex items-center gap-space-2 rounded-md border border-line bg-paper px-space-3 py-space-2 text-[12.5px] font-semibold text-ink-700"
              >
                <Icon size={14} strokeWidth={2} className="text-brand-600" />
                {label}
              </span>
            );
          })}
        </div>
      )}
    </Card>
  );
}
