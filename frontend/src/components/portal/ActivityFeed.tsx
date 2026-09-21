import { CalendarCheck, CalendarX, CircleCheck, RefreshCw, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatShortDateTime } from "@/lib/formatDate";

type ActivityItem = {
  label: string;
  guest_name: string | null;
  phone: string;
  doctor_name: string | null;
  table_name: string | null;
  party_size: number | null;
  department_name: string;
  at: string;
};

// The API sends a readable label for every status (see get_recent_activity_feed); an unknown one just gets the
// default icon.
const ICONS: Record<string, typeof CalendarCheck> = {
  "Booked reservation": CalendarCheck,
  "Cancelled reservation": CalendarX,
  "Rescheduled reservation": RefreshCw,
  "Attended reservation": CircleCheck,
  "No-show reservation": UserX,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-space-4">
      <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Recent activity</h3>
      {items.length === 0 ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">Nothing has happened yet.</p>
      ) : (
        <ul className="max-h-[420px] space-y-space-3 overflow-y-auto pr-space-1">
          {items.map((item, i) => {
            const Icon = ICONS[item.label] || CalendarCheck;
            return (
              <li key={i} className="flex items-start gap-space-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon size={13} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <p className="text-ink-900">
                    <span className="font-semibold">{item.guest_name || item.phone}</span> — {item.label.toLowerCase()}
                    {item.party_size ? ` for ${item.party_size}` : ""}
                    {item.table_name ? ` at ${item.table_name}` : item.doctor_name ? ` with ${item.doctor_name}` : ""}{" "}
                    ({item.department_name})
                  </p>
                  <p className="text-hint">{formatShortDateTime(item.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
