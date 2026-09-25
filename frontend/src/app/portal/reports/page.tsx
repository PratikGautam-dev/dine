"use client";

import { useMemo, useState } from "react";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  BarChart3, Banknote, CalendarCheck, Download, FileSpreadsheet, FileText, Repeat, ShoppingBag, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PeakHoursChart } from "@/components/portal/PeakHoursChart";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { rupees } from "@/lib/foodOrders";
import { toast } from "@/lib/toast";
import { useReports } from "@/hooks/useReports";

const RANGES = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
];
const CHANNEL_CHIPS = ["All Channels", "WhatsApp", "Dine-in", "Takeaway", "Delivery"];
const BRAND = "#e21220";
const BLUE = "#2f6fed";

// Payment Method Split: no card/UPI/cash/wallet tracking exists in this app (only "online" vs
// "pay_at_restaurant") -- this is a decorative, client-side-only illustrative split over the real
// transaction count, computed fresh each render and never written to the database. Swap for a real
// breakdown once payment methods are actually tracked per the plan to build this out further.
const PAYMENT_SPLIT_RATIOS: { label: string; pct: number }[] = [
  { label: "UPI", pct: 0.47 }, { label: "Card", pct: 0.2 }, { label: "Cash", pct: 0.16 },
  { label: "Wallets", pct: 0.11 }, { label: "Other", pct: 0.06 },
];

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue_paise")?.value ?? 0;
  const orders = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{label}</p>
      <p className="text-success">{rupees(revenue)} revenue</p>
      <p className="text-ink-600">{orders} order{orders === 1 ? "" : "s"}</p>
    </div>
  );
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  Takeaway: <ShoppingBag size={14} />, Delivery: <ShoppingBag size={14} />, "Dine-in": <CalendarCheck size={14} />,
};

