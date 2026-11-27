"use client";

import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Textarea } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { type HandoverRecord, useDecideHandover, useHandoverRecords } from "@/hooks/useTerminals";
import { formatDateTime, formatMoney } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

const KIND: Record<HandoverRecord["kind"], string> = {
  bill: "Bill",
  shift: "Shift close",
  day_close: "Day close",
};

/**
 * What revoked terminals of a branch handed over before wiping themselves: bills (and shift and day closes) they never uploaded.
 * Nothing here is in the books yet. Approving books it like any upload, flagged as handed over; rejecting keeps it out, with a note.
 * Hidden when there is nothing to decide.
 */
export function HandoverRecords({ branchId, canManage }: { branchId: string; canManage: boolean }) {
  const list = useHandoverRecords(branchId);
  const decide = useDecideHandover();
  const [rejecting, setRejecting] = useState<HandoverRecord | null>(null);
  const [note, setNote] = useState("");
  const records = list.data?.records ?? [];
  if (records.length === 0) return null;

  function approve(r: HandoverRecord) {
    decide.mutate(
      { id: r.id, decision: "approve", note: null },
      {
        onSuccess: (res) =>
          res.status === "approved"
            ? toast.success(`${KIND[r.kind]} ${r.reference ?? ""} approved and booked`)
            : toast.error("It couldn't be booked", res.error ?? "The record was refused."),
        onError: (e) => toast.error("Couldn't approve it", e.message),
      },
    );
  }

  function reject() {
    if (!rejecting) return;
    if (!note.trim()) return toast.error("Say why it is rejected.");
    decide.mutate(
      { id: rejecting.id, decision: "reject", note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`${KIND[rejecting.kind]} ${rejecting.reference ?? ""} rejected`);
          setRejecting(null);
        },
        onError: (e) => toast.error("Couldn't reject it", e.message),
      },
    );
  }

  return (
    <section className="mt-space-5 rounded-md border border-warning/40 bg-warning-tint p-space-3">
      <h3 className="text-[14px] font-bold text-ink-900">
        Handed over by revoked terminals ({list.data?.total ?? records.length})
      </h3>
      <p className="mb-space-2 text-[12.5px] text-ink-600">
        These were on terminals when they were revoked and never reached the office. They are not in
        your sales until you approve them. Approve what really happened; reject anything you
        don&apos;t recognise.
      </p>
      <ul className="divide-y divide-line">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-space-2 py-space-2 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0 break-words">
              <p className="text-[13.5px] font-semibold text-ink-900">
                <Badge tone="neutral" className="mr-space-1">
                  {KIND[r.kind]}
                </Badge>
                {r.reference ?? "—"}
                {r.total_paise !== null && (
                  <span className="ml-space-2 font-normal">{formatMoney(r.total_paise)}</span>
                )}
              </p>
              <p className="text-[12.5px] text-ink-600">
                {r.terminal_name} ({r.terminal_code}){r.cashier_name ? ` · ${r.cashier_name}` : ""}
                {r.occurred_at ? ` · ${formatDateTime(r.occurred_at)}` : ""}
              </p>
            </div>
            {canManage && (
              <div className="grid grid-cols-2 gap-space-2 md:flex">
                <Button disabled={decide.isPending} onClick={() => approve(r)}>
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  className="text-error"
                  disabled={decide.isPending}
                  onClick={() => {
                    setRejecting(r);
                    setNote("");
                  }}
                >
                  Reject
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        width="sm"
        title={`Reject ${rejecting ? `${KIND[rejecting.kind].toLowerCase()} ${rejecting.reference ?? ""}` : ""}?`}
        description="It stays out of your sales for good. The note is kept in the activity log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button disabled={decide.isPending} onClick={reject}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Why" htmlFor="handover_note">
          <Textarea
            id="handover_note"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Modal>
    </section>
  );
}
