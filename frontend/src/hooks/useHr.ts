import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { staffJson, type AttendanceRecord } from "@/lib/hr";
import { toast } from "@/lib/toast";

/** Runs `load` once `enabled` (and again when `deps` change), deferred a tick so it isn't a synchronous
 * state update inside the effect body. */
function useLoad(enabled: boolean, load: () => void | Promise<void>, refreshKey = "") {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [enabled, load, refreshKey]);
}

function useSessionGuard() {
  const router = useRouter();
  return useCallback((unauthorized: boolean) => {
    if (unauthorized) router.push("/portal/login");
  }, [router]);
}

// ---------------------------------------------------------------- My Leave

export type LeaveRequest = {
  id: number; staff_id: number; staff_name: string | null; staff_role: string | null; leave_type: string;
  from_date: string; to_date: string; is_half_day: boolean; days: number; reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled"; decided_by: number | null; decided_at: string | null;
  decision_note: string | null; created_at: string;
  conflicts?: { role_total: number; role_off: number };
  balance?: LeaveBalance;
};
export type LeaveBalance = { year: number; allowance: number; used: number; pending: number; remaining: number };
export type LeaveForm = { leave_type: string; from_date: string; to_date: string; is_half_day: boolean; reason: string };

export function useMyLeave(canView: boolean) {
  const guard = useSessionGuard();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err, unauthorized } = await staffJson<{ balance: LeaveBalance; requests: LeaveRequest[]; leave_types: string[] }>("/api/portal/leave/mine");
    guard(unauthorized);
    if (err || !data) return setError(err);
    setError(null); setBalance(data.balance); setRequests(data.requests); setTypes(data.leave_types);
  }, [guard]);
  useLoad(canView, load);

  async function apply(form: LeaveForm): Promise<string | null> {
    const { data, error: err } = await staffJson<{ over_allowance: boolean }>("/api/portal/leave/mine", "POST", form);
    if (err) return err;
    toast.success("Leave requested", data?.over_allowance ? "This goes over your yearly allowance -- a Manager will decide." : "A Manager will review it.");
    await load();
    return null;
  }

  async function cancel(id: number) {
    const { error: err } = await staffJson(`/api/portal/leave/mine/${id}/cancel`, "POST");
    if (err) toast.error("Couldn't withdraw", err);
    else toast.success("Request withdrawn");
    await load();
  }

  return { balance, requests, types, error, apply, cancel };
}

// ---------------------------------------------------------------- Leave Requests (review)

export type LeaveSummary = { pending: number; approved: number; rejected: number; on_leave_today: number };

export function useLeaveRequests(canView: boolean, status: string) {
  const guard = useSessionGuard();
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [allowance, setAllowance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const { data, error: err, unauthorized } = await staffJson<{ requests: LeaveRequest[]; summary: LeaveSummary; annual_leave_days: number }>(`/api/portal/leave/requests${q}`);
    guard(unauthorized);
    if (err || !data) return setError(err);
    setError(null); setRequests(data.requests); setSummary(data.summary); setAllowance(data.annual_leave_days);
  }, [guard, status]);
  useLoad(canView, load);

  async function decide(id: number, action: "approve" | "reject", note: string): Promise<string | null> {
    const { error: err } = await staffJson(`/api/portal/leave/requests/${id}/${action}`, "POST", { note });
    if (err) {
      await load();
      return err;
    }
    toast.success(action === "approve" ? "Leave approved" : "Leave declined");
    await load();
    return null;
  }

  async function saveAllowance(days: number): Promise<string | null> {
    const { error: err } = await staffJson("/api/portal/leave/policy", "POST", { annual_leave_days: days });
    if (err) return err;
    toast.success("Yearly allowance updated");
    await load();
    return null;
  }

  return { requests, summary, allowance, error, decide, saveAllowance };
}

// ---------------------------------------------------------------- Clock in / out

export type ClockToday = {
  now: string; work_date: string; timezone: string; state: "not_in" | "in" | "on_break" | "out";
  record: AttendanceRecord | null; shift: { start: string | null; end: string | null; source: string };
  location_required: boolean; grace_minutes: number; on_leave: boolean;
};

