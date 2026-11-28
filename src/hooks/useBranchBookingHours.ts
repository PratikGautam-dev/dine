import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

/** One opening range of a branch's week: "Mon" 09:00 to 18:00 (24-hour "HH:MM"). A day may have several. */
export type ScheduleEntry = { day: string; open: string; close: string };

export type BranchHoursForm = {
  schedule: ScheduleEntry[];
  turnover_minutes: string;
  booking_interval_minutes: string;
};

type BranchHoursResponse = {
  branch_id: string;
  branch_name: string;
  schedule: ScheduleEntry[];
  turnover_minutes: number;
  booking_interval_minutes: number;
  /** Which of the values this branch sets itself; the rest are inherited from the restaurant-wide setting. */
  own: Record<string, boolean>;
};

const emptyForm = (): BranchHoursForm => ({
  schedule: [],
  turnover_minutes: "90",
  booking_interval_minutes: "30",
});

const sameSchedule = (a: ScheduleEntry[], b: ScheduleEntry[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/** A branch's weekly opening hours plus its table turnover and slot interval (GET/POST /api/portal/settings/booking-hours). Reloads
 * when `branchId` changes. `inherited` is true while the branch has never saved its own hours (the form then shows the restaurant-wide
 * ones it follows); `dirty` is true once the schedule or the two numbers differ from what was last loaded or saved. */
export function useBranchBookingHours(ready: boolean, branchId: string | null) {
  const [form, setFormState] = useState<BranchHoursForm>(emptyForm());
  const [saved, setSaved] = useState<BranchHoursForm>(emptyForm());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [inherited, setInherited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    const result = await portalFetch(
      `/api/portal/settings/booking-hours?branch_id=${encodeURIComponent(branchId)}`,
    );
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    const data = result.data as BranchHoursResponse;
    const next: BranchHoursForm = {
      schedule: data.schedule ?? [],
      turnover_minutes: String(data.turnover_minutes ?? 90),
      booking_interval_minutes: String(data.booking_interval_minutes ?? 30),
    };
    setError(null);
    setFormState(next);
    setSaved(next);
    setInherited(!Object.values(data.own).some(Boolean));
    setLoadedFor(branchId);
  }, [branchId]);

  useEffect(() => {
    // Loads the picked branch's hours from the server (the setState happens after the fetch resolves).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && branchId) load();
  }, [ready, branchId, load]);

  function setForm(patch: Partial<BranchHoursForm>) {
    setFormState((f) => ({ ...f, ...patch }));
  }

  /** Adds a range; returns a message when it can't (closes before it opens, or overlaps another range that day). */
  function addEntry(entry: ScheduleEntry): string | null {
    if (!entry.open || !entry.close) return "Choose an opening and a closing time.";
    if (entry.open >= entry.close) return "Opening time must be before closing time.";
    if (
      form.schedule.some((e) => e.day === entry.day && e.open < entry.close && entry.open < e.close)
    )
      return "That overlaps another opening time on the same day.";
    setFormState((f) => ({ ...f, schedule: [...f.schedule, entry] }));
    return null;
  }

  function removeEntry(entry: ScheduleEntry) {
    setFormState((f) => ({
      ...f,
      schedule: f.schedule.filter(
        (e) => !(e.day === entry.day && e.open === entry.open && e.close === entry.close),
      ),
    }));
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!branchId) return;
    setSaving(true);
    setError(null);
    const result = await portalFetch("/api/portal/settings/booking-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_id: branchId,
        schedule: form.schedule,
        turnover_minutes: Number(form.turnover_minutes),
        booking_interval_minutes: Number(form.booking_interval_minutes),
      }),
    });
    setSaving(false);
    if (!result.ok) {
      if (result.unauthorized) {
        toast.error("Session expired", "Please log in again.");
      } else {
        setError(result.error);
        toast.error("Couldn't save opening hours", result.error);
      }
      return;
    }
    toast.success("Opening hours saved");
    await load();
  }

  const dirty =
    !sameSchedule(form.schedule, saved.schedule) ||
    form.turnover_minutes !== saved.turnover_minutes ||
    form.booking_interval_minutes !== saved.booking_interval_minutes;
  // true once the form holds the branch picked now (not a previous one's values)
  const loaded = loadedFor !== null && loadedFor === branchId;
  return {
    form,
    setForm,
    addEntry,
    removeEntry,
    loaded,
    inherited,
    dirty,
    error,
    saving,
    handleSave,
  };
}
