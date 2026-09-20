import { staffFetch } from "@/lib/staffAuth";

/** One JSON call to the portal API as the signed-in staff member. `error` is a readable message or null. */
export async function staffJson<T = unknown>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" = "GET",
  body?: unknown,
): Promise<{ data: T | null; error: string | null; unauthorized: boolean }> {
  const result = await staffFetch(path, {
    method,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!result.ok) return { data: null, error: result.unauthorized ? "Session expired -- please sign in again." : result.error, unauthorized: result.unauthorized };
  return { data: result.data as T, error: null, unauthorized: false };
}

/** 510 -> "8h 30m", 45 -> "45m", 0 -> "0m". */
export function fmtMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** "2026-09-21" -> "Mon 21 Sep". */
export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtDateRange(from: string, to: string): string {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  casual: "Casual", sick: "Sick", annual: "Annual", unpaid: "Unpaid", personal: "Personal",
};

export type Tone = "brand" | "clay" | "success" | "neutral";

export const LEAVE_STATUS_TONE: Record<string, Tone> = {
  pending: "clay", approved: "success", rejected: "neutral", cancelled: "neutral",
};

/** How one person's day reads on the team overview. */
export const DAY_STATE: Record<string, { label: string; tone: Tone }> = {
  on_time: { label: "On time", tone: "success" },
  late: { label: "Late", tone: "clay" },
  clocked_in: { label: "Clocked in", tone: "brand" },
  missing_clock_out: { label: "Missing clock-out", tone: "clay" },
  on_leave: { label: "On leave", tone: "brand" },
  absent: { label: "Absent", tone: "clay" },
  not_in: { label: "Not in yet", tone: "clay" },
  upcoming: { label: "Due later", tone: "neutral" },
  off: { label: "Off", tone: "neutral" },
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type AttendanceRecord = {
  id: number;
  work_date: string;
  status: "on_time" | "late";
  late_minutes: number;
  check_in_at: string;
  check_in_local: string;
  check_out_at: string | null;
  check_out_local: string | null;
  check_in_method: string;
  break_started_at: string | null;
  break_minutes: number;
  working_minutes: number;
  overtime_minutes: number;
  missing_clock_out: boolean;
  corrected: boolean;
  correction_note: string | null;
};
