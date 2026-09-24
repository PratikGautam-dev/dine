"use client";

import { useState } from "react";
import { CalendarOff, CircleCheck, Clock, TriangleAlert, UserX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { cn } from "@/lib/cn";
import { DAY_STATE, fmtMinutes } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { ROLE_LABEL } from "@/lib/staffRoles";
import { useTeamAttendance, type OverviewRow } from "@/hooks/useHr";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the browser's zone

function CorrectDialog({ row, onSubmit, onClose }: { row: OverviewRow; onSubmit: (time: string, note: string) => Promise<string | null>; onClose: () => void }) {
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const problem = await onSubmit(time, note);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="correct-title" className="w-full max-w-[420px] rounded-lg bg-card p-space-5 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <h2 id="correct-title" className="text-[16px] font-semibold text-ink-900">Correct clock-out for {row.name}</h2>
        <p className="mt-space-1 text-[13px] text-ink-600">They clocked in at {row.record?.check_in_local} and never clocked out. They&apos;ll be told what you set.</p>
        <form onSubmit={submit} className="mt-space-4">
          <Field label="Clock-out time (restaurant time)" htmlFor="co-time" required hint="A time earlier than their clock-in counts as after midnight.">
            <Input id="co-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </Field>
          <Field label="Why are you correcting this?" htmlFor="co-note" required>
            <Input id="co-note" value={note} onChange={(e) => setNote(e.target.value)} required />
          </Field>
          {error && <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">{error}</p>}
          <div className="flex justify-end gap-space-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !time || note.trim().length < 3}>{saving ? "Saving…" : "Save correction"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamAttendancePage() {
  const session = useStaffSession();
  const canView = usePermission("attendance", "view");
  const [tab, setTab] = useState<"day" | "month">("day");
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const { rows, counts, summary, error, correct } = useTeamAttendance(canView, date, month);
  const [fixing, setFixing] = useState<OverviewRow | null>(null);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="team-attendance">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to team attendance.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="team-attendance">
      <PageHeader
        title="Team Attendance"
        description="Who's in, who's late, who's off -- and the month's totals."
        actions={<Button href="/portal/settings/attendance" variant="secondary">Attendance rules</Button>}
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 flex flex-wrap items-center gap-space-4 border-b border-line">
        {(["day", "month"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-600 hover:text-ink-900",
            )}
          >
            {t === "day" ? "By day" : "By month"}
          </button>
        ))}
        {tab === "day" ? (
          <Input aria-label="Date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
        ) : (
          <Input aria-label="Month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-auto" />
        )}
      </div>

      {tab === "day" ? (
        <>
          <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-5">
            <StatTile icon={<CircleCheck size={22} />} label="On time" value={counts.on_time ?? 0} deltaPct={null} hint="Today" tone="brand" filled />
            <StatTile icon={<TriangleAlert size={22} />} label="Late" value={counts.late ?? 0} deltaPct={null} hint="Today" tone="warning" filled upIsGood={false} />
            <StatTile icon={<Clock size={22} />} label="Clocked in now" value={counts.clocked_in ?? 0} deltaPct={null} hint="Right now" tone="info" filled />
            <StatTile icon={<UserX size={22} />} label="Absent / not in" value={(counts.absent ?? 0) + (counts.not_in ?? 0)} deltaPct={null} hint="Today" tone="clay" filled upIsGood={false} />
            <StatTile icon={<CalendarOff size={22} />} label="On leave" value={counts.on_leave ?? 0} deltaPct={null} hint="Today" tone="violet" filled />
          </div>
          <Card className="overflow-x-auto p-space-2">
            {!rows ? (
              <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-space-4 text-[13px] text-ink-400">No staff.</p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-label border-b border-line text-ink-600">
                    <th className="px-space-3 py-space-2 font-medium">Name</th>
                    <th className="px-space-3 py-space-2 font-medium">Shift</th>
                    <th className="px-space-3 py-space-2 font-medium">Status</th>
                    <th className="px-space-3 py-space-2 font-medium">In / out</th>
                    <th className="px-space-3 py-space-2 font-medium">Worked</th>
                    <th className="px-space-3 py-space-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = DAY_STATE[r.state] ?? { label: r.state, tone: "neutral" as const };
                    return (
                      <tr key={r.staff_id} data-testid="overview-row" data-state={r.state} className="border-b border-line last:border-0">
                        <td className="px-space-3 py-space-2">
                          <p className="font-semibold text-ink-900">{r.name}</p>
                          <p className="text-[12px] text-ink-600">{ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] ?? r.role}</p>
                        </td>
                        <td className="px-space-3 py-space-2">{r.shift_start ? `${r.shift_start}–${r.shift_end}` : "—"}</td>
                        <td className="px-space-3 py-space-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {r.record?.status === "late" && r.state !== "late" && <span className="ml-1 text-[12px] text-clay-700">late {r.record.late_minutes}m</span>}
                          {r.state === "late" && <span className="ml-1 text-[12px] text-clay-700">{r.record?.late_minutes}m</span>}
                        </td>
                        <td className="px-space-3 py-space-2">{r.record ? `${r.record.check_in_local} – ${r.record.check_out_local ?? "…"}` : "—"}</td>
                        <td className="px-space-3 py-space-2">{r.record?.check_out_at ? fmtMinutes(r.record.working_minutes) : "—"}{r.record && r.record.overtime_minutes > 0 && <span className="ml-1 text-[12px] font-semibold text-brand-700">+{fmtMinutes(r.record.overtime_minutes)}</span>}</td>
                        <td className="px-space-3 py-space-2 text-right">
                          {r.state === "missing_clock_out" && (
                            <PermissionGate page="attendance" action="write">
                              <Button size="md" variant="secondary" onClick={() => setFixing(r)}>Correct clock-out</Button>
                            </PermissionGate>
                          )}
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
        <Card className="overflow-x-auto p-space-2">
          {!summary ? (
            <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  {["Name", "Present", "Late", "Absent", "On leave", "Hours", "Overtime", "Missing clock-out"].map((h) => (
                    <th key={h} className="px-space-3 py-space-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.staff_id} data-testid="summary-row" className="border-b border-line last:border-0">
                    <td className="px-space-3 py-space-2 font-semibold text-ink-900">{s.name}</td>
                    <td className="px-space-3 py-space-2">{s.present_days}</td>
                    <td className="px-space-3 py-space-2">{s.late_days}</td>
                    <td className="px-space-3 py-space-2">{s.absent_days}</td>
                    <td className="px-space-3 py-space-2">{s.leave_days}</td>
                    <td className="px-space-3 py-space-2">{fmtMinutes(s.working_minutes)}</td>
                    <td className="px-space-3 py-space-2">{s.overtime_minutes ? fmtMinutes(s.overtime_minutes) : "—"}</td>
                    <td className="px-space-3 py-space-2">{s.missing_clock_outs || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {fixing?.record && <CorrectDialog row={fixing} onSubmit={(time, note) => correct(fixing.record!.id, time, note)} onClose={() => setFixing(null)} />}
    </PortalShell>
  );
}
