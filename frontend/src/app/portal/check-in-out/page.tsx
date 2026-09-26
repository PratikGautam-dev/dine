"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Briefcase, CalendarCheck, ChevronRight, Clock, Coffee, LogIn, LogOut, MapPin, Play,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { cn } from "@/lib/cn";
import { fmtDate, fmtMinutes } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useClock, useMyMonthlyAttendance } from "@/hooks/useHr";

const STATE_TEXT: Record<string, string> = {
  not_in: "Not checked in",
  in: "Checked in",
  on_break: "On a break",
  out: "Checked out",
};
const STATE_TONE: Record<string, string> = {
  not_in: "text-ink-600",
  in: "text-success",
  on_break: "text-warning",
  out: "text-ink-600",
};
const RING_TRACK = "#e7e2da";
const RING_FILL = "#1e9e5a";

/** Minutes worked so far on an open record (clock-in to now, minus finished breaks and the break in progress). */
function liveMinutes(checkInAt: string, breakMinutes: number, breakStartedAt: string | null, nowMs: number): number {
  const end = breakStartedAt ? new Date(breakStartedAt).getTime() : nowMs;
  return Math.max(0, Math.floor((end - new Date(checkInAt).getTime()) / 60000) - breakMinutes);
}

/** The scheduled shift's length in minutes, for the work-timer ring's denominator. Falls back to a plain
 * 8-hour shift when nothing's configured -- just the ring's proportion, not a stored value. */
function shiftMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 480;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : mins + 24 * 60;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function WorkTimer({ workingMinutes, targetMinutes, label }: { workingMinutes: number; targetMinutes: number; label: string }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const pct = targetMinutes > 0 ? Math.min(1, workingMinutes / targetMinutes) : 0;
  return (
    <div className="relative h-[200px] w-[200px] shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx={100} cy={100} r={r} stroke={RING_TRACK} strokeWidth={14} fill="none" />
        <circle
          cx={100} cy={100} r={r} stroke={RING_FILL} strokeWidth={14} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-tint text-success">
          <Briefcase size={18} />
        </span>
        <span className="text-[22px] leading-none font-bold text-ink-900">{fmtMinutes(workingMinutes)}</span>
        <span className="text-[11.5px] text-ink-600">{label}</span>
      </div>
    </div>
  );
}

function TimelineRow({ icon, time, title, note, tone, last }: { icon: ReactNode; time: string; title: string; note: string; tone: "success" | "brand" | "neutral"; last?: boolean }) {
  const dotTone = tone === "success" ? "bg-success" : tone === "brand" ? "bg-brand-600" : "bg-ink-400";
  return (
    <div className="flex gap-space-3">
      <div className="flex flex-col items-center">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotTone)} />
        {!last && <span className="w-px flex-1 bg-line" />}
      </div>
      <div className={cn("mb-space-3 flex min-w-0 flex-1 items-start gap-space-3 rounded-md px-space-3 py-space-2", tone === "brand" && "bg-success-tint")}>
        <span className="mt-0.5 w-16 shrink-0 text-[12px] font-medium text-ink-600">{time}</span>
        <span className="mt-0.5 text-ink-600">{icon}</span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink-900">{title}</p>
          <p className="text-hint">{note}</p>
        </div>
      </div>
    </div>
  );
}

