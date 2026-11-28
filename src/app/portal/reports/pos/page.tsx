"use client";

import { AlertTriangle, Banknote, ClipboardList, Receipt, Store, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageTabs } from "@/components/portal/PageTabs";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type PosFlag,
  type PosRange,
  usePosBills,
  usePosDayCloses,
  usePosShifts,
  usePosSummary,
} from "@/hooks/usePosReports";
import { useBranchFilter } from "@/lib/branchContext";
import { formatDateTime, formatMoney } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";

type Tab = "summary" | "bills" | "shifts" | "days";

const TENDERS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  due: "Due (credit)",
};
const TYPES: Record<string, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Flags({ flags }: { flags: PosFlag[] }) {
  if (!flags.length) return null;
  return (
    <span className="flex flex-col gap-0.5">
      {flags.map((f, i) => (
        <span key={i} className="text-[11.5px] text-warning" title={f.message}>
          <AlertTriangle size={11} className="mr-1 inline" />
          {f.message}
        </span>
      ))}
    </span>
  );
}

/** Reports > POS: what the restaurant's tills sold, from the bills, shifts and day closes they uploaded. */
export default function PosReportsPage() {
  const { restaurant, ready } = usePortalGuard();
  const canView = usePermission("reports", "view");
  const { selectedBranchId } = useBranchFilter();
  const today = new Date();
  const [start, setStart] = useState(iso(new Date(today.getTime() - 6 * 86_400_000)));
  const [end, setEnd] = useState(iso(today));
  const [tab, setTab] = useState<Tab>("summary");
  const range: PosRange = { start, end, branchId: selectedBranchId };

  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="reports">
      <PageHeader
        title="POS sales"
        icon={<Store size={22} />}
        description="Bills, shifts and day closes from your POS tills. Online orders are in Analytics."
        actions={
          <div className="flex items-center gap-space-2">
            <Input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              aria-label="From"
              className="h-10 w-40"
            />
            <span className="text-ink-400">to</span>
            <Input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="To"
              className="h-10 w-40"
            />
          </div>
        }
      />
      <p className="mb-space-3 text-[13px] text-ink-600">
        <Link href="/portal/reports" className="font-semibold text-brand-700 underline">
          Back to Analytics
        </Link>
      </p>
      {!canView ? (
        <p className="text-[13px] text-ink-600">Your role can&apos;t see reports.</p>
      ) : (
        <>
          <PageTabs
            tabs={[
              { key: "summary", label: "Summary", icon: <Banknote size={14} /> },
              { key: "bills", label: "Bills", icon: <Receipt size={14} /> },
              { key: "shifts", label: "Shifts", icon: <Wallet size={14} /> },
              { key: "days", label: "Day closes", icon: <ClipboardList size={14} /> },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "summary" && <Summary range={range} />}
          {tab === "bills" && <Bills range={range} />}
          {tab === "shifts" && <Shifts range={range} />}
          {tab === "days" && <Days range={range} />}
        </>
      )}
    </PortalShell>
  );
}

