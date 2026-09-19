import { cn } from "@/lib/cn";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { WEEKDAYS, WizardState } from "../types";
import type { WizardDispatch } from "../useWizardState";

type Props = { state: WizardState; dispatch: WizardDispatch };

const TURNOVER_OPTIONS = ["45", "60", "75", "90", "120", "150", "180"];
const INTERVAL_OPTIONS = ["15", "30", "60"];

/** Reservation hours: which days, one open/close range, how long a party
 * holds a table, and how often a new seating time starts. Feeds
 * update_restaurant_hours() -- with none of this, WhatsApp offers no seating
 * time at all. */
export function OperatingHoursCard({ state, dispatch }: Props) {
  return (
    <div className="mb-space-4 rounded-lg border border-line bg-card p-space-4 shadow-[var(--shadow-sm)]">
      <Field label="Days you take reservations">
        <div className="flex flex-wrap items-center gap-space-2">
          {WEEKDAYS.map((day) => {
            const on = state.operatingDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => dispatch({ type: "toggleOperatingDay", day })}
                className={cn(
                  "flex h-8 w-11 items-center justify-center rounded-md border text-[12.5px] font-semibold transition-colors duration-150",
                  on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600 hover:border-brand-300",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-x-space-4 md:grid-cols-2">
        <Field label="Opens at" htmlFor="open_time">
          <Input
            id="open_time"
            type="time"
            value={state.openTime}
            onChange={(e) => dispatch({ type: "set", field: "openTime", value: e.target.value })}
          />
        </Field>
        <Field label="Last seating ends by (closing time)" htmlFor="close_time">
          <Input
            id="close_time"
            type="time"
            value={state.closeTime}
            onChange={(e) => dispatch({ type: "set", field: "closeTime", value: e.target.value })}
          />
        </Field>
        <Field label="How long a party holds a table" htmlFor="turnover" hint="Minutes a table stays reserved once seated.">
          <select
            id="turnover"
            value={state.turnoverMinutes}
            onChange={(e) => dispatch({ type: "set", field: "turnoverMinutes", value: e.target.value })}
            className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
          >
            {TURNOVER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
        <Field label="A new seating time starts every" htmlFor="interval">
          <select
            id="interval"
            value={state.bookingIntervalMinutes}
            onChange={(e) => dispatch({ type: "set", field: "bookingIntervalMinutes", value: e.target.value })}
            className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
          >
            {INTERVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