export default function CheckInOutPage() {
  const session = useStaffSession();
  const canView = usePermission("check_in_out", "view");
  const { today, error: clockError, busy, checkIn, checkOut, breakStart, breakEnd } = useClock(canView);
  const { records } = useMyMonthlyAttendance(canView, currentMonth());
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);

  const rec = today?.record ?? null;
  const state = today?.state ?? "not_in";
  const working = rec && !rec.check_out_at ? liveMinutes(rec.check_in_at, rec.break_minutes, rec.break_started_at, nowMs) : rec?.working_minutes ?? 0;
  const target = shiftMinutes(today?.shift.start ?? null, today?.shift.end ?? null);

  const timeline = useMemo(() => {
    if (!rec) return [];
    const items: { icon: ReactNode; time: string; title: string; note: string; tone: "success" | "brand" | "neutral" }[] = [
      { icon: <LogIn size={14} />, time: rec.check_in_local, title: "Check in", note: "You checked in", tone: "success" },
    ];
    if (rec.break_minutes > 0 || state === "on_break") {
      items.push({
        icon: <Coffee size={14} />, time: state === "on_break" ? "Now" : "", title: state === "on_break" ? "On a break" : "Break taken",
        note: state === "on_break" ? "Currently on a break" : `${fmtMinutes(rec.break_minutes)} today`, tone: "neutral",
      });
    }
    if (rec.check_out_at && rec.check_out_local) {
      items.push({ icon: <LogOut size={14} />, time: rec.check_out_local, title: "Check out", note: "You checked out", tone: "neutral" });
    } else if (state === "in" || state === "on_break") {
      items.push({ icon: <Briefcase size={14} />, time: "Now", title: "Current session", note: state === "on_break" ? "Paused for a break" : "Working", tone: "brand" });
    }
    return items;
  }, [rec, state]);

  const recentRows = useMemo(() => (records ?? []).filter((r) => r.check_in_local).slice(0, 5), [records]);

  const primaryAction =
    state === "not_in" ? checkIn : state === "in" ? checkOut : state === "on_break" ? breakEnd : undefined;
  const primaryLabel = state === "not_in" ? "Check In" : state === "in" ? "Check Out" : state === "on_break" ? "End Break" : "Done for today";

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="check-in-out">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to attendance.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="check-in-out">
      <PageHeader
        title="Check-in / Check-out"
        description={today ? new Date(`${today.work_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
        actions={
          <PermissionGate page="check_in_out" action="write">
            <Button disabled={busy || !today || !primaryAction} onClick={primaryAction}>
              <CalendarCheck size={16} /> {primaryLabel}
            </Button>
          </PermissionGate>
        }
      />
      {clockError && <p role="alert" className="mb-space-4 rounded-md bg-error/10 px-space-3 py-space-2 text-[13px] font-medium text-error">{clockError}</p>}
      {today?.location_required && state === "not_in" && (
        <p className="mb-space-4 flex items-center gap-space-2 text-[12.5px] text-ink-600">
          <MapPin size={14} /> This restaurant checks your location when you clock in -- allow location access when asked.
        </p>
      )}

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <StatTile
          icon={<LogIn size={22} />} label="Current status" value={STATE_TEXT[state]} deltaPct={null}
          hint={rec ? `Since ${rec.check_in_local}` : ""} tone="success" filled
        />
        <StatTile icon={<Clock size={22} />} label="Check-in time" value={rec?.check_in_local ?? "—"} deltaPct={null} hint="" tone="info" filled />
        <StatTile icon={<Coffee size={22} />} label="Break taken" value={fmtMinutes(rec?.break_minutes ?? 0)} deltaPct={null} hint="" tone="warning" filled />
        <StatTile icon={<Briefcase size={22} />} label="Working hours" value={fmtMinutes(working)} deltaPct={null} hint="" tone="violet" filled />
      </div>

      <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
        <Card className="p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Today&apos;s activity</h3>
          {timeline.length === 0 ? (
            <p className="p-space-2 text-[13px] text-ink-400">You haven&apos;t checked in today.</p>
          ) : (
            <div>
              {timeline.map((t, i) => (
                <TimelineRow key={i} {...t} last={i === timeline.length - 1} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-space-4">
          <div className="mb-space-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink-900">Live work timer</h3>
            {(state === "in" || state === "on_break") && (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" /> {state === "on_break" ? "On a break" : "Currently working"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-space-5">
            <WorkTimer workingMinutes={working} targetMinutes={target} label="Working today" />
            <div className="min-w-[160px] flex-1 space-y-space-3">
              <div className="flex items-center gap-space-2">
                <LogIn size={15} className="text-ink-400" />
                <div>
                  <p className="text-hint">Check-in time</p>
                  <p className="text-[13.5px] font-semibold text-ink-900">{rec?.check_in_local ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-space-2">
                <Coffee size={15} className="text-ink-400" />
                <div>
                  <p className="text-hint">Break taken</p>
                  <p className="text-[13.5px] font-semibold text-ink-900">{fmtMinutes(rec?.break_minutes ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-space-2">
                <Clock size={15} className="text-ink-400" />
                <div>
                  <p className="text-hint">{rec?.check_out_at ? "Checked out" : "Active since"}</p>
                  <p className="text-[13.5px] font-semibold text-ink-900">{(rec?.check_out_at ? rec.check_out_local : rec?.check_in_local) ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-2">
        <PermissionGate page="check_in_out" action="write">
          <Card className="p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Quick actions</h3>
            <div className="grid grid-cols-2 gap-space-3 sm:grid-cols-4">
              <Button variant={state === "not_in" ? "primary" : "secondary"} disabled={busy || state !== "not_in"} onClick={checkIn} className="h-auto flex-col gap-space-2 py-space-4">
                <LogIn size={20} /> Check In
              </Button>
              <Button variant="secondary" disabled={busy || state !== "in"} onClick={breakStart} className="h-auto flex-col gap-space-2 py-space-4">
                <Coffee size={20} /> Start Break
              </Button>
              <Button variant="secondary" disabled={busy || state !== "on_break"} onClick={breakEnd} className="h-auto flex-col gap-space-2 py-space-4">
                <Play size={20} /> End Break
              </Button>
              <Button variant={state === "in" || state === "on_break" ? "primary" : "secondary"} disabled={busy || (state !== "in" && state !== "on_break")} onClick={checkOut} className="h-auto flex-col gap-space-2 py-space-4">
                <LogOut size={20} /> Check Out
              </Button>
            </div>
            <p className={cn("mt-space-3 flex items-center gap-1.5 text-[12.5px] font-semibold", STATE_TONE[state])}>
              <span className={cn("h-2 w-2 rounded-full", state === "in" ? "bg-success" : state === "on_break" ? "bg-warning" : "bg-ink-400")} />
              {STATE_TEXT[state]}
            </p>
          </Card>
        </PermissionGate>

        <Card className="p-space-4">
          <div className="mb-space-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink-900">Recent check-in history</h3>
            <a href="/portal/attendance" className="flex items-center gap-0.5 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">
              View all <ChevronRight size={14} />
            </a>
          </div>
          {recentRows.length === 0 ? (
            <p className="p-space-2 text-[13px] text-ink-400">No check-ins yet.</p>
          ) : (
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  <th className="py-space-2 font-medium">Date</th>
                  <th className="py-space-2 font-medium">Check-in</th>
                  <th className="py-space-2 font-medium">Check-out</th>
                  <th className="py-space-2 font-medium">Total hours</th>
                  <th className="py-space-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((r) => (
                  <tr key={r.work_date} className="border-b border-line last:border-0">
                    <td className="py-space-2 font-semibold text-ink-900">{fmtDate(r.work_date)}</td>
                    <td className="py-space-2">{r.check_in_local ?? "—"}</td>
                    <td className="py-space-2">{r.check_out_local ?? "—"}</td>
                    <td className="py-space-2">{r.working_minutes ? fmtMinutes(r.working_minutes) : "—"}</td>
                    <td className="py-space-2">
                      <Badge tone={r.check_out_local ? "success" : "brand"}>{r.check_out_local ? "Completed" : "In Progress"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
