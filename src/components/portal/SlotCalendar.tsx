"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type CalendarSlot = { id: string; date: string; time: string; label?: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "13:30" -> "1:30 PM" */
function clock12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Pick a date and a time from what is actually available: a month calendar whose open days are highlighted (every other day is greyed out and
 * can't be chosen), then the times left on the chosen day. `onChange(slot)` is called with the picked time, or `null` when the day changes
 * (the old time no longer applies). */
export function SlotCalendar({
  slots,
  value,
  onChange,
}: {
  slots: CalendarSlot[];
  /** the id of the picked slot, "" for none */
  value: string;
  onChange: (slot: CalendarSlot | null) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarSlot[]>();
    for (const s of slots) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [slots]);
  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);

  const picked = slots.find((s) => s.id === value) ?? null;
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const activeDay = picked?.date ?? chosenDay;
  // the month on show: the chosen day's, else the first with anything available
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const first = days[0] ? parseDay(days[0]) : new Date();
  const shown = month ?? {
    y: (activeDay ? parseDay(activeDay) : first).getFullYear(),
    m: (activeDay ? parseDay(activeDay) : first).getMonth(),
  };

  const monthKeys = useMemo(() => new Set(days.map((d) => d.slice(0, 7))), [days]);
  const shownKey = `${shown.y}-${String(shown.m + 1).padStart(2, "0")}`;
  const hasPrev = [...monthKeys].some((k) => k < shownKey);
  const hasNext = [...monthKeys].some((k) => k > shownKey);
  const step = (delta: number) => {
    const d = new Date(shown.y, shown.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const lead = new Date(shown.y, shown.m, 1).getDay();
  const count = new Date(shown.y, shown.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ];
  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const times = activeDay ? (byDay.get(activeDay) ?? []) : [];

  function chooseDay(key: string) {
    if (key === activeDay) return;
    setChosenDay(key);
    onChange(null);
  }

  return (
    <div className="rounded-lg border border-line bg-card p-space-3" data-testid="slot-calendar">
      <div className="mb-space-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!hasPrev}
          onClick={() => step(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-600 hover:bg-paper disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[14px] font-bold text-ink-900">
          {new Date(shown.y, shown.m, 1).toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!hasNext}
          onClick={() => step(1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-600 hover:bg-paper disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-[11px] font-semibold text-ink-400 uppercase">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`blank-${i}`} />;
          const key = dayKey(shown.y, shown.m, d);
          const open = byDay.has(key);
          const selected = key === activeDay;
          const past = key < todayKey;
          return (
            <button
              key={key}
              type="button"
              disabled={!open}
              aria-pressed={selected}
              aria-label={`${d} ${new Date(shown.y, shown.m, 1).toLocaleDateString("en-IN", { month: "long" })}${open ? "" : ", not available"}`}
              onClick={() => chooseDay(key)}
              className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums",
                // green = a table is free that day, red = nothing free (not clickable), plain grey = already past
                selected
                  ? "bg-success font-bold text-white"
                  : open
                    ? "bg-success-tint font-semibold text-success hover:brightness-95"
                    : past
                      ? "cursor-not-allowed text-ink-300"
                      : "cursor-not-allowed bg-destructive-tint text-destructive/70",
                key === todayKey && !selected && "ring-1 ring-success/60",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-space-2 flex items-center justify-center gap-space-4 text-[11.5px] text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" /> Not available
        </span>
      </div>

      <div className="mt-space-3 border-t border-line pt-space-3">
        {!activeDay ? (
          <p className="text-[12.5px] text-ink-400">
            Choose a green date to see the times available.
          </p>
        ) : (
          <>
            <p className="mb-space-2 text-[12.5px] font-semibold text-ink-600">
              Available times on{" "}
              {parseDay(activeDay).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
            <div className="grid grid-cols-3 gap-space-2 sm:grid-cols-4">
              {times.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === value}
                  onClick={() => onChange(s)}
                  className={cn(
                    "rounded-md border px-space-2 py-space-2 text-[12.5px] font-semibold tabular-nums",
                    s.id === value
                      ? "border-success bg-success text-white"
                      : "border-line bg-card text-ink-600 hover:border-success/50 hover:bg-success-tint",
                  )}
                >
                  {clock12(s.time)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
