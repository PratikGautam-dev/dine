"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { cn } from "@/lib/cn";
import { MessageCircle, UserRound } from "lucide-react";
import { formatShortDateTime, formatTimeOnly } from "@/lib/formatDate";
import { TYPE_LABELS, type Appointment } from "@/hooks/useAppointments";
import { AppointmentCellAction } from "./appointments-cellaction";

const STATUS_STYLES: Record<string, string> = {
  booked: "bg-success-tint text-success",
  cancelled: "bg-error-tint text-error",
  rescheduled: "bg-clay-100 text-clay-700",
  attended: "bg-success-tint text-success",
  no_show: "bg-error-tint text-error",
};
export const STATUS_LABELS: Record<string, string> = {
  booked: "Confirmed", cancelled: "Cancelled", rescheduled: "Rescheduled",
  attended: "Attended", no_show: "No-show",
};
const SOURCE_LABELS: Record<string, string> = { whatsapp: "WhatsApp", staff: "Walk-in" };

function formatDay(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

type CreateAppointmentColumnsOptions = {
  /** May this person change reservations (mark attendance, reschedule, cancel)? View-only roles just read. */
  canWrite: boolean;
  selected: Set<number>;
  toggleSelected: (id: number, checked: boolean) => void;
  toggleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  deletableCount: number;
  markingAttendanceId: number | null;
  onAttendance: (id: number, attended: boolean) => void;
  cancelPanelId: number | null;
  reschedulePanelId: number | null;
  reassignPanelId: number | null;
  onOpenReschedule: (id: number) => void;
  onOpenCancel: (id: number) => void;
  onOpenReassign: (id: number) => void;
  deletingId: number | null;
  onDelete: (id: number) => void;
};

/** Column definitions for the /portal/appointments DataTable -- same 13
 * columns (selection through trailing actions) the hand-rolled table used
 * to render directly, just expressed as ColumnDefs so DataTable (@tanstack/
 * react-table under the hood) owns rendering + client-side pagination. */
export function createAppointmentColumns({
  canWrite, selected, toggleSelected, toggleSelectAll, allSelected, deletableCount,
  markingAttendanceId, onAttendance,
  cancelPanelId, reschedulePanelId, reassignPanelId, onOpenReschedule, onOpenCancel, onOpenReassign,
  deletingId, onDelete,
}: CreateAppointmentColumnsOptions): ColumnDef<Appointment>[] {
  return [
    {
      id: "select",
      header: () => (
        <PermissionGate page="appointments" action="delete">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            disabled={deletableCount === 0}
            className="h-4 w-4 accent-brand-600"
            aria-label="Select all deletable reservations"
          />
        </PermissionGate>
      ),
      cell: ({ row }) => {
        const a = row.original;
        if (a.status === "booked") return null;
        return (
          <PermissionGate page="appointments" action="delete">
            <input
              type="checkbox"
              checked={selected.has(a.id)}
              onChange={(e) => toggleSelected(a.id, e.target.checked)}
              className="h-4 w-4 accent-brand-600"
              aria-label={`Select reservation ${a.reference_id || a.id}`}
            />
          </PermissionGate>
        );
      },
    },
    {
      id: "reference_id",
      header: "Reference",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div>
            <div className="whitespace-nowrap font-mono text-[12px] font-semibold text-ink-900">{a.reference_id || "—"}</div>
            <div className="whitespace-nowrap text-[11.5px] text-ink-400">
              {a.created_at ? `Booked ${formatShortDateTime(a.created_at)}` : ""}
              {a.appointment_type_id && a.appointment_type_id !== "new" ? ` · ${TYPE_LABELS[a.appointment_type_id] || a.appointment_type_id}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      id: "patient",
      header: "Guest",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="min-w-[120px] text-ink-900">
            <div className="font-semibold">{a.patient_name || a.phone}</div>
            {a.patient_name && <div className="text-[12px] text-ink-600">{a.phone}</div>}
          </div>
        );
      },
    },
    {
      id: "scheduled_at",
      header: "Date & time",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold text-ink-900">{formatDay(row.original.scheduled_at)}</div>
          <div className="tabular-nums text-[12.5px] text-ink-600">{formatTimeOnly(row.original.scheduled_at)}</div>
        </div>
      ),
    },
    {
      // Table reservations (migration 0030): table_name (the real assigned table) takes priority when present;
      // doctor_name is the fallback for any non-table-reservation appointment (a legacy doctor appointment
      // fixture, if one still exists) -- the two are never both set on the same row.
      id: "table_or_doctor_name",
      header: "Table",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="whitespace-nowrap">
            <div className="font-semibold text-ink-900">{a.table_name || a.doctor_name || "—"}</div>
            <div className="text-[12px] text-ink-600">
              {a.party_size ? `${a.party_size} ${a.party_size === 1 ? "guest" : "guests"}` : ""}
              {a.party_size && a.department_name ? " · " : ""}
              {a.department_name || ""}
            </div>
          </div>
        );
      },
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => {
        const Icon = row.original.source === "whatsapp" ? MessageCircle : UserRound;
        return (
          <span className="inline-flex items-center gap-space-1 whitespace-nowrap text-ink-600">
            <Icon size={14} className="text-ink-400" />
            {SOURCE_LABELS[row.original.source] || row.original.source}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const a = row.original;
        // "Did they come?" -- admin-editable at any time, not gated on the scheduled time having passed, and freely
        // re-toggleable (not a one-way door) -- per direct portal feedback.
        const canMark = canWrite && (a.status === "booked" || a.status === "attended" || a.status === "no_show");
        return (
          <div className="whitespace-nowrap">
            <span
              className={cn(
                "rounded-full px-space-2 py-0.5 text-[11px] font-semibold",
                STATUS_STYLES[a.status] || "bg-black/[0.04] text-ink-600",
              )}
            >
              {STATUS_LABELS[a.status] || a.status}
            </span>
            {canMark && (
              <div className="mt-1 inline-flex w-full items-center gap-space-1 text-[12px] text-ink-400">
                Came?
                <button
                  type="button"
                  onClick={() => onAttendance(a.id, true)}
                  disabled={markingAttendanceId === a.id}
                  className={cn(
                    "font-semibold disabled:opacity-50",
                    a.status === "attended" ? "text-success underline" : "text-ink-600 hover:text-success hover:underline",
                  )}
                >
                  Yes
                </button>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => onAttendance(a.id, false)}
                  disabled={markingAttendanceId === a.id}
                  className={cn(
                    "font-semibold disabled:opacity-50",
                    a.status === "no_show" ? "text-destructive underline" : "text-ink-600 hover:text-destructive hover:underline",
                  )}
                >
                  No
                </button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="text-right">
          <AppointmentCellAction
            appointment={row.original}
            cancelPanelId={cancelPanelId}
            reschedulePanelId={reschedulePanelId}
            reassignPanelId={reassignPanelId}
            onOpenReschedule={onOpenReschedule}
            onOpenCancel={onOpenCancel}
            onOpenReassign={onOpenReassign}
            deletingId={deletingId}
            onDelete={onDelete}
            canWrite={canWrite}
          />
        </div>
      ),
    },
  ];
}
