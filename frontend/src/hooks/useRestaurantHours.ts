import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

// Same day-abbreviation set db/repositories/tables.py's own _WEEKDAY_ABBREVS
// and portal/routes/settings.py's _VALID_OPERATING_DAYS use.
export const OPERATING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type RestaurantHoursForm = {
  operating_days: string[];
  start_time: string; // "HH:MM", combined into a single "start-end" range on save
  end_time: string;
  default_turnover_minutes: string;
  booking_interval_minutes: string;
};

function emptyForm(): RestaurantHoursForm {
  return { operating_days: [], start_time: "", end_time: "", default_turnover_minutes: "90", booking_interval_minutes: "30" };
}

/** Minimal, functional-not-polished form backing update_restaurant_hours()
 * -- the gap this closes: get_available_table_slots() returns [] whenever
 * operating_days/operating_hours are unset, which was true for every
 * hospital except the two seeded dev/test ones (no portal UI existed to
 * set them). Only a SINGLE operating_hours range is supported here (the
 * repository function itself takes a list) -- enough to unblock a freshly
 * onboarded restaurant, not a full multi-shift editor. */
export function useRestaurantHours(ready: boolean) {
  const [form, setForm] = useState<RestaurantHoursForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/settings");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    const data = result.data as {
      operating_days: string[]; operating_hours: string[];
      default_turnover_minutes: number; booking_interval_minutes: number;
    };
    const [firstRange] = data.operating_hours || [];
    const [start_time, end_time] = firstRange ? firstRange.split("-") : ["", ""];
    setForm({
      operating_days: data.operating_days || [],
      start_time, end_time,
      default_turnover_minutes: String(data.default_turnover_minutes ?? 90),
      booking_interval_minutes: String(data.booking_interval_minutes ?? 30),
    });
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      operating_days: f.operating_days.includes(day)
        ? f.operating_days.filter((d) => d !== day)
        : [...f.operating_days, day],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const operating_hours = form.start_time && form.end_time ? [`${form.start_time}-${form.end_time}`] : [];
    const result = await portalFetch("/api/portal/settings/restaurant-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operating_days: form.operating_days,
        operating_hours,
        default_turnover_minutes: Number(form.default_turnover_minutes),
        booking_interval_minutes: Number(form.booking_interval_minutes),
      }),
    });
    setSaving(false);
    if (!result.ok) {
      if (result.unauthorized) {
        toast.error("Session expired", "Please log in again.");
      } else {
        setError(result.error);
        toast.error("Couldn't save table hours", result.error);
      }
      return;
    }
    toast.success("Table hours saved");
    await load();
  }

  return { form, setForm, toggleDay, error, saving, handleSave };
}