function Summary({ range }: { range: PosRange }) {
  const q = usePosSummary(range);
  if (q.isPending) return <Skeleton className="h-60 w-full" />;
  if (q.error) return <p className="text-[13px] text-error">{q.error.message}</p>;
  const s = q.data;
  const t = s.totals;
  return (
    <>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-4">
        <StatTile
          icon={<Banknote size={22} />}
          label="Sales (incl. GST)"
          value={formatMoney(t.total_paise)}
          deltaPct={null}
          tone="brand"
          filled
        />
        <StatTile
          icon={<Receipt size={22} />}
          label="Bills"
          value={t.bills}
          deltaPct={null}
          hint={t.guests ? `${t.guests} guests` : undefined}
        />
        <StatTile
          icon={<Wallet size={22} />}
          label="Average bill"
          value={formatMoney(t.bills ? Math.round(t.total_paise / t.bills) : 0)}
          deltaPct={null}
        />
        <StatTile
          icon={<AlertTriangle size={22} />}
          label="Flagged bills"
          value={t.flagged_bills}
          deltaPct={null}
          tone={t.flagged_bills ? "warning" : "neutral"}
          hint="Bills the server asked someone to look at"
        />
      </div>
      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-3">
        <Card className="p-space-4">
          <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Totals</h3>
          {[
            ["Gross", t.gross_paise],
            ["Discounts", -t.discount_paise],
            ["Service charge", t.service_charge_paise],
            ["Packaging / delivery", t.charges_paise],
            ["GST", t.tax_paise],
            ["Total", t.total_paise],
            ["Complimentary (value)", t.complimentary_value_paise],
          ].map(([label, v]) => (
            <div key={label as string} className="flex justify-between py-0.5 text-[13px]">
              <span className="text-ink-600">{label}</span>
              <span className="font-medium text-ink-900">{formatMoney(v as number)}</span>
            </div>
          ))}
          <div className="flex justify-between py-0.5 text-[13px]">
            <span className="text-ink-600">Voided items</span>
            <span className="font-medium text-ink-900">{t.voided_items}</span>
          </div>
        </Card>
        <Card className="p-space-4">
          <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">By payment</h3>
          {s.tenders.map((x) => (
            <div key={x.method} className="flex justify-between py-0.5 text-[13px]">
              <span className="text-ink-600">{TENDERS[x.method] ?? x.method}</span>
              <span className="font-medium text-ink-900">{formatMoney(x.amount_paise)}</span>
            </div>
          ))}
          <h3 className="mt-space-3 mb-space-2 text-[14px] font-bold text-ink-900">
            By order type
          </h3>
          {s.order_types.map((x) => (
            <div key={x.order_type} className="flex justify-between py-0.5 text-[13px]">
              <span className="text-ink-600">
                {TYPES[x.order_type] ?? x.order_type} ({x.bills})
              </span>
              <span className="font-medium text-ink-900">{formatMoney(x.total_paise)}</span>
            </div>
          ))}
        </Card>
        <Card className="p-space-4">
          <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Top items</h3>
          {s.top_items.length === 0 && (
            <p className="text-[13px] text-ink-500">Nothing sold in this period.</p>
          )}
          {s.top_items.map((x) => (
            <div
              key={`${x.name}-${x.variant_name}`}
              className="flex justify-between py-0.5 text-[13px]"
            >
              <span className="text-ink-600">
                {x.quantity} × {x.name}
                {x.variant_name ? ` (${x.variant_name})` : ""}
              </span>
              <span className="font-medium text-ink-900">{formatMoney(x.total_paise)}</span>
            </div>
          ))}
        </Card>
      </div>
      {s.days.length > 1 && (
        <Card className="mt-space-4 p-space-4">
          <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">By day</h3>
          {s.days.map((d) => (
            <div key={d.day} className="flex justify-between py-0.5 text-[13px]">
              <span className="text-ink-600">
                {d.day} · {d.bills} bills
              </span>
              <span className="font-medium text-ink-900">{formatMoney(d.total_paise)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Bills({ range }: { range: PosRange }) {
  const [flagged, setFlagged] = useState(false);
  const q = usePosBills(range, flagged);
  return (
    <Card className="p-space-4">
      <label className="mb-space-3 flex items-center gap-space-2 text-[13px] text-ink-700">
        <input
          type="checkbox"
          checked={flagged}
          onChange={(e) => setFlagged(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        Only flagged bills
      </label>
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.error ? (
        <p className="text-[13px] text-error">{q.error.message}</p>
      ) : q.data.bills.length === 0 ? (
        <p className="text-[13px] text-ink-500">No bills in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
                <th className="py-space-2">Bill</th>
                <th>When</th>
                <th>Order</th>
                <th>Cashier</th>
                <th>Paid by</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {q.data.bills.map((b) => (
                <tr key={b.id} className="border-t border-line align-top">
                  <td className="py-space-2 font-medium text-ink-900">
                    {b.bill_no}
                    {b.status !== "settled" && (
                      <Badge
                        className="ml-space-1"
                        tone={b.status === "due" ? "warning" : "violet"}
                      >
                        {b.status === "due" ? "Credit" : "NC"}
                      </Badge>
                    )}
                    <Flags flags={b.flags} />
                  </td>
                  <td>{formatDateTime(b.settled_at)}</td>
                  <td>
                    {TYPES[b.order_type]}
                    {b.table_name
                      ? ` · ${b.table_name}`
                      : b.token_no
                        ? ` · Token ${b.token_no}`
                        : ""}
                  </td>
                  <td>{b.cashier_name}</td>
                  <td>{b.paid_by ?? "—"}</td>
                  <td className="text-right font-medium">{formatMoney(b.total_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Shifts({ range }: { range: PosRange }) {
  const q = usePosShifts(range);
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.error) return <p className="text-[13px] text-error">{q.error.message}</p>;
  if (!q.data.shifts.length)
    return <p className="text-[13px] text-ink-500">No shifts closed in this period.</p>;
  return (
    <Card className="overflow-x-auto p-space-4">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
            <th className="py-space-2">Cashier</th>
            <th>Till</th>
            <th>Closed</th>
            <th className="text-right">Float</th>
            <th className="text-right">Cash sales</th>
            <th className="text-right">Expected</th>
            <th className="text-right">Counted</th>
            <th className="text-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {q.data.shifts.map((s) => (
            <tr key={s.id} className="border-t border-line align-top">
              <td className="py-space-2 font-medium text-ink-900">
                {s.cashier_name}
                <Flags
                  flags={s.flags.filter((f) => !["cash_short", "cash_over"].includes(f.code))}
                />
              </td>
              <td>
                {s.branch_name} · {s.terminal_code}
              </td>
              <td>{formatDateTime(s.closed_at)}</td>
              <td className="text-right">{formatMoney(s.opening_float_paise)}</td>
              <td className="text-right">{formatMoney(s.cash_sales_paise)}</td>
              <td className="text-right">{formatMoney(s.expected_cash_paise)}</td>
              <td className="text-right">{formatMoney(s.counted_cash_paise)}</td>
              <td
                className={`text-right font-semibold ${s.difference_paise < 0 ? "text-error" : s.difference_paise > 0 ? "text-warning" : "text-success"}`}
              >
                {s.difference_paise === 0
                  ? "Matches"
                  : `${s.difference_paise < 0 ? "Short " : "Over "}${formatMoney(Math.abs(s.difference_paise))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Days({ range }: { range: PosRange }) {
  const q = usePosDayCloses(range);
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.error) return <p className="text-[13px] text-error">{q.error.message}</p>;
  if (!q.data.day_closes.length)
    return <p className="text-[13px] text-ink-500">No day closed in this period.</p>;
  return (
    <Card className="overflow-x-auto p-space-4">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
            <th className="py-space-2">Day</th>
            <th>Till</th>
            <th>Closed by</th>
            <th className="text-right">Till&apos;s total</th>
            <th className="text-right">Server&apos;s total</th>
          </tr>
        </thead>
        <tbody>
          {q.data.day_closes.map((d) => (
            <tr key={d.id} className="border-t border-line align-top">
              <td className="py-space-2 font-medium text-ink-900">
                {d.business_day}
                <Flags flags={d.flags} />
              </td>
              <td>
                {d.branch_name} · {d.terminal_code}
              </td>
              <td>
                {d.closed_by} · {formatDateTime(d.closed_at)}
              </td>
              <td className="text-right">
                {formatMoney(d.totals.total_paise)} ({d.totals.bills})
              </td>
              <td className="text-right">
                {formatMoney(d.server_totals.total_paise)} ({d.server_totals.bills})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
