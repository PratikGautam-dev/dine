"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Download, TrendingUp, TriangleAlert, UserX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { StatTile } from "@/components/portal/StatTile";
import { DAY_STATE, fmtDate, fmtMinutes } from "@/lib/hr";
import { toast } from "@/lib/toast";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useMyMonthlyAttendance } from "@/hooks/useHr";

const SELECT_CLASS = "h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";
const STATUS_FILTERS = ["", "on_time", "late", "on_leave", "absent", "missing_clock_out"];
// The app's own --success token (globals.css) and a lighter, still-visible tint of it -- not a new hue,
// just two steps of the same one: solid for the current week, tinted for earlier weeks.
const SUCCESS = "#1e9e5a";
const SUCCESS_TINT = "#a9ddc4";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{payload[0].payload.label}</p>
      <p className="text-ink-600">{payload[0].value}% present</p>
    </div>
  );
}

export default function MyAttendancePage() {
  const session = useStaffSession();
  const canView = usePermission("check_in_out", "view");
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState("");
  const { records, stats, weeklyTrend, error } = useMyMonthlyAttendance(canView, month);

  const filtered = useMemo(() => (records ?? []).filter((r) => !status || r.status === status), [records, status]);

  const trendData = useMemo(() => weeklyTrend.map((w) => ({ ...w, isLatest: false })).map((w, i, arr) => ({ ...w, isLatest: i === arr.length - 1 })), [weeklyTrend]);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="my-attendance">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to attendance.</p>
      </PortalShell>
    );
  }

  const presentOnTime = stats ? stats.present_days - stats.late_days : 0;
  const statusData = stats
    ? [
        { department_name: "Present", count: presentOnTime },
        { department_name: "Late", count: stats.late_days },
        { department_name: "Leave", count: stats.leave_days },
        { department_name: "Absent", count: stats.absent_days },
      ].filter((s) => s.count > 0)
    : [];

  return (
    <PortalShell hospital={session?.hospital || null} active="my-attendance">
      <PageHeader
        title="Attendance"
        description="See your own hours, overtime, and attendance history. Clock in from Check-in / Check-out."
        actions={
          <Button variant="secondary" onClick={() => toast.success("Report export is coming soon")}>
            <Download size={16} /> Download Report
          </Button>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <StatTile icon={<CalendarCheck size={22} />} label="Present days" value={stats?.present_days ?? 0} deltaPct={null} hint={month} tone="success" filled />
        <StatTile icon={<UserX size={22} />} label="Absent days" value={stats?.absent_days ?? 0} deltaPct={null} hint={month} tone="clay" filled upIsGood={false} />
        <StatTile icon={<TriangleAlert size={22} />} label="Late check-ins" value={stats?.late_days ?? 0} deltaPct={null} hint={month} tone="warning" filled upIsGood={false} />
        <StatTile icon={<TrendingUp size={22} />} label="Overtime hours" value={fmtMinutes(stats?.overtime_minutes ?? 0)} deltaPct={null} hint={month} tone="violet" filled />
      </div>

      <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Attendance trend (this month)</h3>
          {trendData.every((w) => w.pct === 0) ? (
            <div className="flex h-[240px] items-center justify-center text-[13px] text-ink-400">No attendance in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#ebe0d6" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} unit="%" domain={[0, 100]} />
                <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {trendData.map((w) => (
                    <Cell key={w.label} fill={w.isLatest ? SUCCESS : SUCCESS_TINT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <DepartmentDonut data={statusData} title="Attendance status" subtitle={month} unit="days" emptyText="No attendance in this period." />
      </div>

      <Card className="p-space-4">
        <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-3">
          <h3 className="text-[15px] font-bold text-ink-900">Attendance records</h3>
          <div className="flex flex-wrap items-center gap-space-2">
            <input aria-label="Month" type="month" className={SELECT_CLASS} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            <select aria-label="Status" className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s ? DAY_STATE[s]?.label ?? s : "All"}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {!records ? (
            <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-space-4 text-[13px] text-ink-400">No attendance in this period.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  <th className="px-space-3 py-space-2 font-medium">Date</th>
                  <th className="px-space-3 py-space-2 font-medium">Check-in</th>
                  <th className="px-space-3 py-space-2 font-medium">Check-out</th>
                  <th className="px-space-3 py-space-2 font-medium">Break</th>
                  <th className="px-space-3 py-space-2 font-medium">Working hours</th>
                  <th className="px-space-3 py-space-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.work_date} data-testid="attendance-row" className="border-b border-line last:border-0">
                    <td className="px-space-3 py-space-2 font-semibold text-ink-900">{fmtDate(r.work_date)}</td>
                    <td className="px-space-3 py-space-2">{r.check_in_local ?? "—"}</td>
                    <td className="px-space-3 py-space-2">{r.check_out_local ?? "—"}</td>
                    <td className="px-space-3 py-space-2">{r.break_minutes ? fmtMinutes(r.break_minutes) : "—"}</td>
                    <td className="px-space-3 py-space-2">{r.working_minutes ? fmtMinutes(r.working_minutes) : "—"}</td>
                    <td className="px-space-3 py-space-2">
                      <Badge tone={DAY_STATE[r.status]?.tone ?? "neutral"}>{DAY_STATE[r.status]?.label ?? r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </PortalShell>
  );
}
