import { MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTimeOnly } from "@/lib/formatDate";
import type { Appointment } from "@/hooks/useAppointments";

const STATUS_STYLES: Record<string, string> = {
  booked: "bg-success-tint text-success",
  pending: "bg-warning-tint text-warning",
  attended: "bg-success-tint text-success",
  no_show: "bg-error-tint text-error",
  cancelled: "bg-black/[0.04] text-ink-600",
  rescheduled: "bg-clay-100 text-clay-700",
};
const STATUS_LABELS: Record<string, string> = {
  booked: "Confirmed", pending: "Pending", attended: "Attended", no_show: "No-show", cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};
const SOURCE_LABELS: Record<string, string> = { whatsapp: "WhatsApp", staff: "Walk-in" };

type Props = {
  items: Appointment[];
  /** May this person mark attendance? View-only roles get the queue without the action button. */
  canWrite: boolean;
  markingAttendanceId: number | null;
  onAttendance: (id: number, attended: boolean) => void;
  /** Live Operations' real per-table occupancy -- a still-'booked' row whose table is in this set
   * shows "Seated" instead of "Confirmed", derived rather than a stored status. */
  occupiedTableIds?: Set<string>;
  /** Table Bookings follow-up: confirms a still-'pending' row (only ever populated when this
   * hospital opted into require_booking_confirmation). Undefined hides the Confirm button entirely. */
  onConfirm?: (id: number) => void;
};

/** Today's reservations as a live-style work queue -- one scannable row per booking, in time order, with the
 * one real action a still-open row actually has (mark attended / no-show) visible inline rather than hidden
 * behind a menu. Built from the same list the table below already loaded -- no extra data, no auto-refresh
 * claims beyond what the page itself already does. */
export function TodayScheduleCard({ items, canWrite, markingAttendanceId, onAttendance, occupiedTableIds, onConfirm }: Props) {
  return (
    <div className="rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between gap-space-3 border-b border-line px-space-4 py-space-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">Today&apos;s queue</h3>
          <p className="text-hint">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            {items.length > 0 ? ` · ${items.length} ${items.length === 1 ? "reservation" : "reservations"}` : ""}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-space-6 text-center text-[13px] text-ink-400">No reservations today.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
                <th className="px-space-4 py-space-2">Time</th>
                <th className="px-space-2 py-space-2">Guest</th>
                <th className="px-space-2 py-space-2">Party</th>
                <th className="px-space-2 py-space-2">Table</th>
                <th className="px-space-2 py-space-2">Source</th>
                <th className="px-space-2 py-space-2">Status</th>
                <th className="px-space-4 py-space-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const canMark = canWrite && (a.status === "booked" || a.status === "attended" || a.status === "no_show");
                const Icon = a.source === "whatsapp" ? MessageCircle : UserRound;
                // Live Operations' real table occupancy -- display-only, not a stored status.
                const seated = a.status === "booked" && a.table_id != null && occupiedTableIds?.has(a.table_id);
                return (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-space-4 py-space-2 font-semibold tabular-nums text-ink-900">
                      {formatTimeOnly(a.scheduled_at)}
                    </td>
                    <td className="px-space-2 py-space-2 text-ink-900">
                      {a.patient_name || a.phone}
                      {a.special_request && (
                        <span className="ml-1 text-[11.5px] text-ink-400" title={a.special_request}>· {a.special_request}</span>
                      )}
                    </td>
                    <td className="px-space-2 py-space-2 tabular-nums text-ink-600">{a.party_size ?? "—"}</td>
                    <td className="px-space-2 py-space-2 text-ink-600">{a.table_name || a.doctor_name || "—"}</td>
                    <td className="px-space-2 py-space-2">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-600">
                        <Icon size={13} className="text-ink-400" />
                        {SOURCE_LABELS[a.source] || a.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-space-2 py-space-2">
                      <span className={cn("rounded-full px-space-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[a.status] || "bg-black/[0.04] text-ink-600")}>
                        {seated ? "Seated" : STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-space-4 py-space-2 text-right">
                      {onConfirm && a.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => onConfirm(a.id)}
                          className="rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700"
                        >
                          Confirm
                        </button>
                      ) : canMark ? (
                        a.status === "booked" ? (
                          <button
                            type="button"
                            onClick={() => onAttendance(a.id, true)}
                            disabled={markingAttendanceId === a.id}
                            className="rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            Mark arrived
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAttendance(a.id, a.status !== "attended")}
                            disabled={markingAttendanceId === a.id}
                            className="text-[12px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
                          >
                            {a.status === "attended" ? "Undo" : "Mark arrived"}
                          </button>
                        )
                      ) : (
                        <span className="text-[12px] text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
