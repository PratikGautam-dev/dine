"use client";

import { Ban, CalendarClock, CircleCheck, Send, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Appointment } from "@/hooks/useAppointments";

type Props = {
  /** The row clicked in the table above -- null when nothing is selected yet, which disables every
   * button (there's no real target to act on). */
  appointment: Appointment | null;
  canWrite: boolean;
  onConfirm: (id: number) => void;
  onReschedule: (id: number) => void;
  onReassign: (id: number) => void;
  onSendReminder: (id: number) => void;
  onCancel: (id: number) => void;
};

const ACTIONS: {
  key: string;
  label: string;
  icon: typeof CircleCheck;
  tone: "success" | "brand" | "clay" | "info" | "destructive";
  /** Only enabled when the selected row's status makes this action meaningful -- undefined means
   * "any active reservation". */
  appliesTo?: (a: Appointment) => boolean;
}[] = [
  { key: "confirm", label: "Confirm", icon: CircleCheck, tone: "success", appliesTo: (a) => a.status === "pending" },
  { key: "reschedule", label: "Reschedule", icon: CalendarClock, tone: "brand", appliesTo: (a) => a.status === "booked" || a.status === "pending" },
  { key: "reassign", label: "Assign Table", icon: Users, tone: "clay", appliesTo: (a) => a.table_id != null && (a.status === "booked" || a.status === "pending") },
  { key: "reminder", label: "Send Reminder", icon: Send, tone: "info", appliesTo: (a) => a.status === "booked" || a.status === "pending" },
  { key: "cancel", label: "Cancel", icon: Ban, tone: "destructive", appliesTo: (a) => a.status === "booked" || a.status === "pending" },
];

const TONE_CLASSES: Record<string, string> = {
  success: "bg-success-tint text-success hover:bg-success/20",
  brand: "bg-brand-50 text-brand-600 hover:bg-brand-100",
  clay: "bg-clay-100 text-clay-700 hover:bg-clay-300/40",
  info: "bg-info-tint text-info hover:bg-info/15",
  destructive: "bg-destructive-tint text-destructive hover:bg-destructive/15",
};

/** A shortcut bar for the row currently selected (clicked) in the table above -- every button calls
 * the exact same real action its equivalent row-menu item already does; there is no target-less
 * "Quick Action" here that doesn't actually do anything. */
export function QuickActionsBar({ appointment, canWrite, onConfirm, onReschedule, onReassign, onSendReminder, onCancel }: Props) {
  const handlers: Record<string, (id: number) => void> = {
    confirm: onConfirm, reschedule: onReschedule, reassign: onReassign, reminder: onSendReminder, cancel: onCancel,
  };

  return (
    <Card className="mt-space-4 p-space-4">
      <h3 className="mb-space-3 text-[13px] font-bold text-ink-900">Quick Actions</h3>
      <div className="flex flex-wrap gap-space-4">
        {ACTIONS.map(({ key, label, icon: Icon, tone, appliesTo }) => {
          const enabled = canWrite && appointment !== null && (!appliesTo || appliesTo(appointment));
          return (
            <button
              key={key}
              type="button"
              disabled={!enabled}
              onClick={() => appointment && handlers[key](appointment.id)}
              className="flex flex-col items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", TONE_CLASSES[tone])}>
                <Icon size={18} />
              </span>
              <span className="text-[11.5px] font-semibold text-ink-600">{label}</span>
            </button>
          );
        })}
      </div>
      {!appointment && <p className="mt-space-3 text-[12px] text-ink-400">Click a reservation row above to act on it here.</p>}
    </Card>
  );
}
