"use client";

import { CalendarClock, Armchair, CircleCheck, MoreHorizontal, Trash2, UserX, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Appointment } from "@/hooks/useAppointments";
import { usePermission } from "@/lib/staffAuth";

type AppointmentCellActionProps = {
  appointment: Appointment;
  cancelPanelId: number | null;
  reschedulePanelId: number | null;
  reassignPanelId: number | null;
  onOpenReschedule: (id: number) => void;
  onOpenCancel: (id: number) => void;
  onOpenReassign: (id: number) => void;
  deletingId: number | null;
  onDelete: (id: number) => void;
  canWrite: boolean;
  /** "Did they come?" -- lives here (not inline in the Status column) to keep the table compact;
   * freely re-toggleable, not gated on the scheduled time having passed. */
  markingAttendanceId: number | null;
  onAttendance: (id: number, attended: boolean) => void;
};

/** The row's "..." menu -- Reschedule / Reassign table / Cancel for a still-'booked' row (hidden while any inline
 * panel is already open for it), or Delete for a resolved one (only ever offered for a non-'booked' reservation,
 * matching the backend's own guard, and only to people who may delete). */
export function AppointmentCellAction({
  appointment: a,
  cancelPanelId,
  reschedulePanelId,
  reassignPanelId,
  onOpenReschedule,
  onOpenCancel,
  onOpenReassign,
  deletingId,
  onDelete,
  canWrite,
  markingAttendanceId,
  onAttendance,
}: AppointmentCellActionProps) {
  const canDelete = usePermission("appointments", "delete");
  const booked = a.status === "booked";
  const canMarkAttendance = canWrite && (a.status === "booked" || a.status === "attended" || a.status === "no_show");
  const canDeleteThisRow = a.status !== "booked" && a.status !== "pending";
  if (!canMarkAttendance && booked && !canWrite) return null;
  if (booked && (cancelPanelId === a.id || reschedulePanelId === a.id || reassignPanelId === a.id)) return null;
  if (!canMarkAttendance && !(canDeleteThisRow && canDelete)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for reservation ${a.reference_id || a.id}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
      >
        <MoreHorizontal size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canMarkAttendance && (
          <>
            <DropdownMenuItem disabled={markingAttendanceId === a.id} onClick={() => onAttendance(a.id, true)}>
              <CircleCheck size={15} /> {a.status === "attended" ? "Undo — mark not arrived" : "Mark arrived"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={markingAttendanceId === a.id} onClick={() => onAttendance(a.id, false)}>
              <UserX size={15} /> {a.status === "no_show" ? "Undo — mark not a no-show" : "Mark no-show"}
            </DropdownMenuItem>
          </>
        )}
        {booked && canWrite && (
          <>
            <DropdownMenuItem onClick={() => onOpenReschedule(a.id)}>
              <CalendarClock size={15} /> Reschedule
            </DropdownMenuItem>
            {a.table_id && (
              <DropdownMenuItem onClick={() => onOpenReassign(a.id)}>
                <Armchair size={15} /> Reassign table
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => onOpenCancel(a.id)}>
              <X size={15} /> Cancel reservation
            </DropdownMenuItem>
          </>
        )}
        {canDeleteThisRow && canDelete && (
          <DropdownMenuItem variant="destructive" disabled={deletingId === a.id} onClick={() => onDelete(a.id)}>
            <Trash2 size={15} /> {deletingId === a.id ? "Deleting…" : "Delete"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