export default function PortalReportsPage() {
  const { hospital, ready } = usePortalGuard();
  const [days, setDays] = useState(30);
  const [channel, setChannel] = useState("All Channels");
  const { data, error } = useReports(ready, days);

  const paymentSplit = useMemo(() => {
    if (!data) return [];
    return PAYMENT_SPLIT_RATIOS.map((r) => ({ department_name: r.label, count: Math.round(data.kpis.total_orders * r.pct) }));
  }, [data]);

  function handleChannelTap(c: string) {
    setChannel(c);
    if (c !== "All Channels") toast.success("Per-channel filtering is coming soon", "Showing all channels for now.");
  }

  function handleDownload(kind: string) {
    toast.success(`${kind} export is coming soon`);
  }

  return (
    <PortalShell hospital={hospital} active="reports">
        <PageHeader
          title="Reports"
          icon={<BarChart3 size={22} />}
          description="Insights from your WhatsApp orders and table reservations."
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        <div className="mb-space-4 flex flex-wrap items-center gap-space-2">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setDays(r.days)}
              className={cn(
                "rounded-md px-space-3 py-2 text-[13px] font-semibold transition-colors duration-150",
                days === r.days ? "bg-brand-600 text-white" : "border border-line bg-card text-ink-600 hover:bg-paper",
              )}
            >
              {r.label}
            </button>
          ))}
          <span className="mx-space-1 h-6 w-px bg-line" />
          {CHANNEL_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleChannelTap(c)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-space-3 py-2 text-[13px] font-semibold transition-colors duration-150",
                channel === c ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "border border-line bg-card text-ink-600 hover:bg-paper",
              )}
            >
              {c === "WhatsApp" && <WhatsAppIcon size={13} />}
              {c}
            </button>
          ))}
        </div>

        {!data ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : (
          <>
            <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile
                icon={<Banknote size={22} />} label="Total revenue" value={Math.round(data.kpis.total_revenue_paise / 100)}
                prefix="₹" deltaPct={data.kpis.total_revenue_change_pct} tone="brand" filled
              />
              <StatTile
                icon={<ShoppingBag size={22} />} label="Total orders" value={data.kpis.total_orders}
                deltaPct={data.kpis.total_orders_change_pct} tone="warning" filled
              />
              <StatTile
                icon={<CalendarCheck size={22} />} label="Total reservations" value={data.kpis.total_reservations}
                deltaPct={data.kpis.total_reservations_change_pct} tone="info" filled
              />
              <StatTile
                icon={<Wallet size={22} />} label="Average order value" value={Math.round(data.kpis.average_order_value_paise / 100)}
                prefix="₹" deltaPct={data.kpis.average_order_value_change_pct} tone="clay" filled
              />
              <StatTile
                icon={<Repeat size={22} />} label="Repeat customers" value={data.kpis.repeat_customers_pct ?? 0}
                deltaPct={null} hint={data.kpis.repeat_customers_pct === null ? "No visits yet" : `Of ${data.kpis.total_customers} guests`}
                tone="violet" filled
              />
            </div>

            <div className="mb-space-4 grid grid-cols-1 gap-space-4 xl:grid-cols-[1.4fr_1fr_1fr]">
              <Card className="p-space-4">
                <div className="mb-space-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-ink-900">Revenue &amp; Orders Trend</h3>
                  <div className="flex items-center gap-space-3 text-[11.5px] text-ink-600">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Revenue (₹)</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: BLUE }} /> Orders</span>
                  </div>
                </div>
                {data.trend.every((t) => t.orders === 0) ? (
                  <div className="flex h-[240px] items-center justify-center text-[13px] text-ink-400">No orders in this period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={data.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#ebe0d6" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} interval="preserveStartEnd" />
                      <YAxis yAxisId="revenue" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} tickFormatter={(v: number) => rupees(v)} />
                      <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} allowDecimals={false} />
                      <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#c9b8a8", strokeDasharray: 3 }} />
                      <Area yAxisId="revenue" type="monotone" dataKey="revenue_paise" stroke="#22c55e" strokeWidth={2} fill="url(#reportsRevenueFill)" dot={false} />
                      <Line yAxisId="orders" type="monotone" dataKey="orders" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE, strokeWidth: 2, stroke: "#fff" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="p-space-4">
                <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Channel Performance (Orders)</h3>
                <div className="space-y-space-3">
                  {data.channel_breakdown.map((c) => {
                    const maxOrders = Math.max(...data.channel_breakdown.map((x) => x.total_orders), 1);
                    return (
                      <div key={c.channel}>
                        <div className="mb-1 flex items-center justify-between text-[12.5px]">
                          <span className="flex items-center gap-1.5 font-semibold text-ink-900">{CHANNEL_ICON[c.channel]} {c.channel}</span>
                          <span className="tabular-nums text-ink-600">{c.total_orders}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-black/4">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${(c.total_orders / maxOrders) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <DepartmentDonut
                data={data.channel_breakdown.map((c) => ({ department_name: c.channel, count: Math.round(c.revenue_paise / 100) }))}
                title="Revenue by Channel"
                subtitle={`Last ${days} day${days === 1 ? "" : "s"} · Dine-in revenue is estimated`}
                unit="₹"
                emptyText="No revenue in this period."
              />
            </div>

            <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
              <DepartmentDonut
                data={data.reservation_outcomes}
                title="Bookings vs No-shows"
                subtitle={`Last ${days} day${days === 1 ? "" : "s"}`}
                unit="reservations"
                emptyText="No reservations in this period."
              />
              <PeakHoursChart hours={data.peak_order_hours} periodLabel={`Last ${days} days`} />
              <DepartmentDonut
                data={paymentSplit}
                title="Payment Method Split"
                subtitle="Illustrative -- not tracked yet"
                unit="orders"
                emptyText="No orders in this period."
              />
            </div>

            <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-[1fr_1fr]">
              <Card className="p-space-4">
                <div className="mb-space-3">
                  <h3 className="text-[15px] font-bold text-ink-900">Top Selling Items</h3>
                  <p className="text-hint">By quantity, last {days} days</p>
                </div>
                {data.top_items.length === 0 ? (
                  <div className="flex h-[160px] items-center justify-center text-[13px] text-ink-400">No orders in this period.</div>
                ) : (
                  <ol className="divide-y divide-line">
                    {data.top_items.map((item, i) => (
                      <li key={item.name} className="flex items-center gap-space-3 py-space-2">
                        <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">{item.name}</span>
                        <span className="text-right text-[12.5px] tabular-nums text-ink-600">{item.orders} sold</span>
                        <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-ink-900">{rupees(item.revenue_paise)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <Card className="p-space-4">
                <div className="mb-space-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-bold text-ink-900">Customer Retention</h3>
                    <p className="text-hint">Repeat-guest share, by week</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[20px] leading-none font-bold text-ink-900">{data.kpis.repeat_customers_pct ?? 0}%</p>
                    <p className="text-[11px] text-ink-600">Repeat customers</p>
                  </div>
                </div>
                {data.retention_trend.every((t) => t.repeat_pct === 0) ? (
                  <div className="flex h-[180px] items-center justify-center text-[13px] text-ink-400">Not enough visit history yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={data.retention_trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="#ebe0d6" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} unit="%" />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Repeat"]}
                        contentStyle={{ fontSize: 12.5, borderRadius: 8, borderColor: "var(--line)" }}
                      />
                      <Line type="monotone" dataKey="repeat_pct" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            <Card className="p-space-4">
              <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Download Reports</h3>
              <div className="flex flex-wrap gap-space-2">
                {[
                  { label: "Sales Report (PDF)", icon: FileText },
                  { label: "Orders Report (Excel)", icon: FileSpreadsheet },
                  { label: "Customer Report (CSV)", icon: Download },
                  { label: "Booking Report (PDF)", icon: FileText },
                ].map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleDownload(label)}
                    className="inline-flex items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] font-semibold text-ink-700 hover:bg-paper"
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
    </PortalShell>
  );
}
