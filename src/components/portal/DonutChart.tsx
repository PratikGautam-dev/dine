"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/erp-ui/Card";

type Slice = { name: string; count: number };

// Brand green first, then warm neutrals and earth tones -- fixed order, never cycled or reassigned. Adjacent
// slots differ strongly in lightness (green / charcoal / amber / olive / stone ...), and every legend row also
// carries the section name and its share, so colour is never the only way to tell slices apart.
const SLOT_COLORS = [
  "#4a5d45",
  "#2a211c",
  "#e0a100",
  "#6b7a4f",
  "#9c9086",
  "#a6b8a1",
  "#7d361d",
  "#c9b8a8",
];

function DonutTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{payload[0].name}</p>
      <p className="text-ink-600">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

/** A donut with a legend of names, counts and shares. */
export function DonutChart({
  data,
  title,
  subtitle = "",
  unit = "",
  emptyText = "Nothing to show yet.",
}: {
  data: Slice[];
  title: string;
  subtitle?: string;
  unit?: string;
  emptyText?: string;
}) {
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
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={SLOT_COLORS[i % SLOT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip unit={unit} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] leading-none font-bold text-ink-900">
                {total.toLocaleString()}
              </span>
              <span className="text-[11.5px] text-ink-600">{unit}</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-space-2">
            {data.map((d, i) => (
              <li
                key={d.name}
                className="flex items-center gap-space-2 text-[12.5px]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length],
                  }}
                />
                <span className="flex-1 truncate text-ink-900">{d.name}</span>
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
