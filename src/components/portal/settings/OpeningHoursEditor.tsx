"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ScheduleEntry } from "@/hooks/useBranchBookingHours";

const DAYS: { key: string; label: string }[] = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
  { key: "Sat", label: "Saturday" },
  { key: "Sun", label: "Sunday" },
];

/** "13:30" -> "01:30 PM" */
function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The weekly opening-hours editor: the ranges added so far (or "No opening hours set yet."), a row to add one (day, opens, closes, Add)
 * and, unless `hideSave`, a "Save hours" button that stays disabled until something changed. */
export function OpeningHoursEditor({
  schedule,
  onAdd,
  onRemove,
  onSave,
  saving,
  dirty,
  disabled,
  hideSave,
  error,
}: {
  schedule: ScheduleEntry[];
  /** Returns a message when the range can't be added. */
  onAdd: (entry: ScheduleEntry) => string | null;
  onRemove: (entry: ScheduleEntry) => void;
  onSave?: () => void;
  saving?: boolean;
  dirty: boolean;
  disabled?: boolean;
  hideSave?: boolean;
  error?: string | null;
}) {
  const [day, setDay] = useState("Mon");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("18:00");
  const [problem, setProblem] = useState<string | null>(null);

  const ordered = [...schedule].sort(
    (a, b) =>
      DAYS.findIndex((d) => d.key === a.day) - DAYS.findIndex((d) => d.key === b.day) ||
      a.open.localeCompare(b.open),
  );

  return (
    <div>
      {ordered.length === 0 ? (
        <p className="mb-space-3 text-[13px] text-ink-400">No opening hours set yet.</p>
      ) : (
        <ul className="mb-space-3 divide-y divide-line rounded-md border border-line">
          {ordered.map((e) => (
            <li
              key={`${e.day}-${e.open}-${e.close}`}
              className="flex items-center justify-between gap-space-3 px-space-3 py-space-2 text-[13px]"
            >
              <span className="flex gap-space-4">
                <span className="w-24 font-medium text-ink-900">
                  {DAYS.find((d) => d.key === e.day)?.label}
                </span>
                <span className="text-ink-600">
                  {clock(e.open)} – {clock(e.close)}
                </span>
              </span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${e.day} ${clock(e.open)}`}
                  onClick={() => onRemove(e)}
                  className="rounded p-1 text-ink-400 hover:bg-paper hover:text-ink-900"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-center gap-space-2">
          <div className="w-40">
            <Select aria-label="Day" value={day} onValueChange={setDay}>
              {DAYS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Input
              aria-label="Opens at"
              type="time"
              value={open}
              onChange={(e) => setOpen(e.target.value)}
            />
          </div>
          <div className="w-36">
            <Input
              aria-label="Closes at"
              type="time"
              value={close}
              onChange={(e) => setClose(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setProblem(onAdd({ day, open, close }))}
          >
            Add
          </Button>
        </div>
      )}
      {(problem || error) && (
        <p className="mt-space-2 text-[12.5px] font-medium text-error">{problem ?? error}</p>
      )}

      {!hideSave && !disabled && (
        <Button type="button" className="mt-space-3" disabled={!dirty || saving} onClick={onSave}>
          {saving ? "Saving…" : "Save hours"}
        </Button>
      )}
    </div>
  );
}
