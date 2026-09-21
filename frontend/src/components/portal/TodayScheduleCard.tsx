import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatTimeOnly } from "@/lib/formatDate";
import type { Appointment } from "@/hooks/useAppointments";

const DOT: Record<string, string> = {
  booked: "bg-success",
  attended: "bg-ink-400",
  no_show: "bg-destructive",
};
const STATUS_HINT: Record<string, string> = { booked: "Confirmed", attended: "Attended", no_show: "No-show" };

/** Today's reservations in time order, from the same list the page already loaded (no extra data). */
export function TodayScheduleCard({ items }: { items: Appointment[] }) {
  return (
    <Card className="p-space-4">
      <div className="mb-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">Today&apos;s schedule</h3>
        <p className="text-hint">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          {items.length > 0 ? ` · ${items.length} ${items.length === 1 ? "reservation" : "reservations"}` : ""}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">No reservations today.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-space-3 border-b border-line py-space-2">
              <span
                aria-hidden="true"
                className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[a.status] || "bg-ink-400")}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-900">{a.patient_name || a.phone}</p>
                <p className="truncate text-[12px] text-ink-600">
                  {a.party_size ? `${a.party_size} guests` : "Reservation"}
                  {a.table_name ? ` · ${a.table_name}` : ""}
                  {STATUS_HINT[a.status] ? ` · ${STATUS_HINT[a.status]}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-900">{formatTimeOnly(a.scheduled_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
