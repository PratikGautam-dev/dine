"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { fmtDate } from "@/lib/hr";
import { useMyRequests, type CheckinRequest } from "@/hooks/useHr";

const PAST_DAY_LIMIT = 30; // the server's rule (services/attendance.PAST_DAY_LIMIT)

const STATUS: Record<
  CheckinRequest["status"],
  { label: string; tone: "warning" | "success" | "error" }
> = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Declined", tone: "error" },
};

/** A browser-local YYYY-MM-DD `days` ago: only the picker's range, the server judges the day in the shop's zone. */
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA");

function AskMissedDay({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: ReturnType<typeof useMyRequests>["askPastDay"];
}) {
  const [day, setDay] = useState(daysAgo(1));
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    const problem = await onSend({
      work_date: day,
      check_in_time: checkIn,
      check_out_time: checkOut,
      reason: reason.trim(),
    });
    setSending(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Ask for a missed day"
      description={`A day you worked but couldn't clock in (last ${PAST_DAY_LIMIT} days). Your manager approves or declines it.`}
      width="sm"
      footer={
        <div className="flex justify-end gap-space-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={
              sending ||
              !day ||
              !checkIn ||
              !checkOut ||
              reason.trim().length < 5
            }
          >
            {sending ? "Sending…" : "Send request"}
          </Button>
        </div>
      }
    >
      <Field label="Day" htmlFor="md-day" required>
        <Input
          id="md-day"
          type="date"
          min={daysAgo(PAST_DAY_LIMIT)}
          max={daysAgo(1)}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-space-3">
        <Field label="Came in at" htmlFor="md-in" required>
          <Input
            id="md-in"
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </Field>
        <Field
          label="Left at"
          htmlFor="md-out"
          required
          hint="Earlier than the start = after midnight."
        >
          <Input
            id="md-out"
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="Why couldn't you clock in?"
        htmlFor="md-reason"
        required
        error={error ?? undefined}
        hint="For example: phone was dead, signed the register."
      >
        <Textarea
          id="md-reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/** My requests to a manager (clock-ins the shop's check couldn't verify, and missed days), with a button to ask for a missed day. */
export function MyAttendanceRequests({ enabled }: { enabled: boolean }) {
  const { requests, error, askPastDay } = useMyRequests(enabled);
  const [asking, setAsking] = useState(false);
  return (
    <Card className="mb-space-4 min-w-0 p-space-3 md:p-space-4">
      <div className="flex flex-wrap items-center justify-between gap-space-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink-900">
            Requests to your manager
          </h3>
          <p className="text-hint">
            Forgot to clock in on a day you worked? Ask for it here.
          </p>
        </div>
        <PermissionGate page="check_in_out" action="write">
          <Button variant="secondary" onClick={() => setAsking(true)}>
            <CalendarPlus size={16} /> Ask for a missed day
          </Button>
        </PermissionGate>
      </div>
      {error && <p className="mt-space-2 text-[12.5px] text-error">{error}</p>}
      {requests && requests.length > 0 && (
        <ul className="mt-space-3 divide-y divide-line">
          {requests.slice(0, 10).map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-space-2 py-space-2 text-[13px] [overflow-wrap:anywhere]"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink-900">
                  {fmtDate(q.work_date)}{" "}
                  <span className="font-normal text-ink-600">
                    ·{" "}
                    {q.kind === "past_day"
                      ? `Missed day, ${q.requested_local}–${q.check_out_local}`
                      : `Clock-in at ${q.requested_local}`}
                  </span>
                </p>
                <p className="text-hint">“{q.reason}”</p>
                {q.review_note && (
                  <p className="text-hint">
                    {q.reviewed_by_name ?? "Manager"}: {q.review_note}
                  </p>
                )}
              </div>
              <Badge tone={STATUS[q.status].tone}>
                {STATUS[q.status].label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {asking && (
        <AskMissedDay onClose={() => setAsking(false)} onSend={askPastDay} />
      )}
    </Card>
  );
}
