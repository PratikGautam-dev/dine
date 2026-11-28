import Link from "next/link";
import { IndianRupee, ReceiptText, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { rupees } from "@/lib/foodOrders";
import { CHANNEL_LABEL, type GlobalChannel } from "@/lib/globalFilter";
import type { SalesSummary } from "@/hooks/useOrders";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  due: "On credit",
  online: "Paid online",
  pay_at_restaurant: "Pay at restaurant",
};

function pct(now: number, before: number | undefined): number | null {
  return before ? Math.round(((now - before) / before) * 100) : null;
}

/** The Dashboard's Sales row: what sold in the period across every channel -- WhatsApp, Website, App, skipQ and the tills -- with the
 * period before it, by channel, by day, the top dishes and how it was paid. */
export function SalesRow({
  sales,
  compareHint,
  periodText,
}: {
  sales: SalesSummary;
  compareHint: string;
  periodText: string;
}) {
  const prev = sales.previous;
  const total = sales.revenue_paise;
  const days = sales.by_day.map((d) => ({
    date: d.date,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString(
      "en-IN",
      sales.by_day.length <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" },
    ),
    count: Math.round(d.revenue_paise / 100),
  }));

  return (
    <section aria-label="Sales" className="mb-space-4">
      <div className="mb-space-3 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatTile
          tone="success"
          icon={<IndianRupee size={22} />}
          label="Sales"
          value={rupees(total)}
          deltaPct={pct(total, prev?.revenue_paise)}
          hint={compareHint}
        />
        <StatTile
          tone="brand"
          icon={<ShoppingBag size={22} />}
          label="Orders"
          value={sales.orders}
          deltaPct={pct(sales.orders, prev?.orders)}
          hint={compareHint}
        />
        <StatTile
          tone="violet"
          icon={<ReceiptText size={22} />}
          label="Average order"
          value={rupees(sales.average_order_paise)}
          deltaPct={pct(sales.average_order_paise, prev?.average_order_paise)}
          hint={compareHint}
        />
        <Card className="col-span-2 p-space-3 xl:col-span-1">
          <div className="mb-space-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-ink-900">By channel</h3>
            <Link
              href="/portal/orders"
              className="text-[12px] font-semibold text-brand-700 hover:underline"
            >
              All orders
            </Link>
          </div>
          {sales.by_channel.length === 0 ? (
            <p className="text-[12.5px] text-ink-400">No sales in this period.</p>
          ) : (
            <ul className="space-y-1.5 text-[12.5px]">
              {sales.by_channel.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-space-2">
                  <span className="text-ink-700">
                    {CHANNEL_LABEL[c.key as GlobalChannel] ?? c.key}
                  </span>
                  <span className="tabular-nums text-ink-600">
                    {c.orders} ·{" "}
                    <span className="font-semibold text-ink-900">{rupees(c.revenue_paise)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyTrendChart
            data={days}
            title="Sales by day (₹)"
            unit="rupees"
            periodLabel={periodText}
          />
        </div>
        <Card className="p-space-4">
          <h3 className="text-[15px] font-bold text-ink-900">Top dishes</h3>
          {sales.top_items.length === 0 ? (
            <p className="mt-space-2 text-[13px] text-ink-400">Nothing sold in this period.</p>
          ) : (
            <ol className="mt-space-2 space-y-1.5 text-[13px]">
              {sales.top_items.map((t, i) => (
                <li key={t.name} className="flex justify-between gap-space-2">
                  <span className="min-w-0 truncate text-ink-900">
                    <span className="mr-1 text-ink-400">{i + 1}.</span>
                    {t.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-600">{t.quantity} sold</span>
                </li>
              ))}
            </ol>
          )}
          {sales.payment_mix.length > 0 && (
            <>
              <h3 className="mt-space-4 text-[13px] font-bold text-ink-900">How it was paid</h3>
              <ul className="mt-space-2 space-y-1.5 text-[12.5px]">
                {sales.payment_mix.map((p) => (
                  <li key={p.method} className="flex justify-between gap-space-2">
                    <span className="text-ink-700">{METHOD_LABEL[p.method] ?? p.method}</span>
                    <span className="tabular-nums text-ink-900">{rupees(p.revenue_paise)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {sales.complimentary.bills > 0 && (
            <p className="mt-space-3 text-[12px] text-ink-400">
              {sales.complimentary.bills} complimentary{" "}
              {sales.complimentary.bills === 1 ? "bill" : "bills"} ·{" "}
              {rupees(sales.complimentary.value_paise)} not charged
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}
