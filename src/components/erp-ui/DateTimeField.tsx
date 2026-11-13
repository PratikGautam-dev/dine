"use client";

import { Input } from "@/components/erp-ui/Input";

/** ISO instant -> the value a datetime-local input wants (local time). */
export const isoToLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export const localInputToIso = (v: string) =>
  v ? new Date(v).toISOString() : null;

/** A date and a time on one line, under one label. `value` is "YYYY-MM-DDTHH:mm" (what a datetime-local input uses), "" when unset;
 * picking a date fills in `defaultTime` when no time was chosen yet. */
export function DateTimeField({
  label,
  id,
  value,
  onChange,
  defaultTime = "00:00",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  defaultTime?: string;
}) {
  const [date = "", time = ""] = value.split("T");
  const change = (d: string, t: string) =>
    onChange(d ? `${d}T${t || defaultTime}` : "");
  return (
    <div>
      <label htmlFor={id} className="text-label mb-space-1 block">
        {label}
      </label>
      {/* on a phone the date gets the larger share and the time wraps under it only if the two really don't fit */}
      <div className="flex gap-space-2 max-md:flex-wrap">
        <Input
          id={id}
          type="date"
          className="min-w-[7.25rem] flex-[3] max-md:!px-space-2 max-md:text-[13px] md:flex-1"
          value={date}
          onChange={(e) => change(e.target.value, time)}
        />
        <Input
          type="time"
          className="min-w-[5.5rem] flex-[2] max-md:!px-space-2 max-md:text-[13px] md:flex-1"
          aria-label={`${label} (time)`}
          value={time}
          onChange={(e) => change(date, e.target.value)}
        />
      </div>
    </div>
  );
}
