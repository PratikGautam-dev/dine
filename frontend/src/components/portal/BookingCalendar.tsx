"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Appointment } from "@/hooks/useAppointments";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A small month calendar, entirely computed from the appointment list the page already loaded --
 * no separate fetch, no invented data, just a dot on days that have a real, still-relevant booking. */
export function BookingCalendar({ appointments }: { appointments: Appointment[] }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === "cancelled" || a.status === "rescheduled") continue;
      const d = new Date(a.scheduled_at);
      const key = localDateKey(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [appointments]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: { date: Date | null }[] = [];
    for (let i = 0; i < startOffset; i++) out.push({ date: null });
    for (let day = 1; day <= daysInMonth; day++) out.push({ date: new Date(viewYear, viewMonth, day) });
    return out;
  }, [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <Card className="p-space-4">
      <div className="mb-space-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink-900">Booking Calendar</h3>
        <div className="flex items-center gap-space-2">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-md p-1 text-ink-600 hover:bg-paper">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[13px] font-semibold text-ink-900">
            {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-md p-1 text-ink-600 hover:bg-paper">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-400">
        {WEEKDAY_LABELS.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} />;
          const key = localDateKey(c.date);
          const count = countsByDay.get(key) || 0;
          const isToday = key === localDateKey(today);
          return (
            <div
              key={i}
              className={cn(
                "flex h-9 flex-col items-center justify-center rounded-md text-[12px]",
                isToday ? "bg-brand-600 font-bold text-white" : "text-ink-900",
              )}
              title={count > 0 ? `${count} booking${count === 1 ? "" : "s"}` : undefined}
            >
              {c.date.getDate()}
              {count > 0 && (
                <span className={cn("mt-0.5 h-1 w-1 rounded-full", isToday ? "bg-white" : "bg-brand-500")} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
