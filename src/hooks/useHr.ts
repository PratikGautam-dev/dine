import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { proveDevice, type DeviceProof } from "@/lib/deviceKey";
import { staffJson, type AttendanceRecord } from "@/lib/hr";
import { queryKeys } from "@/lib/erp/queryKeys";
import { toast } from "@/lib/toast";

/** A failed write: the readable message plus the server's error object (`reason`, `can_request_manual` ...). */
export class HrError extends Error {
  details: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details ?? {};
  }
  get reason(): string | undefined {
    return typeof this.details.reason === "string"
      ? this.details.reason
      : undefined;
  }
}

/** A GET for a query's queryFn: the data, or throws with a readable message (and goes to sign-in if the session has ended). */
async function hrGet<T>(path: string): Promise<T> {
  const { data, error, unauthorized } = await staffJson<T>(path);
  if (unauthorized) {
    // Hard navigation on purpose: it discards all in-memory state of a session that no longer exists.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/portal/login";
  }
  if (error !== null || data === null) throw new Error(error ?? "No data.");
  return data;
}

/** A write for a mutation's mutationFn: the response, or throws an HrError. */
async function hrSend<T = unknown>(
  path: string,
  body?: unknown,
  method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
): Promise<T | null> {
  const { data, error, details } = await staffJson<T>(path, method, body);
  if (error !== null) throw new HrError(error, details);
  return data;
}

/** The message of a failed query, or null. */
const messageOf = (error: Error | null) => error?.message ?? null;

const ATTENDANCE = "/api/v1/attendance";
const LEAVE = "/api/v1/leave";

// ---------------------------------------------------------------- My Leave

export type LeaveRequest = {
  id: string;
  staff_id: string;
  staff_name: string | null;
  staff_role: string | null;
  employee_id?: string | null;
  branch_name?: string | null;
  leave_type: string;
  from_date: string;
  to_date: string;
  is_half_day: boolean;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_by: string | null;
  decided_by_name?: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  conflicts?: { branch_total: number; branch_off: number };
  balance?: LeaveBalance;
};
export type LeaveBalance = {
  year: number;
  allowance: number;
  used: number;
  pending: number;
  remaining: number;
};
export type LeaveForm = {
  leave_type: string;
  from_date: string;
  to_date: string;
  is_half_day: boolean;
  reason: string;
};

export function useMyLeave(canView: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrLeaveMine,
    queryFn: () =>
      hrGet<{
        balance: LeaveBalance;
        requests: LeaveRequest[];
        leave_types: string[];
      }>(`${LEAVE}/mine`),
    enabled: canView,
  });
  // Leave changes how days read on every attendance screen and the calendar too.
  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.hrLeave }),
      qc.invalidateQueries({ queryKey: queryKeys.hrAttendance }),
    ]);
  const applyMutation = useMutation({
    mutationFn: (form: LeaveForm) =>
      hrSend<{ over_allowance: boolean; request: LeaveRequest }>(
        `${LEAVE}/mine`,
        form,
      ),
    onSuccess: reload,
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => hrSend(`${LEAVE}/mine/${id}/cancel`),
    onSettled: reload,
  });

  async function apply(form: LeaveForm): Promise<string | null> {
    try {
      const data = await applyMutation.mutateAsync(form);
      const approved = data?.request.status === "approved";
      toast.success(
        approved ? "Leave added" : "Leave requested",
        approved
          ? "It's approved."
          : data?.over_allowance
            ? "This goes over your yearly allowance -- a Manager will decide."
            : "A Manager will review it.",
      );
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function cancel(id: string) {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success("Request withdrawn");
    } catch (e) {
      toast.error("Couldn't withdraw", (e as Error).message);
    }
  }

  return {
    balance: query.data?.balance ?? null,
    requests: query.data?.requests ?? null,
    types: query.data?.leave_types ?? [],
    error: messageOf(query.error),
    apply,
    cancel,
  };
}

// ---------------------------------------------------------------- Leave Requests (review)

export type LeaveSummary = {
  pending: number;
  approved: number;
  rejected: number;
  on_leave_today: number;
};

