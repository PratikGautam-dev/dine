"use client";

import { useState } from "react";
import { CalendarClock, CalendarDays, CircleCheck, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { LEAVE_STATUS_TONE, LEAVE_TYPE_LABEL, fmtDateRange } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useMyLeave, type LeaveForm } from "@/hooks/useHr";

const SELECT_CLASS = "h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";
const blank = (): LeaveForm => ({ leave_type: "casual", from_date: "", to_date: "", is_half_day: false, reason: "" });

const days = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;

export default function MyLeavePage() {
  const session = useStaffSession();
  const canView = usePermission("my_leave", "view");
  const { balance, requests, types, error, apply, cancel } = useMyLeave(canView);
  const [form, setForm] = useState<LeaveForm>(blank());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<LeaveForm>) => setForm((f) => ({ ...f, ...patch }));
  const sameDay = form.from_date !== "" && (form.to_date === "" || form.to_date === form.from_date);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="leave">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to leave.</p>
      </PortalShell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const problem = await apply({ ...form, to_date: form.to_date || form.from_date, is_half_day: form.is_half_day && sameDay });
    setSaving(false);
    if (problem) setFormError(problem);
    else setForm(blank());
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="leave">
      <PageHeader title="My Leave" description="Ask for time off and see where your requests stand." />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <StatTile icon={<CalendarDays size={22} />} label="Yearly allowance" value={balance?.allowance ?? 0} deltaPct={null} hint={balance ? `${balance.year} · in days` : "In days"} tone="brand" filled />
        <StatTile icon={<Hourglass size={22} />} label="Used" value={balance?.used ?? 0} deltaPct={null} hint="In days" tone="warning" filled />
        <StatTile icon={<CalendarClock size={22} />} label="Waiting for approval" value={balance?.pending ?? 0} deltaPct={null} hint="In days" tone="info" filled />
        <StatTile icon={<CircleCheck size={22} />} label="Remaining" value={balance?.remaining ?? 0} deltaPct={null} hint="In days" tone="violet" filled />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit p-space-5">
          <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">Ask for leave</h2>
          <form onSubmit={submit} aria-label="Ask for leave">
            <Field label="Type" htmlFor="lv-type">
              <select id="lv-type" className={SELECT_CLASS} value={form.leave_type} onChange={(e) => set({ leave_type: e.target.value })}>
                {(types.length ? types : Object.keys(LEAVE_TYPE_LABEL)).map((t) => (
                  <option key={t} value={t}>{LEAVE_TYPE_LABEL[t] ?? t}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-space-3">
              <Field label="From" htmlFor="lv-from" required>
                <Input id="lv-from" type="date" value={form.from_date} onChange={(e) => set({ from_date: e.target.value, to_date: form.to_date && form.to_date >= e.target.value ? form.to_date : e.target.value })} required />
              </Field>
              <Field label="To" htmlFor="lv-to" required>
                <Input id="lv-to" type="date" min={form.from_date} value={form.to_date} onChange={(e) => set({ to_date: e.target.value })} required />
              </Field>
            </div>
            {sameDay && (
              <CheckboxRow checked={form.is_half_day} onChange={(checked) => set({ is_half_day: checked })}>
                Half day only
              </CheckboxRow>
            )}
            <Field label="Reason" htmlFor="lv-reason" required className="mt-space-3">
              <Textarea id="lv-reason" rows={3} value={form.reason} onChange={(e) => set({ reason: e.target.value })} required />
            </Field>
            {formError && <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">{formError}</p>}
            <Button type="submit" disabled={saving || !form.from_date || !form.reason.trim()}>{saving ? "Sending…" : "Send request"}</Button>
          </form>
        </Card>

        <Card className="p-space-5">
          <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">My requests</h2>
          {!requests ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-[13px] text-ink-400">You haven&apos;t asked for any leave yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} data-testid="leave-row" className="flex flex-col gap-space-2 py-space-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink-900">
                      {LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type} · {fmtDateRange(r.from_date, r.to_date)} · {r.is_half_day ? "half day" : days(r.days)}
                    </p>
                    <p className="text-[12.5px] text-ink-600">{r.reason}</p>
                    {r.decision_note && <p className="mt-0.5 text-[12.5px] text-ink-600">Manager&apos;s note: {r.decision_note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-space-2">
                    <Badge tone={LEAVE_STATUS_TONE[r.status]}>{r.status}</Badge>
                    {r.status === "pending" && (
                      <Button variant="secondary" size="md" onClick={() => cancel(r.id)}>Withdraw</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PortalShell>
  );
}
