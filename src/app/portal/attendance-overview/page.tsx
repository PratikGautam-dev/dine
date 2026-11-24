"use client";

import { useState } from "react";
import {
  CalendarOff,
  CircleCheck,
  Clock,
  MapPin,
  Smartphone,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { Select } from "@/components/erp-ui/Select";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/erp/StatTile";
import { cn } from "@/lib/cn";
import { CHECK_METHOD, DAY_STATE, fmtDate, fmtMinutes } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { roleLabel } from "@/lib/staffRoles";
import {
  useAttendanceSettings,
  useCheckinRequests,
  usePersonDevice,
  useStaffMonth,
  useTeamAttendance,
  type OverviewRow,
} from "@/hooks/useHr";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";

/** Today in the browser's zone (YYYY-MM-DD): only the starting choice -- the server judges every day in the shop's own zone. */
const today = () => new Date().toLocaleDateString("en-CA");

/** Fix a day's clock-in and/or clock-out ("HH:MM", shop time). A clock-out earlier than the clock-in means after midnight. */
function CorrectDialog({
  row,
  onSubmit,
  onClose,
}: {
  row: OverviewRow;
  onSubmit: (
    checkIn: string | null,
    checkOut: string | null,
    note: string,
  ) => Promise<string | null>;
  onClose: () => void;
}) {
  const rec = row.record!;
  const [checkIn, setCheckIn] = useState(rec.check_in_local ?? "");
  const [checkOut, setCheckOut] = useState(rec.check_out_local ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changedIn = checkIn && checkIn !== rec.check_in_local ? checkIn : null;
  const changedOut =
    checkOut && checkOut !== rec.check_out_local ? checkOut : null;
  async function submit() {
    setSaving(true);
    const problem = await onSubmit(changedIn, changedOut, note.trim());
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Correct ${row.name}'s day`}
      description={
        rec.missing_clock_out
          ? "They never clocked out -- the system closed the day for them. Set when they really left."
          : "The old times stay in the activity log."
      }
      width="sm"
      footer={
        <div className="flex justify-end gap-space-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving || (!changedIn && !changedOut) || note.trim().length < 3
            }
          >
            {saving ? "Saving…" : "Save correction"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-space-3">
        <Field label="Clock-in" htmlFor="co-in">
          <Input
            id="co-in"
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field
          label="Clock-out"
          htmlFor="co-out"
          hint="Earlier than clock-in = after midnight."
        >
          <Input
            id="co-out"
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Why are you correcting this?"
        htmlFor="co-note"
        required
        error={error ?? undefined}
      >
        <Input
          id="co-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/** Record a day someone worked but never clocked in for -- with the real times, never just a status. */
function MarkPresentDialog({
  row,
  date,
  onSubmit,
  onClose,
}: {
  row: OverviewRow;
  date: string;
  onSubmit: (
    checkIn: string,
    checkOut: string | null,
    note: string,
  ) => Promise<string | null>;
  onClose: () => void;
}) {
  const [checkIn, setCheckIn] = useState(row.shift_start ?? "");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    const problem = await onSubmit(checkIn, checkOut || null, note.trim());
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark ${row.name} present`}
      description={`On ${fmtDate(date)}. Leave clock-out empty if they're still at work.`}
      width="sm"
      footer={
        <div className="flex justify-end gap-space-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !checkIn || note.trim().length < 3}
          >
            {saving ? "Saving…" : "Mark present"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-space-3">
        <Field label="Clock-in" htmlFor="mp-in" required>
          <Input
            id="mp-in"
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field label="Clock-out" htmlFor="mp-out">
          <Input
            id="mp-out"
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Why?"
        htmlFor="mp-note"
        required
        error={error ?? undefined}
        hint="For example: phone was dead, signed the register."
      >
        <Input
          id="mp-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/** The phone a person clocks in from, while the business locks attendance to one device; a manager resets it for a lost or new phone. */
function PersonDevice({ userId }: { userId: string }) {
  const { data, reset } = usePersonDevice(userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data || (!data.locked && !data.device)) return null;
  return (
    <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-2 rounded-md bg-black/[0.03] px-space-3 py-space-2 text-[13px]">
      <p className="flex min-w-0 items-center gap-space-2 text-ink-600">
        <Smartphone size={14} />
        {data.device
          ? `Clocks in from ${data.device.label ?? "a registered device"}, since ${fmtDate(data.device.registered_at.slice(0, 10))}.`
          : "No device yet: the next clock-in registers one."}
        {!data.locked && " (Device lock is off.)"}
      </p>
      {data.device && (
        <PermissionGate page="attendance" action="write">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "Reset this device? Their next clock-in registers whichever device they use.",
                )
              )
                return;
              setBusy(true);
              setError(await reset());
              setBusy(false);
            }}
          >
            Reset device
          </Button>
        </PermissionGate>
      )}
      {error && <p className="w-full text-[12.5px] text-error">{error}</p>}
    </div>
  );
}

/** One person's month, from the team's month table. */
function PersonMonth({
  userId,
  month,
  onClose,
}: {
  userId: string;
  month: string;
  onClose: () => void;
}) {
  const { month: data, error } = useStaffMonth(true, userId, month);
  return (
    <Modal
      open
      onClose={onClose}
      title={data ? `${data.staff.name} -- ${month}` : "Attendance"}
      description={data?.staff.branch_name}
      width="lg"
    >
      {error && <p className="text-[13px] text-error">{error}</p>}
      <PersonDevice userId={userId} />
      {!data ? (
        <SkeletonLines rows={4} />
      ) : data.records.length === 0 ? (
        <p className="text-[13px] text-ink-400">No working days yet.</p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-label border-b border-line text-ink-600">
              <th className="py-space-2 font-medium">Date</th>
              <th className="py-space-2 font-medium">In / out</th>
              <th className="py-space-2 font-medium">Worked</th>
              <th className="py-space-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((r) => (
              <tr
                key={r.work_date}
                className="border-b border-line last:border-0"
              >
                <td className="py-space-2 font-semibold text-ink-900">
                  {fmtDate(r.work_date)}
                </td>
                <td className="py-space-2">
                  {r.check_in_local
                    ? `${r.check_in_local} – ${r.check_out_local ?? "…"}`
                    : "—"}
                </td>
                <td className="py-space-2">
                  {r.working_minutes ? fmtMinutes(r.working_minutes) : "—"}
                </td>
                <td className="py-space-2">
                  <Badge tone={DAY_STATE[r.status]?.tone ?? "neutral"}>
                    {DAY_STATE[r.status]?.label ?? r.status}
                  </Badge>
                  {(r.holiday_name || r.leave_type) && (
                    <span className="ml-space-2 text-hint">
                      {r.holiday_name ?? r.leave_type}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Clock-ins the shop's check couldn't verify, waiting for a manager. */
function RequestsPanel({ enabled }: { enabled: boolean }) {
  const { requests, decide } = useCheckinRequests(enabled);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!requests || requests.length === 0) return null;
  async function act(id: string, approve: boolean) {
    setBusy(id);
    setError(await decide(id, approve));
    setBusy(null);
  }
  return (
    <Card className="mb-space-4 min-w-0 border-warning/40 p-space-3 md:p-space-4">
      <h3 className="mb-space-2 text-[15px] font-bold text-ink-900">
        Waiting for your approval ({requests.length})
      </h3>
      {error && <p className="mb-space-2 text-[12.5px] text-error">{error}</p>}
      <ul className="divide-y divide-line">
        {requests.map((q) => (
          <li
            key={q.id}
            className="flex flex-wrap items-center justify-between gap-space-2 py-space-2 [overflow-wrap:anywhere]"
          >
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-ink-900">
                {q.staff_name}{" "}
                <span className="font-normal text-ink-600">
                  · {q.branch_name} · {fmtDate(q.work_date)}{" "}
                  {q.kind === "past_day"
                    ? `· missed day, ${q.requested_local}–${q.check_out_local}`
                    : `at ${q.requested_local}`}
                </span>
              </p>
              {q.failure_code === "new_device" && (
                <p className="flex items-center gap-1 text-hint">
                  <Smartphone size={12} /> From a device that isn&apos;t their
                  registered one
                </p>
              )}
              <p className="text-[12.5px] text-ink-600">“{q.reason}”</p>
              {q.distance_m != null && (
                <p className="flex items-center gap-1 text-hint">
                  <MapPin size={12} /> about {q.distance_m} m from the shop
                  {q.accuracy_m != null && ` (±${Math.round(q.accuracy_m)} m)`}
                </p>
              )}
            </div>
            <PermissionGate page="attendance" action="write">
              <div className="flex gap-space-2">
                <Button
                  variant="secondary"
                  disabled={busy === q.id}
                  onClick={() => act(q.id, false)}
                >
                  Decline
                </Button>
                <Button
                  disabled={busy === q.id}
                  onClick={() => act(q.id, true)}
                >
                  Approve
                </Button>
              </div>
            </PermissionGate>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function TeamAttendancePage() {
  const session = useStaffSession();
  const canView = usePermission("attendance", "view");
  const [tab, setTab] = useState<"day" | "month">("day");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [branchId, setBranchId] = useState("");
  const { settings } = useAttendanceSettings(canView);
  const { rows, counts, summary, error, correct, addDay } = useTeamAttendance(
    canView,
    date,
    month,
    branchId,
  );
  const [fixing, setFixing] = useState<OverviewRow | null>(null);
  const [marking, setMarking] = useState<OverviewRow | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const branches = settings?.branches ?? [];
  // On time / late come from the clock-in itself, so someone still at work (or who forgot to clock out) is counted too.
  const arrived = (status: "on_time" | "late") =>
    (rows ?? []).filter((r) => r.record?.status === status).length;

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant ?? null} active="team-attendance">
        <p className="text-[13px] text-ink-400">
          You don&apos;t have access to team attendance.
        </p>
      </PortalShell>
    );
  }

  return (
    <PortalShell restaurant={session?.restaurant ?? null} active="team-attendance">
      <PageHeader
        title="Team Attendance"
        description="Who's in, who's late, who's off -- and the month's totals."
        actions={
          <Button href="/portal/settings/attendance" variant="secondary">
            Attendance rules
          </Button>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      <RequestsPanel enabled={canView} />

      <div className="mb-space-4 flex flex-wrap items-center gap-space-4 border-b border-line pb-space-2">
        {(["day", "month"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
              tab === t
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-ink-600 hover:text-ink-900",
            )}
          >
            {t === "day" ? "By day" : "By month"}
          </button>
        ))}
        {tab === "day" ? (
          <Input
            aria-label="Date"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-full md:w-auto"
          />
        ) : (
          <Input
            aria-label="Month"
            type="month"
            value={month}
            max={today().slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-full md:w-auto"
          />
        )}
        {branches.length > 1 && (
          <Select
            aria-label="Branch"
            value={branchId}
            onValueChange={setBranchId}
            className="w-full md:w-48"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {tab === "day" ? (
        <>
          <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-5">
            <StatTile
              stackOnMobile
              loading={!rows && !error}
              icon={<CircleCheck size={22} />}
              label="On time"
              value={arrived("on_time")}
              deltaPct={null}
              hint={fmtDate(date)}
              tone="brand"
              filled
            />
            <StatTile
              stackOnMobile
              loading={!rows && !error}
              icon={<TriangleAlert size={22} />}
              label="Late"
              value={arrived("late")}
              deltaPct={null}
              hint={fmtDate(date)}
              tone="warning"
              filled
              upIsGood={false}
            />
            <StatTile
              stackOnMobile
              loading={!rows && !error}
              icon={<Clock size={22} />}
              label="Still clocked in"
              value={counts.clocked_in ?? 0}
              deltaPct={null}
              hint={fmtDate(date)}
              tone="info"
              filled
            />
            <StatTile
              stackOnMobile
              loading={!rows && !error}
              icon={<UserX size={22} />}
              label="Absent / not in"
              value={(counts.absent ?? 0) + (counts.not_in ?? 0)}
              deltaPct={null}
              hint={fmtDate(date)}
              tone="clay"
              filled
              upIsGood={false}
            />
            <StatTile
              stackOnMobile
              loading={!rows && !error}
              icon={<CalendarOff size={22} />}
              label="On leave"
              value={counts.on_leave ?? 0}
              deltaPct={null}
              hint={fmtDate(date)}
              tone="violet"
              filled
            />
          </div>
          <Card className="no-scrollbar min-w-0 max-w-full overflow-x-auto p-space-2">
            {!rows ? (
              <SkeletonLines rows={3} />
            ) : rows.length === 0 ? (
              <p className="p-space-4 text-[13px] text-ink-400">No staff.</p>
            ) : (
              <table className="w-full text-left text-[13px] max-md:min-w-[760px]">
                <thead>
                  <tr className="text-label border-b border-line text-ink-600">
                    <th className="px-space-3 py-space-2 font-medium">Name</th>
                    <th className="px-space-3 py-space-2 font-medium">Shift</th>
                    <th className="px-space-3 py-space-2 font-medium">
                      Status
                    </th>
                    <th className="px-space-3 py-space-2 font-medium">
                      In / out
                    </th>
                    <th className="px-space-3 py-space-2 font-medium">
                      Worked
                    </th>
                    <th className="px-space-3 py-space-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = DAY_STATE[r.state] ?? {
                      label: r.state,
                      tone: "neutral" as const,
                    };
                    const rec = r.record;
                    return (
                      <tr
                        key={r.staff_id}
                        data-testid="overview-row"
                        data-state={r.state}
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-space-3 py-space-2">
                          <p className="font-semibold text-ink-900">{r.name}</p>
                          <p className="text-[12px] text-ink-600">
                            {roleLabel(r.role)}
                            {branches.length > 1 && ` · ${r.branch_name}`}
                          </p>
                        </td>
                        <td className="px-space-3 py-space-2">
                          {r.shift_start
                            ? `${r.shift_start}–${r.shift_end}`
                            : "—"}
                        </td>
                        <td className="px-space-3 py-space-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {rec?.status === "late" && (
                            <span className="ml-1 text-[12px] text-clay-700">
                              {r.state === "late" ? "" : "late "}
                              {fmtMinutes(rec.late_minutes)}
                            </span>
                          )}
                          {(r.holiday_name || r.leave_type) && (
                            <span className="ml-1 text-hint">
                              {r.holiday_name ?? r.leave_type}
                            </span>
                          )}
                          {rec?.needs_review && (
                            <span
                              className="ml-1 text-[12px] text-warning"
                              title="Clocked in by location only, though the shop also checks its network"
                            >
                              check
                            </span>
                          )}
                        </td>
                        <td className="px-space-3 py-space-2">
                          {rec ? (
                            <>
                              {`${rec.check_in_local} – ${rec.check_out_local ?? "…"}`}
                              <span className="block text-hint">
                                {CHECK_METHOD[rec.check_in_method] ??
                                  rec.check_in_method}
                                {rec.corrected && " · corrected"}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-space-3 py-space-2">
                          {rec?.check_out_at
                            ? fmtMinutes(rec.working_minutes)
                            : "—"}
                          {rec && rec.overtime_minutes > 0 && (
                            <span className="ml-1 text-[12px] font-semibold text-brand-700">
                              +{fmtMinutes(rec.overtime_minutes)}
                            </span>
                          )}
                        </td>
                        <td className="px-space-3 py-space-2 text-right">
                          <PermissionGate page="attendance" action="write">
                            {rec ? (
                              <Button
                                variant={
                                  r.state === "missing_clock_out"
                                    ? "primary"
                                    : "ghost"
                                }
                                onClick={() => setFixing(r)}
                              >
                                {r.state === "missing_clock_out"
                                  ? "Correct clock-out"
                                  : "Correct"}
                              </Button>
                            ) : r.state === "absent" || r.state === "not_in" ? (
                              <Button
                                variant="ghost"
                                onClick={() => setMarking(r)}
                              >
                                Mark present
                              </Button>
                            ) : null}
                          </PermissionGate>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : (
        <Card className="no-scrollbar min-w-0 max-w-full overflow-x-auto p-space-2">
          {!summary ? (
            <SkeletonLines rows={3} />
          ) : (
            <table className="w-full text-left text-[13px] max-md:min-w-[680px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  {[
                    "Name",
                    "Present",
                    "Late",
                    "Absent",
                    "On leave",
                    "Hours",
                    "Overtime",
                    "Missing clock-out",
                  ].map((h) => (
                    <th key={h} className="px-space-3 py-space-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr
                    key={s.staff_id}
                    data-testid="summary-row"
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-space-3 py-space-2">
                      <button
                        type="button"
                        className="font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                        onClick={() => setPerson(s.staff_id)}
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="px-space-3 py-space-2">{s.present_days}</td>
                    <td className="px-space-3 py-space-2">{s.late_days}</td>
                    <td className="px-space-3 py-space-2">{s.absent_days}</td>
                    <td className="px-space-3 py-space-2">{s.leave_days}</td>
                    <td className="px-space-3 py-space-2">
                      {fmtMinutes(s.working_minutes)}
                    </td>
                    <td className="px-space-3 py-space-2">
                      {s.overtime_minutes
                        ? fmtMinutes(s.overtime_minutes)
                        : "—"}
                    </td>
                    <td className="px-space-3 py-space-2">
                      {s.missing_clock_outs || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {fixing?.record && (
        <CorrectDialog
          row={fixing}
          onSubmit={(checkIn, checkOut, note) =>
            correct(fixing.record!.id, checkIn, checkOut, note)
          }
          onClose={() => setFixing(null)}
        />
      )}
      {marking && (
        <MarkPresentDialog
          row={marking}
          date={date}
          onSubmit={(checkIn, checkOut, note) =>
            addDay(marking.staff_id, date, checkIn, checkOut, note)
          }
          onClose={() => setMarking(null)}
        />
      )}
      {person && (
        <PersonMonth
          userId={person}
          month={month}
          onClose={() => setPerson(null)}
        />
      )}
    </PortalShell>
  );
}
