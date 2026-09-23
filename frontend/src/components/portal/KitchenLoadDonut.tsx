"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";

type Slice = { label: string; value: number; color: string };

/** The real breakdown of today's active orders by stage -- same three real buckets the column
 * board above it uses, just as a donut instead of three separate counts. */
export function KitchenLoadDonut({ newOrders, preparing, ready }: { newOrders: number; preparing: number; ready: number }) {
  const total = newOrders + preparing + ready;
  const slices: Slice[] = [
    { label: "New Orders", value: newOrders, color: "var(--success)" },
    { label: "In Preparation", value: preparing, color: "var(--warning)" },
    { label: "Ready to Serve", value: ready, color: "var(--info)" },
  ];

  return (
    <Card className="p-space-4">
      <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Kitchen Load</h3>
      {total === 0 ? (
        <p className="py-space-6 text-center text-[13px] text-ink-400">No active orders right now.</p>
      ) : (
        <div className="flex items-center gap-space-4">
          <div className="relative h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="label" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                  {slices.map((s) => <Cell key={s.label} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [`${v} orders`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-bold text-ink-900">{total}</span>
              <span className="text-[10px] text-ink-400">Active</span>
            </div>
          </div>
          <div className="flex-1 space-y-space-2">
            {slices.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-1.5 text-ink-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                </span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {s.value} <span className="font-normal text-ink-400">({total ? Math.round((s.value / total) * 100) : 0}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
