"use client";

import { CalendarClock, Armchair, MoreHorizontal, Trash2, X } from "lucide-react";
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
}: AppointmentCellActionProps) {
  const canDelete = usePermission("appointments", "delete");
  const booked = a.status === "booked";
  if (booked && !canWrite) return null;
  if (booked && (cancelPanelId === a.id || reschedulePanelId === a.id || reassignPanelId === a.id)) return null;
  if (!booked && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for reservation ${a.reference_id || a.id}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
      >
        <MoreHorizontal size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {booked ? (
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
        ) : (
          <DropdownMenuItem variant="destructive" disabled={deletingId === a.id} onClick={() => onDelete(a.id)}>
            <Trash2 size={15} /> {deletingId === a.id ? "Deleting…" : "Delete"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
