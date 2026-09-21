"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";

type Point = { date: string; label: string; count: number };

const BRAND = "#e21220";

function TrendTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{label}</p>
      <p className="text-ink-600">{payload[0].value} {unit}</p>
    </div>
  );
}

/** A count per day for the last 7 days (today included) -- reservations by default, orders on the Orders page. */
export function WeeklyTrendChart({
  data, title = "Reservation trend", unit = "reservations",
}: { data: Point[]; title?: string; unit?: string }) {
  const total = data.reduce((sum, p) => sum + p.count, 0);
  return (
    <Card className="p-space-4">
      <div className="mb-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
        <p className="text-hint">Last 7 days · {total.toLocaleString()} in total</p>
      </div>
      {total === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-400">
          No {unit} in the last 7 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ebe0d6" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 12, fill: "#6b5f56" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b5f56" }} allowDecimals={false} />
            <Tooltip content={<TrendTooltip unit={unit} />} cursor={{ stroke: "#c9b8a8", strokeDasharray: 3 }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={{ r: 3, fill: BRAND, strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
