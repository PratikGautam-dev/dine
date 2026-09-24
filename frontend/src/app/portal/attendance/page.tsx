"use client";

import { useState } from "react";
import { CalendarCheck, Clock, TrendingUp, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { fmtDate, fmtMinutes } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useAttendanceHistory } from "@/hooks/useHr";

const RANGES = [7, 30, 90];

export default function MyAttendancePage() {
  const session = useStaffSession();
  const canView = usePermission("check_in_out", "view");
  const [days, setDays] = useState(30);
  const { records, stats, error } = useAttendanceHistory(canView, days);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="my-attendance">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to attendance.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="my-attendance">
      <PageHeader
        title="My Attendance"
        description="Your own clock-ins, hours and overtime."
        actions={
          <select aria-label="Time range" className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

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
