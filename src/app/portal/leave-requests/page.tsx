"use client";

import { useState } from "react";
import { CalendarCheck, CalendarOff, CalendarX, Hourglass } from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/erp/StatTile";
import { cn } from "@/lib/cn";
import { LEAVE_STATUS_TONE, LEAVE_TYPE_LABEL, fmtDateRange } from "@/lib/hr";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { roleLabel } from "@/lib/staffRoles";
import { useLeaveRequests, type LeaveRequest } from "@/hooks/useHr";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Declined" },
  { value: "", label: "All" },
];

function RequestCard({
  r,
  onDecide,
}: {
  r: LeaveRequest;
  onDecide: (
    id: string,
    action: "approve" | "reject",
    note: string,
  ) => Promise<string | null>;
}) {
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

  const crowded = r.conflicts && r.conflicts.branch_off > 0;
  return (
    <Card
      className="min-w-0 p-space-3 [overflow-wrap:anywhere] md:p-space-4"
      data-testid="leave-request"
    >
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <div>
          <p className="text-[14px] font-semibold text-ink-900">
            {r.staff_name}
          </p>
          <p className="text-[12px] text-ink-600">
            {[r.staff_role ? roleLabel(r.staff_role) : null, r.branch_name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge tone={LEAVE_STATUS_TONE[r.status]}>{r.status}</Badge>
      </div>
      <p className="mt-space-2 text-[13.5px] text-ink-900">
        {LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type} ·{" "}
        {fmtDateRange(r.from_date, r.to_date)} ·{" "}
        {r.is_half_day ? "half day" : `${r.days} day${r.days === 1 ? "" : "s"}`}
      </p>
      <p className="text-[13px] text-ink-600">“{r.reason}”</p>
      {r.status === "pending" && (
        <>
          <p
            className={cn(
              "mt-space-2 text-[12.5px]",
              crowded ? "font-semibold text-clay-700" : "text-ink-600",
            )}
          >
            {crowded
              ? `${r.conflicts!.branch_off} of the ${r.conflicts!.branch_total} people at ${r.branch_name ?? "their branch"} already off then.`
              : `No one else at ${r.branch_name ?? "their branch"} is off then.`}
            {r.balance &&
              ` ${r.balance.remaining} day${r.balance.remaining === 1 ? "" : "s"} of allowance left.`}
          </p>
          <PermissionGate page="leave_requests" action="write">
            <div className="mobile-page-actions mt-space-3 flex flex-col gap-space-2 md:flex-row md:items-center">
              <Input
                aria-label="Note (optional)"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="md:max-w-xs"
              />
              <Button disabled={busy} onClick={() => decide("approve")}>
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => decide("reject")}
              >
                Decline
              </Button>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-space-2 text-[12.5px] font-medium text-error"
              >
                {error}
              </p>
            )}
          </PermissionGate>
        </>
      )}
      {r.status !== "pending" && r.decision_note && (
        <p className="mt-space-2 text-[12.5px] text-ink-600">
          Note: {r.decision_note}
        </p>
      )}
    </Card>
  );
}

export default function LeaveRequestsPage() {
  const session = useStaffSession();
  const canView = usePermission("leave_requests", "view");
  const [status, setStatus] = useState("pending");
  const { requests, summary, allowance, error, decide, saveAllowance } =
    useLeaveRequests(canView, status);
  const [draft, setDraft] = useState<string>("");
  const [allowanceError, setAllowanceError] = useState<string | null>(null);

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant ?? null} active="leave-requests">
        <p className="text-[13px] text-ink-400">
          You don&apos;t have access to the leave review queue.
        </p>
      </PortalShell>
    );
  }

  async function submitAllowance(e: React.FormEvent) {
    e.preventDefault();
    setAllowanceError(null);
    const value = Number(draft);
    const problem = Number.isInteger(value)
      ? await saveAllowance(value)
      : "Enter a whole number of days.";
    if (problem) setAllowanceError(problem);
    else setDraft("");
  }

  return (
    <PortalShell restaurant={session?.restaurant ?? null} active="leave-requests">
      <PageHeader
        title="Leave Requests"
        description="Approve or decline your team's leave, and set the yearly allowance."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatTile
          stackOnMobile
          loading={!summary && !error}
          icon={<Hourglass size={22} />}
          label="Pending"
          value={summary?.pending ?? 0}
          deltaPct={null}
          hint="Awaiting a decision"
          tone="warning"
          filled
        />
        <StatTile
          stackOnMobile
          loading={!summary && !error}
          icon={<CalendarCheck size={22} />}
          label="Approved"
          value={summary?.approved ?? 0}
          deltaPct={null}
          hint="This period"
          tone="brand"
          filled
        />
        <StatTile
          stackOnMobile
          loading={!summary && !error}
          icon={<CalendarX size={22} />}
          label="Declined"
          value={summary?.rejected ?? 0}
          deltaPct={null}
          hint="This period"
          tone="clay"
          filled
        />
        <StatTile
          stackOnMobile
          loading={!summary && !error}
          icon={<CalendarOff size={22} />}
          label="On leave today"
          value={summary?.on_leave_today ?? 0}
          deltaPct={null}
          hint="Right now"
          tone="violet"
          filled
        />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-space-3 grid grid-cols-4 gap-space-2 border-b border-line md:flex md:flex-wrap md:gap-space-5">
            {TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setStatus(t.value)}
                className={cn(
                  "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
                  status === t.value
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-ink-600 hover:text-ink-900",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!requests ? (
            <SkeletonLines rows={3} />
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

        <Card className="min-w-0 h-fit p-space-3 md:p-space-5">
          <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
            Yearly allowance
          </h2>
          <p className="mb-space-3 text-[13px] text-ink-600">
            Everyone gets{" "}
            <strong data-testid="allowance-current">{allowance ?? "—"}</strong>{" "}
            days a year (unpaid leave doesn&apos;t count against it).
          </p>
          <PermissionGate page="leave_requests" action="write">
            <form onSubmit={submitAllowance} aria-label="Set yearly allowance">
              <Field label="New allowance (days)" htmlFor="allowance">
                <Input
                  id="allowance"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={String(allowance ?? 20)}
                />
              </Field>
              {allowanceError && (
                <p
                  role="alert"
                  className="mb-space-2 text-[12.5px] font-medium text-error"
                >
                  {allowanceError}
                </p>
              )}
              <Button
                className="mobile-page-action"
                type="submit"
                disabled={draft === ""}
              >
                Save
              </Button>
            </form>
          </PermissionGate>
        </Card>
      </div>
    </PortalShell>
  );
}
