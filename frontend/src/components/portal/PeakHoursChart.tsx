"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";

const BRAND = "#e21220";

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

function HourTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { hour: number } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{hourLabel(payload[0].payload.hour)}</p>
      <p className="text-ink-600">{payload[0].value} orders</p>
    </div>
  );
}

/** Orders by hour of the day (24 counts, local time) over the period the caller counted. */
export function PeakHoursChart({ hours, periodLabel }: { hours: number[]; periodLabel: string }) {
  const total = hours.reduce((a, b) => a + b, 0);
  const data = hours.map((count, hour) => ({ hour, count }));
  return (
    <Card className="p-space-4">
      <div className="mb-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">Peak order hours</h3>
        <p className="text-hint">{periodLabel}</p>
      </div>
      {total === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-400">No orders in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#ebe0d6" vertical={false} />
            <XAxis
              dataKey="hour" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} interval={2}
              tickFormatter={(h: number) => hourLabel(h)} tick={{ fontSize: 11, fill: "#6b5f56" }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b5f56" }} allowDecimals={false} />
            <Tooltip content={<HourTooltip />} cursor={{ fill: "rgba(226,18,32,0.06)" }} />
            <Bar dataKey="count" fill={BRAND} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
