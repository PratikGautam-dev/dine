"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Banknote, CalendarCheck, Repeat, ShoppingBag, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PeakHoursChart } from "@/components/portal/PeakHoursChart";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { rupees } from "@/lib/foodOrders";
import { useReports } from "@/hooks/useReports";
import { useState } from "react";

const RANGES = [7, 30, 90];
const BRAND = "#e21220";

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue_paise")?.value ?? 0;
  const orders = payload.find((p) => p.dataKey === "orders")?.value ?? 0;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{label}</p>
      <p className="text-ink-600">{rupees(revenue)} · {orders} order{orders === 1 ? "" : "s"}</p>
    </div>
  );
}

export default function PortalReportsPage() {
  const { hospital, ready } = usePortalGuard();
  const [days, setDays] = useState(30);
  const { data, error } = useReports(ready, days);

  return (
    <PortalShell hospital={hospital} active="reports">
        <PageHeader
          title="Reports"
          icon={<BarChart3 size={22} />}
          description="Insights from your WhatsApp orders and table reservations."
          actions={
            <select
              aria-label="Time range" className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
              value={days} onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          }
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

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

            <Card className="mb-space-4 p-space-4">
              <div className="mb-space-3">
                <h3 className="text-[15px] font-bold text-ink-900">Revenue &amp; Orders Trend</h3>
                <p className="text-hint">Last {days} days</p>
              </div>
              {data.trend.every((t) => t.orders === 0) ? (
                <div className="flex h-[240px] items-center justify-center text-[13px] text-ink-400">No orders in this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ebe0d6" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b5f56" }} tickFormatter={(v: number) => rupees(v)} />
                    <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#c9b8a8", strokeDasharray: 3 }} />
                    <Area
                      type="monotone" dataKey="revenue_paise" stroke={BRAND} strokeWidth={2}
                      fill="url(#reportsRevenueFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
              <DepartmentDonut
                data={data.reservation_outcomes}
                title="Reservation Outcomes"
                subtitle={`Last ${days} days`}
                unit="reservations"
                emptyText="No reservations in this period."
              />
              <PeakHoursChart hours={data.peak_order_hours} periodLabel={`Last ${days} days`} />
            </div>

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
          </>
        )}
    </PortalShell>
  );
}
