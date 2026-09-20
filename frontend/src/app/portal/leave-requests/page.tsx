"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { cn } from "@/lib/cn";
import { LEAVE_STATUS_TONE, LEAVE_TYPE_LABEL, fmtDateRange } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { ROLE_LABEL } from "@/lib/staffRoles";
import { useLeaveRequests, type LeaveRequest } from "@/hooks/useHr";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Declined" },
  { value: "", label: "All" },
];

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-space-4">
      <p className="text-label mb-space-2 font-medium text-ink-600">{label}</p>
      <span className="text-[28px] leading-none font-semibold text-ink-900">{value}</span>
    </Card>
  );
}

function RequestCard({ r, onDecide }: { r: LeaveRequest; onDecide: (id: number, action: "approve" | "reject", note: string) => Promise<string | null> }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const problem = await onDecide(r.id, action, note);
    setBusy(false);
    if (problem) setError(problem);
  }

  const crowded = r.conflicts && r.conflicts.role_off > 0;
  return (
    <Card className="p-space-4" data-testid="leave-request">
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <div>
          <p className="text-[14px] font-semibold text-ink-900">{r.staff_name}</p>
          <p className="text-[12px] text-ink-600">{ROLE_LABEL[(r.staff_role ?? "receptionist") as keyof typeof ROLE_LABEL]}</p>
        </div>
        <Badge tone={LEAVE_STATUS_TONE[r.status]}>{r.status}</Badge>
      </div>
      <p className="mt-space-2 text-[13.5px] text-ink-900">
        {LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type} · {fmtDateRange(r.from_date, r.to_date)} · {r.is_half_day ? "half day" : `${r.days} day${r.days === 1 ? "" : "s"}`}
      </p>
      <p className="text-[13px] text-ink-600">“{r.reason}”</p>
      {r.status === "pending" && (
        <>
          <p className={cn("mt-space-2 text-[12.5px]", crowded ? "font-semibold text-clay-700" : "text-ink-600")}>
            {crowded
              ? `${r.conflicts!.role_off} of ${r.conflicts!.role_total} other ${ROLE_LABEL[(r.staff_role ?? "receptionist") as keyof typeof ROLE_LABEL]} team member${r.conflicts!.role_total === 1 ? "" : "s"} already off then.`
              : "No one else in their role is off then."}
            {r.balance && ` ${r.balance.remaining} day${r.balance.remaining === 1 ? "" : "s"} of allowance left.`}
          </p>
          <PermissionGate page="leave_requests" action="write">
            <div className="mt-space-3 flex flex-col gap-space-2 sm:flex-row sm:items-center">
              <Input aria-label="Note (optional)" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="sm:max-w-xs" />
              <Button disabled={busy} onClick={() => decide("approve")}>Approve</Button>
              <Button variant="secondary" disabled={busy} onClick={() => decide("reject")}>Decline</Button>
            </div>
            {error && <p role="alert" className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
          </PermissionGate>
        </>
      )}
      {r.status !== "pending" && r.decision_note && <p className="mt-space-2 text-[12.5px] text-ink-600">Note: {r.decision_note}</p>}
    </Card>
  );
}

export default function LeaveRequestsPage() {
  const session = useStaffSession();
  const canView = usePermission("leave_requests", "view");
  const [status, setStatus] = useState("pending");
  const { requests, summary, allowance, error, decide, saveAllowance } = useLeaveRequests(canView, status);
  const [draft, setDraft] = useState<string>("");
  const [allowanceError, setAllowanceError] = useState<string | null>(null);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="leave-requests">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to the leave review queue.</p>
      </PortalShell>
    );
  }

  async function submitAllowance(e: React.FormEvent) {
    e.preventDefault();
    setAllowanceError(null);
    const value = Number(draft);
    const problem = Number.isInteger(value) ? await saveAllowance(value) : "Enter a whole number of days.";
    if (problem) setAllowanceError(problem);
    else setDraft("");
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="leave-requests">
      <PageHeader title="Leave Requests" description="Approve or decline your team's leave, and set the yearly allowance." />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <Tile label="Pending" value={summary?.pending ?? 0} />
        <Tile label="Approved" value={summary?.approved ?? 0} />
        <Tile label="Declined" value={summary?.rejected ?? 0} />
        <Tile label="On leave today" value={summary?.on_leave_today ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-space-3 flex flex-wrap gap-space-2">
            {TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setStatus(t.value)}
                className={cn(
                  "rounded-full px-space-3 py-1.5 text-[13px] font-semibold transition-colors duration-150",
                  status === t.value ? "bg-brand-600 text-white" : "bg-paper text-ink-600 hover:text-ink-900",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!requests ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-[13px] text-ink-400">Nothing here.</p>
          ) : (
            <div className="flex flex-col gap-space-3">
              {requests.map((r) => (
                <RequestCard key={r.id} r={r} onDecide={decide} />
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit p-space-5">
          <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">Yearly allowance</h2>
          <p className="mb-space-3 text-[13px] text-ink-600">
            Everyone gets <strong data-testid="allowance-current">{allowance ?? "—"}</strong> days a year (unpaid leave doesn&apos;t count against it).
          </p>
          <PermissionGate page="leave_requests" action="write">
            <form onSubmit={submitAllowance} aria-label="Set yearly allowance">
              <Field label="New allowance (days)" htmlFor="allowance">
                <Input id="allowance" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={String(allowance ?? 20)} />
              </Field>
              {allowanceError && <p role="alert" className="mb-space-2 text-[12.5px] font-medium text-error">{allowanceError}</p>}
              <Button type="submit" disabled={draft === ""}>Save</Button>
            </form>
          </PermissionGate>
        </Card>
      </div>
    </PortalShell>
  );
}
