"use client";

import { useState } from "react";
import { Bell, History, IndianRupee, Receipt, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { formatShortDateTime } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { NOTIFIABLE_STATUSES, STATUS_LABELS, useFoodOrderDetail } from "@/hooks/useFoodOrders";

const PAYMENT_STATUS_TONE: Record<string, "success" | "warning" | "clay"> = {
  paid: "success",
  pending: "warning",
  failed: "clay",
};

/** Order detail drawer -- the status timeline (migration 0057's order_status_history) and the
 * payment/refund record (migration 0056's payments/refunds). Not a full edit form: refunds here
 * are record-keeping only (no live gateway refund call), same scope db/repositories/payments.py's
 * create_refund() itself documents. */
export function OrderDetailDrawer({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { detail, loading, refunding, notifying, issueRefund, notifyCustomer } =
    useFoodOrderDetail(orderId);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const payment = detail?.payment ?? null;
  const refunds = detail?.refunds ?? [];
  const alreadyRefundedPaise = refunds.reduce((sum, r) => sum + r.amount_paise, 0);
  const remainingPaise = payment ? payment.amount_paise - alreadyRefundedPaise : 0;
  const canRefund = payment?.status === "paid" && remainingPaise > 0;

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amountPaise = Math.round(Number(refundAmount) * 100);
    if (!amountPaise || amountPaise <= 0) {
      setFormError("Enter a refund amount.");
      return;
    }
    if (amountPaise > remainingPaise) {
      setFormError(`Can't refund more than ${rupees(remainingPaise)} remaining.`);
      return;
    }
    const ok = await issueRefund(amountPaise, refundReason);
    if (ok) {
      setRefundAmount("");
      setRefundReason("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[420px] flex-col overflow-y-auto bg-card shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-space-4">
          <h2 className="text-[15px] font-bold text-ink-900">
            Order {detail?.food_order.reference_id ?? `#${orderId}`}
          </h2>
          <div className="flex items-center gap-space-1">
            {detail && NOTIFIABLE_STATUSES.has(detail.food_order.status) && (
              <Button
                type="button"
                size="md"
                variant="secondary"
                disabled={notifying}
                onClick={() => notifyCustomer()}
              >
                <Bell size={14} /> {notifying ? "Sending…" : "Notify customer"}
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-ink-400 hover:bg-black/4 hover:text-ink-900"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && !detail ? (
          <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
        ) : !detail ? (
          <p className="p-space-4 text-[13px] text-error">Couldn&apos;t load this order.</p>
        ) : (
          <div className="flex-1 p-space-4">
            <section className="mb-space-5">
              <h3 className="mb-space-2 flex items-center gap-1 text-[12px] font-semibold text-ink-600">
                <History size={13} /> STATUS TIMELINE
              </h3>
              {detail.status_history.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No transitions recorded yet.</p>
              ) : (
                <ol className="space-y-space-2 border-l border-line pl-space-3">
                  {detail.status_history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-brand-500" />
                      <p className="text-[13px] font-semibold text-ink-900">
                        {STATUS_LABELS[h.to_status] ?? h.to_status}
                      </p>
                      <p className="text-[11.5px] text-ink-500">
                        from {STATUS_LABELS[h.from_status] ?? h.from_status} ·{" "}
                        {formatShortDateTime(h.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="mb-space-5">
              <h3 className="mb-space-2 flex items-center gap-1 text-[12px] font-semibold text-ink-600">
                <IndianRupee size={13} /> PAYMENT
              </h3>
              {!payment ? (
                <p className="text-[12.5px] text-ink-400">
                  Pay at restaurant — no online payment record.
                </p>
              ) : (
                <div className="rounded-md border border-line p-space-3 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900 capitalize">
                      {payment.method}
                      {payment.provider ? ` (${payment.provider})` : ""}
                    </span>
                    <Badge tone={PAYMENT_STATUS_TONE[payment.status] ?? "clay"}>
                      {payment.status}
                    </Badge>
                  </div>
                  <p className="mt-space-1 text-ink-700">{rupees(payment.amount_paise)}</p>
                  {payment.provider_payment_id && (
                    <p className="mt-space-1 font-mono text-[11px] text-ink-500">
                      {payment.provider_payment_id}
                    </p>
                  )}
                  {payment.paid_at && (
                    <p className="mt-space-1 text-[11px] text-ink-500">
                      Paid {formatShortDateTime(payment.paid_at)}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-space-2 flex items-center gap-1 text-[12px] font-semibold text-ink-600">
                <Receipt size={13} /> REFUNDS
              </h3>
              {refunds.length > 0 && (
                <ul className="mb-space-3 space-y-space-2">
                  {refunds.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-line p-space-2 text-[12.5px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink-900">{rupees(r.amount_paise)}</span>
                        <Badge tone="clay">{r.status}</Badge>
                      </div>
                      {r.reason && <p className="mt-space-1 text-ink-600">{r.reason}</p>}
                      <p className="mt-space-1 text-[11px] text-ink-500">
                        {formatShortDateTime(r.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {canRefund ? (
                <form onSubmit={handleRefund} className="rounded-md border border-line p-space-3">
                  <p className="mb-space-2 text-[11.5px] text-ink-500">
                    {rupees(remainingPaise)} available to refund
                  </p>
                  <Field label="Refund Amount (₹)" htmlFor="refund-amount">
                    <Input
                      id="refund-amount"
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                  </Field>
                  <Field label="Reason" htmlFor="refund-reason" hint="Optional">
                    <Input
                      id="refund-reason"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. Item unavailable"
                    />
                  </Field>
                  {formError && (
                    <p className="mb-space-2 text-[12px] font-medium text-error">{formError}</p>
                  )}
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={refunding}
                    className="w-full"
                  >
                    {refunding ? "Recording…" : "Issue Refund"}
                  </Button>
                </form>
              ) : payment?.status === "paid" ? (
                <p className="text-[12.5px] text-ink-400">Fully refunded.</p>
              ) : (
                <p className="text-[12.5px] text-ink-400">No paid payment to refund.</p>
              )}
            </section>
          </div>
        )}
        {detail && NOTIFIABLE_STATUSES.has(detail.food_order.status) && (
          <div className="sticky bottom-0 mt-auto border-t border-line bg-card p-space-4">
            <Button
              type="button"
              className="w-full"
              disabled={notifying}
              onClick={() => notifyCustomer()}
            >
              <Bell size={16} /> {notifying ? "Sending…" : "Notify customer on WhatsApp"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
