"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";

type Slice = { department_name: string; count: number };

// Brand red first, then warm neutrals and earth tones -- fixed order, never cycled or reassigned. Adjacent
// slots differ strongly in lightness (red / charcoal / amber / olive / stone ...), and every legend row also
// carries the section name and its share, so colour is never the only way to tell slices apart.
const SLOT_COLORS = ["#e21220", "#2a211c", "#e0a100", "#6b7a4f", "#9c9086", "#f28b82", "#7d361d", "#c9b8a8"];

function DonutTooltip({ active, payload, unit }: { active?: boolean; payload?: { name: string; value: number }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{payload[0].name}</p>
      <p className="text-ink-600">{payload[0].value} {unit}</p>
    </div>
  );
}

/** A donut with a legend of names, counts and shares. Defaults are the Dashboard's: reservations by section over the
 * window its API uses (30 days back and 30 ahead). */
export function DepartmentDonut({
  data, title = "Reservations by section", subtitle = "Past and coming 30 days", unit = "reservations",
  emptyText = "No reservations in the last 30 days or scheduled in the next 30.",
}: { data: Slice[]; title?: string; subtitle?: string; unit?: string; emptyText?: string }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="p-space-4">
      <div className="mb-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
        <p className="text-hint">{subtitle}</p>
      </div>
      {total === 0 ? (
        <div className="flex h-[220px] items-center justify-center px-space-3 text-center text-[13px] text-ink-400">
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-space-3">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="department_name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.department_name} fill={SLOT_COLORS[i % SLOT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip unit={unit} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] leading-none font-bold text-ink-900">{total.toLocaleString()}</span>
              <span className="text-[11.5px] text-ink-600">{unit}</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-space-2">
            {data.map((d, i) => (
              <li key={d.department_name} className="flex items-center gap-space-2 text-[12.5px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length] }}
                />
                <span className="flex-1 truncate text-ink-900">{d.department_name}</span>
                <span className="text-ink-600 tabular-nums">{d.count}</span>
                <span className="w-9 text-right font-semibold text-ink-900 tabular-nums">
                  {Math.round((d.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