/** Best-effort browser location for the clock-in check; resolves to null if refused or unavailable. */
function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export function useClock(canView: boolean) {
  const guard = useSessionGuard();
  const [today, setToday] = useState<ClockToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err, unauthorized } = await staffJson<ClockToday>("/api/portal/attendance/today");
    guard(unauthorized);
    if (err || !data) return setError(err);
    setToday(data);
  }, [guard]);
  useLoad(canView, load);

  async function act(path: string, body?: unknown, success?: string) {
    setBusy(true);
    setError(null);
    const { error: err } = await staffJson(path, "POST", body ?? {});
    setBusy(false);
    if (err) setError(err);
    else if (success) toast.success(success);
    await load();
  }

  async function checkIn() {
    setBusy(true);
    const pos = today?.location_required ? await currentPosition() : null;
    setBusy(false);
    await act("/api/portal/attendance/check-in", pos ?? {}, "Clocked in");
  }

  return {
    today, error, busy, reload: load, checkIn,
    checkOut: () => act("/api/portal/attendance/check-out", {}, "Clocked out"),
    breakStart: () => act("/api/portal/attendance/break/start", {}, "Break started"),
    breakEnd: () => act("/api/portal/attendance/break/end", {}, "Break ended"),
  };
}

// ---------------------------------------------------------------- My attendance

export type MyMonthStats = {
  present_days: number; late_days: number; absent_days: number; leave_days: number;
  working_minutes: number; overtime_minutes: number; missing_clock_outs: number;
};
/** One day on MY OWN month view -- a leaner row than AttendanceRecord (team view's), since a Leave/Absent
 * day has no underlying attendance row at all: `status` is day_state()'s classifier (on_time/late/
 * missing_clock_out/on_leave/absent/not_in -- never off/upcoming, those days aren't included). */
export type MyMonthRow = {
  work_date: string; status: string;
  check_in_local: string | null; check_out_local: string | null;
  break_minutes: number; working_minutes: number; overtime_minutes: number;
};

/** `refreshKey` changes when something the list depends on changed (e.g. the person just clocked out), reloading it. */
export function useMyMonthlyAttendance(canView: boolean, month: string, refreshKey = "") {
  const guard = useSessionGuard();
  const [records, setRecords] = useState<MyMonthRow[] | null>(null);
  const [stats, setStats] = useState<MyMonthStats | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<{ label: string; pct: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: err, unauthorized } = await staffJson<{ records: MyMonthRow[]; stats: MyMonthStats; weekly_trend: { label: string; pct: number }[] }>(`/api/portal/attendance/my-summary?month=${month}`);
    guard(unauthorized);
    if (err || !data) return setError(err);
    setError(null); setRecords(data.records); setStats(data.stats); setWeeklyTrend(data.weekly_trend);
  }, [guard, month]);
  useLoad(canView, load, refreshKey);
  return { records, stats, weeklyTrend, error };
}

// ---------------------------------------------------------------- Team attendance (Owner / Manager)

export type OverviewRow = {
  staff_id: number; name: string; role: string; employee_id: string | null; state: string;
  shift_start: string | null; shift_end: string | null; record: AttendanceRecord | null;
};
export type SummaryRow = {
  staff_id: number; name: string; role: string; employee_id: string | null; present_days: number; late_days: number;
  absent_days: number; leave_days: number; working_minutes: number; overtime_minutes: number; missing_clock_outs: number;
};

export function useTeamAttendance(canView: boolean, date: string, month: string) {
  const guard = useSessionGuard();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [day, mon] = await Promise.all([
      staffJson<{ rows: OverviewRow[]; counts: Record<string, number> }>(`/api/portal/attendance/overview?date=${date}`),
      staffJson<{ rows: SummaryRow[] }>(`/api/portal/attendance/summary?month=${month}`),
    ]);
    guard(day.unauthorized);
    setError(day.error || mon.error);
    if (day.data) { setRows(day.data.rows); setCounts(day.data.counts); }
    if (mon.data) setSummary(mon.data.rows);
  }, [guard, date, month]);
  useLoad(canView, load);

  async function correct(recordId: number, time: string, note: string): Promise<string | null> {
    const { error: err } = await staffJson(`/api/portal/attendance/${recordId}/correct`, "POST", { check_out_time: time, note });
    if (err) return err;
    toast.success("Clock-out corrected", "They've been notified.");
    await load();
    return null;
  }

  return { rows, counts, summary, error, correct };
}

// ---------------------------------------------------------------- Attendance settings

export type AttendanceSettings = {
  shift_start: string | null; shift_end: string | null; late_grace_minutes: number;
  latitude: number | null; longitude: number | null; radius_meters: number | null; allowed_ips: string[];
};

export function useAttendanceSettings(canView: boolean) {
  const guard = useSessionGuard();
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: err, unauthorized } = await staffJson<AttendanceSettings>("/api/portal/attendance/settings");
    guard(unauthorized);
    if (err || !data) return setError(err);
    setError(null); setSettings(data);
  }, [guard]);
  useLoad(canView, load);

  async function save(next: AttendanceSettings): Promise<string | null> {
    const { data, error: err } = await staffJson<AttendanceSettings>("/api/portal/attendance/settings", "POST", next);
    if (err) return err;
    if (data) setSettings(data);
    toast.success("Attendance settings saved");
    return null;
  }

  return { settings, error, save };
}
