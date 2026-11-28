"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { formatShortDateTime } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { usePosBill, type PosBill } from "@/hooks/useOrders";

const ORDER_TYPE_LABEL: Record<PosBill["order_type"], string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  due: "On credit",
};
const CHARGE_LABEL: Record<string, string> = { packaging: "Packaging", delivery: "Delivery fee" };

export const BILL_STATUS_LABEL: Record<string, string> = {
  settled: "Settled",
  complimentary: "Complimentary",
  due: "On credit",
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-space-3 ${strong ? "font-bold text-ink-900" : "text-ink-600"}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line p-space-4 text-[13px]">
      <h3 className="mb-space-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A bill a till settled, as it was printed: read-only, because the till runs those orders (backend sales/orders.py bill()). */
export function PosBillDrawer({ billId, onClose }: { billId: string; onClose: () => void }) {
  const { bill, error, loading } = usePosBill(billId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={bill ? `Bill ${bill.bill_no}` : "Bill"}
        className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-card shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-space-4">
          <div>
            <h2 className="text-[15px] font-bold text-ink-900">Bill {bill?.bill_no ?? ""}</h2>
            <p className="text-[12px] text-ink-400">Settled on the till · read-only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-space-1 text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {error && <p className="p-space-4 text-[13px] text-error">{error}</p>}
        {loading && !bill && (
          <div className="p-space-4">
            <FormSkeleton />
          </div>
        )}

        {bill && (
          <>
            <Section title="Order">
              <div className="mb-space-2 flex flex-wrap gap-space-2">
                <Badge tone="brand">POS</Badge>
                <Badge tone="violet">{ORDER_TYPE_LABEL[bill.order_type]}</Badge>
                <Badge tone={bill.status === "settled" ? "success" : "warning"}>
                  {BILL_STATUS_LABEL[bill.status] ?? bill.status}
                </Badge>
              </div>
              <div className="space-y-1">
                {bill.table_name && <Row label="Table" value={bill.table_name} />}
                {bill.token_no != null && <Row label="Token" value={String(bill.token_no)} />}
                {bill.guests != null && <Row label="Guests" value={String(bill.guests)} />}
                {(bill.customer_name || bill.customer_phone) && (
                  <Row
                    label="Customer"
                    value={[bill.customer_name, bill.customer_phone].filter(Boolean).join(" · ")}
                  />
                )}
                {bill.customer_gstin && <Row label="GSTIN" value={bill.customer_gstin} />}
                {bill.delivery_address && <Row label="Address" value={bill.delivery_address} />}
                <Row label="Branch" value={bill.branch_name} />
                <Row
                  label="Till"
                  value={
                    bill.terminal_name
                      ? `${bill.terminal_code} · ${bill.terminal_name}`
                      : bill.terminal_code
                  }
                />
                <Row label="Cashier" value={bill.cashier_name} />
                {bill.captain_name && <Row label="Captain" value={bill.captain_name} />}
                <Row label="Opened" value={formatShortDateTime(bill.opened_at)} />
                <Row label="Settled" value={formatShortDateTime(bill.settled_at)} />
                {bill.reprints > 0 && <Row label="Reprinted" value={`${bill.reprints}×`} />}
              </div>
            </Section>

            <Section title="Items">
              <ul className="space-y-space-2">
                {bill.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-space-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {l.quantity} × {l.name}
                        {l.variant_name ? ` (${l.variant_name})` : ""}
                      </p>
                      {l.modifiers.length > 0 && (
                        <p className="text-[12px] text-ink-400">
                          {l.modifiers.map((m) => m.name).join(", ")}
                        </p>
                      )}
                      {l.note && <p className="text-[12px] italic text-ink-400">{l.note}</p>}
                      {l.discount_paise > 0 && (
                        <p className="text-[12px] text-ink-400">
                          − {rupees(l.discount_paise)}
                          {l.discount_reason ? ` · ${l.discount_reason}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums text-ink-900">
                      {rupees(l.total_paise)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Total">
              <div className="space-y-1">
                <Row label="Subtotal" value={rupees(bill.subtotal_paise)} />
                {bill.discount_paise > 0 && (
                  <Row
                    label={`Discount${bill.discount_reason ? ` · ${bill.discount_reason}` : ""}`}
                    value={`− ${rupees(bill.discount_paise)}`}
                  />
                )}
                {bill.service_charge_paise > 0 && (
                  <Row label="Service charge" value={rupees(bill.service_charge_paise)} />
                )}
                {bill.charges.map((c) => (
                  <Row
                    key={c.kind}
                    label={CHARGE_LABEL[c.kind] ?? c.kind}
                    value={rupees(c.taxable_paise)}
                  />
                ))}
                {bill.tax_breakup.map((t) => (
                  <Row
                    key={t.rate_bps}
                    label={`GST ${t.rate_bps / 100}% (CGST + SGST)`}
                    value={rupees(t.cgst_paise + t.sgst_paise)}
                  />
                ))}
                {bill.round_off_paise !== 0 && (
                  <Row label="Round off" value={rupees(bill.round_off_paise)} />
                )}
                <Row label="Total" value={rupees(bill.total_paise)} strong />
                {bill.status === "complimentary" && (
                  <p className="pt-space-1 text-[12px] text-ink-400">
                    Complimentary: {rupees(bill.complimentary_value_paise)} not charged
                    {bill.complimentary_reason ? ` · ${bill.complimentary_reason}` : ""}
                  </p>
                )}
              </div>
            </Section>

            {bill.payments.length > 0 && (
              <Section title="Payments">
                <div className="space-y-1">
                  {bill.payments.map((p, i) => (
                    <Row
                      key={i}
                      label={`${METHOD_LABEL[p.method] ?? p.method}${p.reference ? ` · ${p.reference}` : ""}`}
                      value={rupees(p.amount_paise)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {bill.voids.length > 0 && (
              <Section title="Voided items">
                <ul className="space-y-1">
                  {bill.voids.map((v, i) => (
                    <li key={i} className="text-ink-600">
                      {v.quantity} × {v.name}
                      {v.reason ? ` · ${v.reason}` : ""}
                      {v.approved_by ? ` · approved by ${v.approved_by}` : ""}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {bill.flags.length > 0 && (
              <Section title="Flags">
                <ul className="space-y-1">
                  {bill.flags.map((f) => (
                    <li key={f.code} className="text-warning">
                      {f.message}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {bill.kots.length > 0 && (
              <Section title="Kitchen tickets">
                <p className="text-ink-600">
                  {bill.kots
                    .map((k) => `KOT ${k.kot_no}${k.cancelled ? " (cancelled)" : ""}`)
                    .join(" · ")}
                </p>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
