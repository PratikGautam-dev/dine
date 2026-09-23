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
  pending: "bg-warning-tint text-warning",
  cancelled: "bg-error-tint text-error",
  rescheduled: "bg-clay-100 text-clay-700",
  attended: "bg-success-tint text-success",
  no_show: "bg-error-tint text-error",
};
export const STATUS_LABELS: Record<string, string> = {
  booked: "Confirmed", pending: "Pending", cancelled: "Cancelled", rescheduled: "Rescheduled",
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
  /** Live Operations' real per-table occupancy -- a still-'booked' row whose table is in this set
   * shows "Seated" instead of "Confirmed", derived rather than a stored status. */
  occupiedTableIds: Set<string>;
  /** Table Bookings follow-up: confirms a still-'pending' row (only ever populated when this
   * hospital opted into require_booking_confirmation). */
  onConfirm: (id: number) => void;
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
  markingAttendanceId, onAttendance, occupiedTableIds, onConfirm,
  cancelPanelId, reschedulePanelId, reassignPanelId, onOpenReschedule, onOpenCancel, onOpenReassign,
  deletingId, onDelete,
}: CreateAppointmentColumnsOptions): ColumnDef<Appointment>[] {
  return [
    {
      id: "select",
      meta: { className: "min-w-9 w-9" },
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
        if (a.status === "booked" || a.status === "pending") return null;
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
      meta: { className: "min-w-[105px]" },
      header: "Booking ID",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div
            className="whitespace-nowrap font-mono text-[12px] font-semibold text-ink-900"
            title={a.created_at ? `Booked ${formatShortDateTime(a.created_at)}` : undefined}
          >
            {a.reference_id || "—"}
            {a.appointment_type_id && a.appointment_type_id !== "new" && (
              <span className="ml-1 font-sans font-normal text-ink-400">· {TYPE_LABELS[a.appointment_type_id] || a.appointment_type_id}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "patient",
      meta: { className: "min-w-[105px]" },
      header: "Guest Name",
      cell: ({ row }) => {
        const a = row.original;
        return <div className="font-semibold text-ink-900">{a.patient_name || a.phone}</div>;
      },
    },
    {
      id: "contact",
      meta: { className: "min-w-[105px]" },
      header: "Contact",
      cell: ({ row }) => <div className="whitespace-nowrap text-ink-600">{row.original.phone}</div>,
    },
    {
      id: "date",
      meta: { className: "min-w-[80px]" },
      header: "Date",
      cell: ({ row }) => <div className="whitespace-nowrap font-semibold text-ink-900">{formatDay(row.original.scheduled_at)}</div>,
    },
    {
      id: "time",
      meta: { className: "min-w-[65px]" },
      header: "Time",
      cell: ({ row }) => <div className="whitespace-nowrap tabular-nums text-ink-600">{formatTimeOnly(row.original.scheduled_at)}</div>,
    },
    {
      id: "party_size",
      meta: { className: "min-w-[55px]" },
      header: "Party Size",
      cell: ({ row }) => <div className="tabular-nums text-ink-600">{row.original.party_size ?? "—"}</div>,
    },
    {
      // Table reservations (migration 0030): table_name (the real assigned table) takes priority when present;
      // doctor_name is the fallback for any non-table-reservation appointment (a legacy doctor appointment
      // fixture, if one still exists) -- the two are never both set on the same row.
      id: "table_or_doctor_name",
      meta: { className: "min-w-[65px]" },
      header: "Table",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="whitespace-nowrap font-semibold text-ink-900" title={a.department_name || undefined}>
            {a.table_name || a.doctor_name || "—"}
          </div>
        );
      },
    },
    {
      id: "special_request",
      meta: { className: "min-w-[90px]" },
      header: "Special Request",
      cell: ({ row }) => {
        const note = row.original.special_request;
        return note ? (
          <div className="max-w-[130px] truncate text-[13px] text-ink-600" title={note}>{note}</div>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        );
      },
    },
    {
      id: "source",
      meta: { className: "min-w-[85px]" },
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
      meta: { className: "min-w-[110px]" },
      header: "Status",
      cell: ({ row }) => {
        const a = row.original;
        // Live Operations' real per-table occupancy -- display-only, not a stored status.
        const seated = a.status === "booked" && a.table_id != null && occupiedTableIds.has(a.table_id);
        return (
          <div className="whitespace-nowrap">
            <span
              className={cn(
                "rounded-full px-space-2 py-0.5 text-[11px] font-semibold",
                STATUS_STYLES[a.status] || "bg-black/[0.04] text-ink-600",
              )}
            >
              {seated ? "Seated" : STATUS_LABELS[a.status] || a.status}
            </span>
            {canWrite && a.status === "pending" && (
              <button
                type="button"
                onClick={() => onConfirm(a.id)}
                className="ml-1 rounded-md bg-brand-600 px-space-2 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-700"
              >
                Confirm
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      meta: { className: "min-w-9 w-9" },
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
            markingAttendanceId={markingAttendanceId}
            onAttendance={onAttendance}
          />
        </div>
      ),
    },
  ];
}
