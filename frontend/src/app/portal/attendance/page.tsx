"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Clock, Coffee, LogIn, LogOut, MapPin, Play, TrendingUp, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { fmtDate, fmtMinutes } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useAttendanceHistory, useClock } from "@/hooks/useHr";

const RANGES = [7, 30, 90];
const STATE_TEXT: Record<string, string> = {
  not_in: "Not clocked in",
  in: "Clocked in",
  on_break: "On a break",
  out: "Done for today",
};

/** Minutes worked so far on an open record (clock-in to now, minus finished breaks and the break in progress). */
function liveMinutes(checkInAt: string, breakMinutes: number, breakStartedAt: string | null, nowMs: number): number {
  const end = breakStartedAt ? new Date(breakStartedAt).getTime() : nowMs;
  return Math.max(0, Math.floor((end - new Date(checkInAt).getTime()) / 60000) - breakMinutes);
}

export default function MyAttendancePage() {
  const session = useStaffSession();
  const canView = usePermission("check_in_out", "view");
  const [days, setDays] = useState(30);
  const { records, stats, error } = useAttendanceHistory(canView, days);
  const { today, error: clockError, busy, checkIn, checkOut, breakStart, breakEnd } = useClock(canView);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="my-attendance">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to attendance.</p>
      </PortalShell>
    );
  }

  const rec = today?.record ?? null;
  const state = today?.state ?? "not_in";
  const working = rec && !rec.check_out_at ? liveMinutes(rec.check_in_at, rec.break_minutes, rec.break_started_at, nowMs) : rec?.working_minutes ?? 0;

  return (
    <PortalShell hospital={session?.hospital || null} active="my-attendance">
      <PageHeader
        title="My Attendance"
        description="Clock in, and see your own hours and overtime."
        actions={
          <select aria-label="Time range" className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <Card className="mb-space-4 p-space-6">
        <div className="flex flex-wrap items-start justify-between gap-space-4">
          <div>
            <p data-testid="clock-state" className="text-[22px] font-semibold text-ink-900">{STATE_TEXT[state]}</p>
            {rec && (
              <p className="mt-space-1 text-[13px] text-ink-600">
                In at <strong data-testid="clock-in-time">{rec.check_in_local}</strong>
                {rec.check_out_local && <> · out at <strong data-testid="clock-out-time">{rec.check_out_local}</strong></>}
                {rec.break_minutes > 0 && <> · {fmtMinutes(rec.break_minutes)} on breaks</>}
              </p>
            )}
            {today?.shift.start && (
              <p className="mt-space-1 text-[12.5px] text-ink-400">
                Your shift: {today.shift.start}–{today.shift.end} ({today.shift.source === "own" ? "your own pattern" : "the restaurant's default"}) · {today.grace_minutes} min grace
              </p>
            )}
            {today?.on_leave && <p className="mt-space-2 text-[12.5px] font-semibold text-brand-700">You have approved leave today.</p>}
          </div>
          {rec && (
            <div className="text-right">
              <p className="text-label font-medium text-ink-600">{rec.check_out_at ? "Worked" : "Working so far"}</p>
              <p data-testid="clock-worked" className="text-[28px] leading-none font-semibold text-ink-900">{fmtMinutes(working)}</p>
              {rec.overtime_minutes > 0 && <p data-testid="clock-overtime" className="mt-1 text-[12.5px] font-semibold text-brand-700">{fmtMinutes(rec.overtime_minutes)} overtime</p>}
            </div>
          )}
        </div>

        {rec?.status === "late" && (
          <p data-testid="late-banner" className="mt-space-3 rounded-md bg-clay-100 px-space-3 py-space-2 text-[13px] font-medium text-clay-700">
            You clocked in {fmtMinutes(rec.late_minutes)} after your shift started.
          </p>
        )}
        {today?.location_required && state === "not_in" && (
          <p className="mt-space-3 flex items-center gap-space-2 text-[12.5px] text-ink-600">
            <MapPin size={14} /> This restaurant checks your location when you clock in -- allow location access when asked.
          </p>
        )}
        {clockError && <p role="alert" data-testid="clock-error" className="mt-space-3 rounded-md bg-error/10 px-space-3 py-space-2 text-[13px] font-medium text-error">{clockError}</p>}

        <PermissionGate page="check_in_out" action="write">
          <div className="mt-space-5 flex flex-wrap gap-space-3">
            {state === "not_in" && (
              <Button size="lg" disabled={busy || !today} onClick={checkIn}><LogIn size={16} /> Clock in</Button>
            )}
            {state === "in" && (
              <>
                <Button size="lg" variant="secondary" disabled={busy} onClick={breakStart}><Coffee size={16} /> Start break</Button>
                <Button size="lg" disabled={busy} onClick={checkOut}><LogOut size={16} /> Clock out</Button>
              </>
            )}
            {state === "on_break" && (
              <>
                <Button size="lg" variant="secondary" disabled={busy} onClick={breakEnd}><Play size={16} /> End break</Button>
                <Button size="lg" disabled={busy} onClick={checkOut}><LogOut size={16} /> Clock out</Button>
              </>
            )}
          </div>
        </PermissionGate>
      </Card>

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <StatTile icon={<CalendarCheck size={22} />} label="Days worked" value={stats?.days_present ?? 0} deltaPct={null} hint={`Last ${days} days`} tone="brand" filled />
        <StatTile icon={<TriangleAlert size={22} />} label="Late arrivals" value={stats?.late_days ?? 0} deltaPct={null} hint={`Last ${days} days`} tone="warning" filled upIsGood={false} />
        <StatTile icon={<Clock size={22} />} label="Average day (hrs)" value={Math.round(((stats?.average_working_minutes ?? 0) / 60) * 10) / 10} deltaPct={null} hint="Per worked day" tone="info" filled />
        <StatTile icon={<TrendingUp size={22} />} label="Overtime (hrs)" value={Math.round(((stats?.total_overtime_minutes ?? 0) / 60) * 10) / 10} deltaPct={null} hint={`Last ${days} days`} tone="violet" filled />
      </div>

      <Card className="overflow-x-auto p-space-2">
        {!records ? (
          <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="p-space-4 text-[13px] text-ink-400">No attendance in this period.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-label border-b border-line text-ink-600">
                <th className="px-space-3 py-space-2 font-medium">Date</th>
                <th className="px-space-3 py-space-2 font-medium">In</th>
                <th className="px-space-3 py-space-2 font-medium">Out</th>
                <th className="px-space-3 py-space-2 font-medium">Breaks</th>
                <th className="px-space-3 py-space-2 font-medium">Worked</th>
                <th className="px-space-3 py-space-2 font-medium">Overtime</th>
                <th className="px-space-3 py-space-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} data-testid="attendance-row" className="border-b border-line last:border-0">
                  <td className="px-space-3 py-space-2 font-semibold text-ink-900">{fmtDate(r.work_date)}</td>
                  <td className="px-space-3 py-space-2">{r.check_in_local}</td>
                  <td className="px-space-3 py-space-2">{r.check_out_local ?? "—"}{r.corrected && <span title={r.correction_note ?? ""}> ✎</span>}</td>
                  <td className="px-space-3 py-space-2">{fmtMinutes(r.break_minutes)}</td>
                  <td className="px-space-3 py-space-2">{r.check_out_at ? fmtMinutes(r.working_minutes) : "—"}</td>
                  <td className="px-space-3 py-space-2">{r.overtime_minutes ? fmtMinutes(r.overtime_minutes) : "—"}</td>
                  <td className="px-space-3 py-space-2">
                    {r.missing_clock_out ? <Badge tone="clay">Missing clock-out</Badge> : <Badge tone={r.status === "late" ? "clay" : "success"}>{r.status === "late" ? `Late ${r.late_minutes}m` : "On time"}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PortalShell>
  );
}