export function useLeaveRequests(canView: boolean, status: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrLeaveRequests(status),
    queryFn: () =>
      hrGet<{
        requests: LeaveRequest[];
        summary: LeaveSummary;
        annual_leave_days: number;
      }>(
        `${LEAVE}/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      ),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.hrLeave }),
      qc.invalidateQueries({ queryKey: queryKeys.hrAttendance }),
    ]);
  const decideMutation = useMutation({
    mutationFn: (input: {
      id: string;
      action: "approve" | "reject";
      note: string;
    }) =>
      hrSend(`${LEAVE}/requests/${input.id}/${input.action}`, {
        note: input.note,
      }),
    onSettled: reload, // a refused decision also reloads: the request may have changed under the reviewer
  });
  async function decide(
    id: string,
    action: "approve" | "reject",
    note: string,
  ): Promise<string | null> {
    try {
      await decideMutation.mutateAsync({ id, action, note });
    } catch (e) {
      return (e as Error).message;
    }
    toast.success(action === "approve" ? "Leave approved" : "Leave declined");
    return null;
  }

  return {
    requests: query.data?.requests ?? null,
    summary: query.data?.summary ?? null,
    error: messageOf(query.error),
    decide,
  };
}

/** The business's yearly leave allowance (Settings > Attendance); changing it needs leave:approve for every branch. */
export function useLeaveAllowance(enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: [...queryKeys.hrLeave, "policy"],
    queryFn: () => hrGet<{ annual_leave_days: number }>(`${LEAVE}/policy`),
    enabled,
  });
  async function save(days: number): Promise<string | null> {
    try {
      await hrSend(`${LEAVE}/policy`, { annual_leave_days: days }, "PATCH");
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Yearly allowance updated");
    await qc.invalidateQueries({ queryKey: queryKeys.hrLeave });
    return null;
  }
  return {
    allowance: query.data?.annual_leave_days ?? null,
    error: messageOf(query.error),
    save,
  };
}

// ---------------------------------------------------------------- Holidays and my calendar

export type Holiday = {
  id: string;
  date: string;
  name: string;
  branch_id: string | null;
  branch_name: string | null;
};
export type LeaveCalendar = {
  year: number;
  branch_name: string;
  weekly_off: number[];
  holidays: Holiday[];
  leave: {
    id: string;
    from_date: string;
    to_date: string;
    leave_type: string;
    is_half_day: boolean;
    status: "pending" | "approved";
    days: number;
  }[];
};

export function useLeaveCalendar(enabled: boolean, year: number) {
  const query = useQuery({
    queryKey: queryKeys.hrCalendar(year),
    queryFn: () => hrGet<LeaveCalendar>(`${LEAVE}/calendar?year=${year}`),
    enabled,
    placeholderData: keepPreviousData,
  });
  return { calendar: query.data ?? null, error: messageOf(query.error) };
}

export function useHolidays(enabled: boolean, year: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrHolidays(year),
    queryFn: () => hrGet<Holiday[]>(`${ATTENDANCE}/holidays?year=${year}`),
    enabled,
    placeholderData: keepPreviousData,
  });
  // A holiday changes the calendar, leave day counts and how every attendance day reads.
  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.hrAttendance }),
      qc.invalidateQueries({ queryKey: queryKeys.hrLeave }),
    ]);
  const save = useMutation({
    mutationFn: (input: {
      id?: string;
      date: string;
      name: string;
      branch_id: string | null;
    }) =>
      input.id
        ? hrSend(
            `${ATTENDANCE}/holidays/${input.id}`,
            { date: input.date, name: input.name },
            "PATCH",
          )
        : hrSend(`${ATTENDANCE}/holidays`, {
            date: input.date,
            name: input.name,
            branch_id: input.branch_id,
          }),
    onSettled: reload,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      hrSend(`${ATTENDANCE}/holidays/${id}`, undefined, "DELETE"),
    onSettled: reload,
  });
  const copy = useMutation({
    mutationFn: (input: { from: number; to: number }) =>
      hrSend<{ copied: number }>(
        `${ATTENDANCE}/holidays/copy?from_year=${input.from}&to_year=${input.to}`,
      ),
    onSettled: reload,
  });

  async function run<T>(fn: () => Promise<T>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return {
    holidays: query.data ?? null,
    error: messageOf(query.error),
    save: (h: {
      id?: string;
      date: string;
      name: string;
      branch_id: string | null;
    }) =>
      run(
        () => save.mutateAsync(h),
        h.id ? "Holiday updated" : "Holiday added",
      ),
    remove: (id: string) =>
      run(() => remove.mutateAsync(id), "Holiday removed"),
    copyYear: async (from: number, to: number) => {
      try {
        const r = await copy.mutateAsync({ from, to });
        toast.success(
          r?.copied
            ? `${r.copied} holiday${r.copied === 1 ? "" : "s"} copied to ${to}`
            : `Nothing new to copy into ${to}`,
          r?.copied ? "Check the dates of festivals that move each year." : "",
        );
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
  };
}

// ---------------------------------------------------------------- Clock in / out

export type CheckinRequest = {
  id: string;
  /** clock_in = today's, asked when the shop's check failed; past_day = a missed day, with both times */
  kind: "clock_in" | "past_day";
  staff_id: string;
  staff_name: string | null;
  employee_id: string | null;
  branch_id: string;
  branch_name: string | null;
  work_date: string;
  requested_at: string;
  requested_local: string | null;
  check_out_local: string | null;
  created_at: string;
  reason: string;
  failure_code: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type ClockToday = {
  now: string;
  work_date: string;
  timezone: string;
  state: "not_in" | "in" | "on_break" | "out";
  record: AttendanceRecord | null;
  shift: {
    start: string | null;
    end: string | null;
    source: string;
    working_day: boolean;
    scheduled_minutes: number | null;
  };
  earliest_clock_in: string | null;
  location_required: boolean;
  grace_minutes: number;
  on_leave: boolean;
  half_day_leave: boolean;
  holiday: { name: string } | null;
  pending_request: CheckinRequest | null;
  branches: { id: string; name: string; verify_mode: string }[];
  home_branch_id: string;
  /** The business locks attendance to one device per person; `registered` is mine, or null until my first clock-in. */
  device: { locked: boolean; registered: RegisteredDevice | null };
};

export type RegisteredDevice = {
  label: string | null;
  registered_at: string;
  last_used_at: string | null;
};

/** What a problem's "Try again" repeats. */
export type ClockAction = "check_in" | "check_out";

/** Why a clock-in failed, when the page should offer more than the message (e.g. asking a manager to approve). */
export type ClockProblem = {
  message: string;
  reason?: string;
  canRequest: boolean;
  retry: ClockAction;
};

type Position = { latitude: number; longitude: number; accuracy: number };
type PositionResult =
  | { ok: true; position: Position }
  | { ok: false; reason: "denied" | "timeout" | "unavailable" | "unsupported" };

/** The best browser location reading within a few seconds. The wait only starts once location access is allowed, so a person
 * reading the permission prompt is never timed out; it stops early once a reading is precise enough. */
export async function bestPosition(): Promise<PositionResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return { ok: false, reason: "unsupported" };
  try {
    const status = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    if (status?.state === "denied") return { ok: false, reason: "denied" };
  } catch {
    // Permissions API missing (older Safari): fall through to the prompt.
  }
  return new Promise((resolve) => {
    let best: Position | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (r: PositionResult) => {
      if (timer) clearTimeout(timer);
      navigator.geolocation.clearWatch(watch);
      resolve(r);
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || p.accuracy < best.accuracy) best = p;
        // first reading = access was granted: give it up to 6 more seconds to sharpen
        timer ??= setTimeout(() => finish({ ok: true, position: best! }), 6000);
        if (p.accuracy <= 30) finish({ ok: true, position: p });
      },
      (err) =>
        finish(
          best
            ? { ok: true, position: best }
            : {
                ok: false,
                reason:
                  err.code === err.PERMISSION_DENIED
                    ? "denied"
                    : err.code === err.TIMEOUT
                      ? "timeout"
                      : "unavailable",
              },
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

export const LOCATION_HINT: Record<string, string> = {
  denied:
    "Location access is blocked for this site. Allow it in your browser's site settings and try again.",
  timeout: "Your location took too long to find. Try again near a window.",
  unavailable:
    "Your device couldn't find its location. Turn on location and try again.",
  unsupported:
    "This browser can't share its location. Use your phone's browser.",
};

/** A signed challenge for the device lock, or undefined when the business doesn't lock devices (or the browser can't sign: the server
 * then refuses with a clear message). */
async function deviceProof(
  today: ClockToday | null,
  userId: string | undefined,
): Promise<DeviceProof | undefined> {
  if (!today?.device.locked || !userId) return undefined;
  const r = await hrSend<{ challenge: string }>(
    `${ATTENDANCE}/device/challenge`,
  );
  if (!r) return undefined;
  return (await proveDevice(userId, r.challenge)) ?? undefined;
}

export function useClock(canView: boolean, userId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrClockToday,
    queryFn: () => hrGet<ClockToday>(`${ATTENDANCE}/today`),
    enabled: canView,
  });
  const [problem, setProblem] = useState<ClockProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [lastLocation, setLastLocation] = useState<
    Partial<Position> & { location_error?: string }
  >({});
  const today = query.data ?? null;
  const step = useMutation({
    mutationFn: (input: { path: string; body: unknown }) =>
      hrSend(input.path, input.body),
  });

  /** One action: the buttons stay disabled until the server answered AND today's state has been reloaded, so a second tap can never
   * land on a stale button. An "already done" answer just refreshes. */
  async function act(
    path: string,
    body: Record<string, unknown>,
    success: string,
    retry: ClockAction = "check_in",
    signed = false,
  ) {
    setBusy(true);
    setProblem(null);
    try {
      const device = signed ? await deviceProof(today, userId) : undefined;
      await step.mutateAsync({
        path,
        body: device ? { ...body, device } : body,
      });
      toast.success(success);
    } catch (e) {
      const err = e as HrError;
      const reason = err.reason;
      if (!reason?.startsWith("already_") && reason !== "not_clocked_in")
        setProblem({
          message: err.message,
          reason,
          canRequest: err.details.can_request_manual === true,
          retry,
        });
    } finally {
      await qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
      setBusy(false);
    }
  }

  async function locate(): Promise<
    Partial<Position> & { location_error?: string }
  > {
    if (!today?.location_required) return {};
    setLocating(true);
    const r = await bestPosition();
    setLocating(false);
    const where = r.ok ? r.position : { location_error: r.reason };
    setLastLocation(where);
    return where;
  }

  async function checkIn() {
    setBusy(true);
    setProblem(null);
    const where = await locate();
    if ("location_error" in where && where.location_error) {
      setProblem({
        message: LOCATION_HINT[where.location_error] ?? "No location.",
        reason: "location_unavailable",
        canRequest: true,
        retry: "check_in",
      });
      setBusy(false);
      return;
    }
    await act(`${ATTENDANCE}/check-in`, where, "Clocked in", "check_in", true);
  }

  async function requestApproval(reason: string): Promise<string | null> {
    try {
      const device = await deviceProof(today, userId).catch(() => undefined);
      await hrSend(`${ATTENDANCE}/check-in/request`, {
        reason,
        failure_code: problem?.reason ?? null,
        ...lastLocation,
        ...(device ? { device } : {}),
      });
      setProblem(null);
      toast.success("Request sent", "Your manager will approve it.");
      return null;
    } catch (e) {
      return (e as Error).message;
    } finally {
      await qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
    }
  }

  return {
    today,
    error: messageOf(query.error),
    problem,
    dismissProblem: () => setProblem(null),
    busy,
    locating,
    reload: () => void query.refetch(),
    checkIn,
    checkOut: async () => {
      // never blocked for location: record it only when it is quick to get
      await act(
        `${ATTENDANCE}/check-out`,
        {},
        "Clocked out",
        "check_out",
        true,
      );
    },
    breakStart: () => act(`${ATTENDANCE}/break/start`, {}, "Break started"),
    breakEnd: () => act(`${ATTENDANCE}/break/end`, {}, "Break ended"),
    requestApproval,
  };
}

// ---------------------------------------------------------------- My attendance

export type MyMonthStats = {
  present_days: number;
  late_days: number;
  absent_days: number;
  leave_days: number;
  working_minutes: number;
  overtime_minutes: number;
  missing_clock_outs: number;
};
/** One day on a month view -- a leaner row than AttendanceRecord, since a Leave/Absent/Holiday day has no record at all. `status` is
 * the server's day_state(): on_time / late / clocked_in / missing_clock_out / on_leave / holiday / absent / not_in (never off or
 * upcoming, those days aren't included). */
export type MyMonthRow = {
  work_date: string;
  status: string;
  record_id: string | null;
  check_in_local: string | null;
  check_out_local: string | null;
  break_minutes: number;
  working_minutes: number;
  overtime_minutes: number;
  holiday_name: string | null;
  leave_type: string | null;
  half_day_leave: boolean;
  corrected: boolean;
};
type MonthBody = {
  records: MyMonthRow[];
  stats: MyMonthStats;
  weekly_trend: { label: string; pct: number }[];
};

export function useMyMonthlyAttendance(canView: boolean, month: string | null) {
  const query = useQuery({
    queryKey: queryKeys.hrMyMonth(month ?? ""),
    queryFn: () =>
      hrGet<MonthBody & { first_month: string }>(
        `${ATTENDANCE}/my-summary?month=${month}`,
      ),
    enabled: canView && Boolean(month),
    placeholderData: keepPreviousData,
  });
  return {
    records: query.data?.records ?? null,
    stats: query.data?.stats ?? null,
    weeklyTrend: query.data?.weekly_trend ?? [],
    firstMonth: query.data?.first_month ?? null,
    error: messageOf(query.error),
  };
}

export function useStaffMonth(
  enabled: boolean,
  userId: string | null,
  month: string,
) {
  const query = useQuery({
    queryKey: queryKeys.hrStaffMonth(userId ?? "", month),
    queryFn: () =>
      hrGet<
        MonthBody & { staff: { id: string; name: string; branch_name: string } }
      >(`${ATTENDANCE}/staff/${userId}?month=${month}`),
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
  });
  return { month: query.data ?? null, error: messageOf(query.error) };
}

// ---------------------------------------------------------------- Team attendance (Owner / Manager)

export type OverviewRow = {
  staff_id: string;
  name: string;
  role: string;
  employee_id: string | null;
  branch_id: string;
  branch_name: string;
  state: string;
  shift_start: string | null;
  shift_end: string | null;
  holiday_name: string | null;
  leave_type: string | null;
  record: AttendanceRecord | null;
};
export type SummaryRow = {
  staff_id: string;
  name: string;
  role: string;
  employee_id: string | null;
  branch_name: string;
  present_days: number;
  late_days: number;
  absent_days: number;
  leave_days: number;
  working_minutes: number;
  overtime_minutes: number;
  missing_clock_outs: number;
};

export function useTeamAttendance(
  canView: boolean,
  date: string,
  month: string,
  branchId: string,
) {
  const qc = useQueryClient();
  const branch = branchId ? `&branch_id=${branchId}` : "";
  const day = useQuery({
    queryKey: queryKeys.hrTeamDay(date, branchId),
    queryFn: () =>
      hrGet<{ rows: OverviewRow[]; counts: Record<string, number> }>(
        `${ATTENDANCE}/overview?date=${date}${branch}`,
      ),
    enabled: canView && Boolean(date),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: queryKeys.hrTeamMonth(month, branchId),
    queryFn: () =>
      hrGet<{ rows: SummaryRow[] }>(
        `${ATTENDANCE}/summary?month=${month}${branch}`,
      ),
    enabled: canView && Boolean(month),
    placeholderData: keepPreviousData,
  });
  const reload = () =>
    qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
  const correction = useMutation({
    mutationFn: (input: {
      recordId: string;
      checkIn: string | null;
      checkOut: string | null;
      note: string;
    }) =>
      hrSend(`${ATTENDANCE}/records/${input.recordId}/correct`, {
        ...(input.checkIn ? { check_in_time: input.checkIn } : {}),
        ...(input.checkOut ? { check_out_time: input.checkOut } : {}),
        note: input.note,
      }),
    onSuccess: reload,
  });
  const addition = useMutation({
    mutationFn: (input: {
      userId: string;
      workDate: string;
      checkIn: string;
      checkOut: string | null;
      note: string;
    }) =>
      hrSend(`${ATTENDANCE}/records`, {
        user_id: input.userId,
        work_date: input.workDate,
        check_in_time: input.checkIn,
        ...(input.checkOut ? { check_out_time: input.checkOut } : {}),
        note: input.note,
      }),
    onSuccess: reload,
  });

  async function correct(
    recordId: string,
    checkIn: string | null,
    checkOut: string | null,
    note: string,
  ): Promise<string | null> {
    try {
      await correction.mutateAsync({ recordId, checkIn, checkOut, note });
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Attendance corrected", "The change is in the activity log.");
    return null;
  }

  async function addDay(
    userId: string,
    workDate: string,
    checkIn: string,
    checkOut: string | null,
    note: string,
  ): Promise<string | null> {
    try {
      await addition.mutateAsync({ userId, workDate, checkIn, checkOut, note });
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Marked present");
    return null;
  }

  return {
    rows: day.data?.rows ?? null,
    counts: day.data?.counts ?? {},
    summary: summary.data?.rows ?? null,
    error: messageOf(day.error) || messageOf(summary.error),
    correct,
    addDay,
  };
}

export function useCheckinRequests(canView: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrCheckinRequests,
    queryFn: () =>
      hrGet<{ requests: CheckinRequest[] }>(
        `${ATTENDANCE}/requests?status=pending`,
      ),
    enabled: canView,
    refetchInterval: 60_000, // a person is waiting at the door: keep the queue fresh while the page is open
  });
  const decideMutation = useMutation({
    mutationFn: (input: { id: string; approve: boolean; note: string }) =>
      hrSend(
        `${ATTENDANCE}/requests/${input.id}/${input.approve ? "approve" : "reject"}`,
        { note: input.note || null },
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.hrAttendance }),
  });

  async function decide(
    id: string,
    approve: boolean,
    note = "",
  ): Promise<string | null> {
    try {
      await decideMutation.mutateAsync({ id, approve, note });
    } catch (e) {
      return (e as Error).message;
    }
    toast.success(approve ? "Approved" : "Request declined");
    return null;
  }

  return {
    requests: query.data?.requests ?? null,
    error: messageOf(query.error),
    decide,
  };
}

/** What I asked my manager for (clock-ins and missed days, last 60 days), and asking for a missed day. */
export function useMyRequests(canView: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrMyRequests,
    queryFn: () =>
      hrGet<{ requests: CheckinRequest[] }>(`${ATTENDANCE}/my-requests`),
    enabled: canView,
  });
  async function askPastDay(input: {
    work_date: string;
    check_in_time: string;
    check_out_time: string;
    reason: string;
  }): Promise<string | null> {
    try {
      await hrSend(`${ATTENDANCE}/requests/past-day`, input);
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Request sent", "Your manager will approve it.");
    await qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
    return null;
  }
  return {
    requests: query.data?.requests ?? null,
    error: messageOf(query.error),
    askPastDay,
  };
}

/** A person's registered attendance device, and a manager's reset (lost or new phone). */
export function usePersonDevice(userId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrPersonDevice(userId),
    queryFn: () =>
      hrGet<{ locked: boolean; device: RegisteredDevice | null }>(
        `${ATTENDANCE}/people/${userId}/device`,
      ),
  });
  async function reset(): Promise<string | null> {
    try {
      await hrSend(
        `${ATTENDANCE}/people/${userId}/device`,
        undefined,
        "DELETE",
      );
    } catch (e) {
      return (e as Error).message;
    }
    toast.success(
      "Device reset",
      "Their next clock-in registers the device they use.",
    );
    await qc.invalidateQueries({ queryKey: queryKeys.hrPersonDevice(userId) });
    return null;
  }
  return { data: query.data ?? null, error: messageOf(query.error), reset };
}

// ---------------------------------------------------------------- Attendance rules

export type AttendanceDefaults = {
  shift_start: string | null;
  shift_end: string | null;
  weekly_off: number[];
  late_grace_minutes: number;
  early_clock_in_minutes: number | null;
  auto_close_after_minutes: number | null;
  max_gps_accuracy_m: number;
  device_lock: boolean;
};
export type VerifyMode = "off" | "location" | "network" | "either" | "both";
export type BranchRule = {
  branch_id: string;
  branch_name: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  /** How the position was set: 'device' (measured at the shop) and 'manual' (typed) are exact; 'pincode' is only the area's centre. */
  location_source: "pincode" | "device" | "manual" | null;
  verify_mode: VerifyMode;
  radius_meters: number | null;
  allowed_ips: string[];
  shift_start: string | null;
  shift_end: string | null;
  weekly_off: number[] | null;
};
export type AttendanceSettings = {
  defaults: AttendanceDefaults;
  branches: BranchRule[];
  detected_ip: string | null;
  can_edit_defaults: boolean;
};

/** The shop's exact spot: measured by this device at the shop, or typed in / read from a map link. */
export type ShopLocation = {
  latitude: number;
  longitude: number;
  source: "device" | "manual";
  accuracy_m?: number;
};

export function useAttendanceSettings(canView: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrAttendanceSettings,
    queryFn: () => hrGet<AttendanceSettings>(`${ATTENDANCE}/settings`),
    enabled: canView,
  });
  // The shift and check rules decide what "late" and "in range" mean on every attendance screen.
  const reload = () =>
    qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
  const defaultsMutation = useMutation({
    mutationFn: (patch: Partial<AttendanceDefaults>) =>
      hrSend<AttendanceDefaults>(`${ATTENDANCE}/settings`, patch, "PATCH"),
    onSuccess: reload,
  });
  const branchMutation = useMutation({
    mutationFn: (input: { branchId: string; patch: Partial<BranchRule> }) =>
      hrSend<BranchRule>(
        `${ATTENDANCE}/branches/${input.branchId}/rules`,
        input.patch,
        "PATCH",
      ),
    onSuccess: reload,
  });

  const locationMutation = useMutation({
    mutationFn: (input: { branchId: string; location: ShopLocation }) =>
      hrSend<BranchRule>(
        `${ATTENDANCE}/branches/${input.branchId}/location`,
        input.location,
        "PUT",
      ),
    // the same spot ranks branches for online orders and shows on the branch page
    onSuccess: () =>
      Promise.all([
        reload(),
        qc.invalidateQueries({ queryKey: queryKeys.branches }),
      ]),
  });

  async function saveLocation(
    branchId: string,
    location: ShopLocation,
  ): Promise<string | null> {
    try {
      await locationMutation.mutateAsync({ branchId, location });
    } catch (e) {
      return (e as Error).message;
    }
    return null;
  }

  async function saveDefaults(
    patch: Partial<AttendanceDefaults>,
  ): Promise<string | null> {
    try {
      await defaultsMutation.mutateAsync(patch);
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Attendance rules saved");
    return null;
  }

  async function saveBranch(
    branchId: string,
    patch: Partial<BranchRule>,
  ): Promise<string | null> {
    try {
      await branchMutation.mutateAsync({ branchId, patch });
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Branch rules saved");
    return null;
  }

  return {
    settings: query.data ?? null,
    error: messageOf(query.error),
    saveDefaults,
    saveBranch,
    saveLocation,
  };
}

// ---------------------------------------------------------------- A person's work pattern (Users page)

export type WorkPattern = {
  user_id: string;
  home_branch_id: string | null;
  shift_start: string | null;
  shift_end: string | null;
  weekly_off: number[] | null;
  tracks_attendance: boolean;
};

export function useWorkPattern(enabled: boolean, userId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.hrPattern(userId ?? ""),
    queryFn: () => hrGet<WorkPattern>(`${ATTENDANCE}/people/${userId}/pattern`),
    enabled: enabled && Boolean(userId),
  });
  const mutation = useMutation({
    mutationFn: (next: Omit<WorkPattern, "user_id">) =>
      hrSend<WorkPattern>(
        `${ATTENDANCE}/people/${userId}/pattern`,
        next,
        "PUT",
      ),
    onSuccess: (saved) => {
      if (saved) qc.setQueryData(queryKeys.hrPattern(userId ?? ""), saved);
      return qc.invalidateQueries({ queryKey: queryKeys.hrAttendance });
    },
  });

  async function save(
    next: Omit<WorkPattern, "user_id">,
  ): Promise<string | null> {
    try {
      await mutation.mutateAsync(next);
    } catch (e) {
      return (e as Error).message;
    }
    toast.success("Work pattern saved");
    return null;
  }

  return { pattern: query.data ?? null, error: messageOf(query.error), save };
}
