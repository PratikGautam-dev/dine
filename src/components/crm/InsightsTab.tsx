"use client";

import {
  Alert02Icon,
  ArrowDown01Icon,
  ChartBarLineIcon,
  CrownIcon,
  Download01Icon,
  RepeatIcon,
  ShoppingCart01Icon,
  Tag01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserMultiple02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, SegmentBadge } from "@/components/crm/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Card } from "@/components/erp-ui/Card";
import { DataTable } from "@/components/erp-ui/DataTable";
import { Select } from "@/components/erp-ui/Select";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Tabs } from "@/components/erp-ui/Tabs";
import { useBranches } from "@/hooks/erp/useBranches";
import { cn } from "@/lib/cn";
import {
  SEGMENT_META,
  formatDate,
  type CrmInsights,
  type InsightCustomer,
  type InsightPeriod,
  type Segment,
} from "@/lib/erp/crm";
import { formatMoney, qs, useErpQuery } from "@/lib/erp/erp";
import type { SavedSegment } from "@/lib/erp/rules";
import { TAG_COLOR, TAG_ICON, type TagColor, type TagIcon } from "@/lib/erp/tags";

const PERIODS: { value: InsightPeriod; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];
const PERIOD_WORDS: Record<InsightPeriod, string> = {
  "30d": "previous 30 days",
  "90d": "previous 3 months",
  "6m": "previous 6 months",
  "12m": "previous 12 months",
};
// the tiers get fixed colours; the rest (inactive, not a member) are greys
const DONUT: Record<Segment, string> = {
  regular: "#4a5d45",
  silver: "#a6b8a1",
  gold: "#f2c14e",
  platinum: "#d8c4ef",
  inactive: "#9c9086",
  not_member: "#d9d2ca",
};
const TIERS: Segment[] = ["regular", "silver", "gold", "platinum"];
// Top Tags bars get lighter down the list
const BAR_SHADES = [
  "bg-brand-700",
  "bg-brand-500",
  "bg-brand-400",
  "bg-brand-300",
  "bg-brand-200",
];
const TABS = [
  { key: "top", label: "Top Customers" },
  { key: "high", label: "High-Value Customers" },
  { key: "risk", label: "Churn-Risk Customers" },
] as const;
type ListTab = (typeof TABS)[number]["key"];

const monthName = (m: string, long = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: long ? "numeric" : undefined,
  });

function Change({
  pct,
  pp,
  period,
}: {
  pct?: number | null;
  pp?: number;
  period: InsightPeriod;
}) {
  const value = pp !== undefined ? pp : pct;
  if (value === null || value === undefined)
    return <p className="text-[11.5px] text-ink-400">No earlier data</p>;
  const up = value >= 0;
  return (
    <p className="flex flex-wrap items-center gap-x-space-2 gap-y-1 text-[11.5px] text-ink-400">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 font-semibold",
          up
            ? "bg-success-tint text-success"
            : "bg-destructive-tint text-error",
        )}
      >
        {up ? "↑" : "↓"} {up ? "+" : ""}
        {value}
        {pp !== undefined ? " pp" : "%"}
      </span>
      vs. {PERIOD_WORDS[period]}
    </p>
  );
}

function Kpi({
  label,
  value,
  icon,
  children,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof UserGroupIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-space-2 p-space-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <HugeiconsIcon icon={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-ink-600">{label}</p>
        <p className="break-words text-[22px] font-bold leading-tight text-ink-900">
          {value}
        </p>
      </div>
      {children}
    </Card>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  aside,
  className,
  children,
}: {
  icon: typeof UserGroupIcon;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 p-space-4", className)}>
      <div className="mb-space-3 flex items-start gap-space-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <HugeiconsIcon icon={icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {subtitle && <p className="text-[12px] text-ink-600">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12px] font-semibold text-ink-900">{label}</p>
      {children}
    </div>
  );
}

/** Retention cell shade: the higher the share, the darker the green. */
const shade = (pct: number) =>
  `rgba(74, 93, 69, ${(0.12 + (pct / 100) * 0.7).toFixed(2)})`;

function CustomerTable({
  rows,
  currency,
  empty,
}: {
  rows: InsightCustomer[];
  currency: string;
  empty: string;
}) {
  return (
    <DataTable
      data={rows}
      getRowId={(c) => c.id}
      paginate={false}
      columnPicker={false}
      stickyHeader
      containerClassName="scrollbar-visible max-h-[410px] overflow-y-auto overflow-x-hidden [&_td]:min-w-0 [&_th]:min-w-0"
      emptyMessage={empty}
      columns={[
        {
          header: "Customer",
          cell: ({ row: { original: c } }) => (
            <Link
              href={`/portal/customers/${c.id}`}
              className="flex items-center gap-space-2 hover:underline"
            >
              <Avatar name={c.name} size={30} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink-900">
                  {c.name}
                </span>
                <span className="block text-[11.5px] text-ink-400">
                  {c.customer_code ?? ""}
                </span>
              </span>
            </Link>
          ),
        },
        {
          header: "Membership",
          cell: ({ row }) => <SegmentBadge segment={row.original.segment} />,
        },
        {
          header: "Purchase amount",
          cell: ({ row }) =>
            formatMoney(row.original.total_spent_minor, currency),
        },
        { header: "Orders", cell: ({ row }) => row.original.total_orders },
        {
          header: "Last purchase",
          cell: ({ row }) => formatDate(row.original.last_order_at),
        },
      ]}
    />
  );
}

function csvCell(v: string | number | null | undefined) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Customers > All Customers > Insights: how customers behave, over a chosen period, for the customers the filters pick out. */
export function InsightsTab({ currency }: { currency: string }) {
  const [period, setPeriod] = useState<InsightPeriod>("6m");
  const [segment, setSegment] = useState("");
  const [tag, setTag] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [list, setList] = useState<ListTab>("top");
  const branches = useBranches();
  const tags =
    useErpQuery<{ tag: string; customers: number }[]>("/api/v1/crm/tags");
  const savedSegments = useErpQuery<SavedSegment[]>(
    "/api/v1/crm/customer-segments",
  );
  const q = useErpQuery<CrmInsights>(
    `/api/v1/crm/insights${qs({ period, segment, tag, segment_id: segmentId, branch_id: branchId })}`,
  );
  const d = q.data;

  const exportCsv = () => {
    if (!d) return;
    const k = d.kpis;
    const lines: (string | number | null)[][] = [
      ["Customer insights", PERIODS.find((p) => p.value === period)!.label],
      [],
      ["Metric", "Value", "Change"],
      [
        "Total customers",
        k.total_customers.value,
        k.total_customers.change_pct,
      ],
      [
        "Active customers",
        k.active_customers.value,
        k.active_customers.change_pct,
      ],
      ["Repeat rate %", k.repeat_rate.value, k.repeat_rate.change_pp],
      [
        "Avg. purchase value",
        (k.avg_purchase_value.value_minor / 100).toFixed(2),
        k.avg_purchase_value.change_pct,
      ],
      [
        "Customer lifetime value",
        (k.lifetime_value.value_minor / 100).toFixed(2),
        k.lifetime_value.change_pct,
      ],
      ["New customers", k.new_vs_returning.new],
      ["Returning customers", k.new_vs_returning.returning],
      [],
      ["Top customers"],
      [
        "Name",
        "Code",
        "Membership",
        "Purchase amount",
        "Orders",
        "Last purchase",
      ],
      ...d.top_customers.map((c) => [
        c.name,
        c.customer_code,
        SEGMENT_META[c.segment].label,
        (c.total_spent_minor / 100).toFixed(2),
        c.total_orders,
        c.last_order_at?.slice(0, 10) ?? "",
      ]),
    ];
    const blob = new Blob(
      [lines.map((l) => l.map(csvCell).join(",")).join("\n")],
      {
        type: "text/csv",
      },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-insights-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** A printable copy of the page in a hidden frame: the print dialog's "Save as PDF" makes the file. */
  const exportPdf = () => {
    if (!d) return;
    const k = d.kpis;
    const esc = (v: string | number | null | undefined) =>
      String(v ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const change = (pct: number | null | undefined, pp?: number) =>
      pp !== undefined
        ? `${pp >= 0 ? "+" : ""}${pp} pp`
        : pct === null || pct === undefined
          ? "No earlier data"
          : `${pct >= 0 ? "+" : ""}${pct}%`;
    const table = (head: string[], body: (string | number | null)[][]) =>
      `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
        body.length
          ? body
              .map(
                (r) =>
                  `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
              )
              .join("")
          : `<tr><td colspan="${head.length}">Nothing to show.</td></tr>`
      }</tbody></table>`;
    const people = (rows: InsightCustomer[]) =>
      table(
        [
          "Customer",
          "Code",
          "Membership",
          "Purchase amount",
          "Orders",
          "Last purchase",
        ],
        rows.map((c) => [
          c.name,
          c.customer_code,
          SEGMENT_META[c.segment].label,
          formatMoney(c.total_spent_minor, currency),
          c.total_orders,
          formatDate(c.last_order_at),
        ]),
      );
    const filters = [
      PERIODS.find((p) => p.value === period)!.label,
      segment && SEGMENT_META[segment as Segment].label,
      tag && `Tag: ${tag}`,
      segmentId &&
        `Segment: ${(savedSegments.data ?? []).find((x) => x.id === segmentId)?.name ?? ""}`,
      branchId &&
        `Branch: ${(branches.data ?? []).find((b) => b.id === branchId)?.branch_name ?? ""}`,
    ].filter(Boolean);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Customer insights</title><style>
      body{font:12px/1.45 system-ui,sans-serif;color:#2a211c;margin:24px}
      h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:20px 0 6px}
      p{margin:0;color:#6b6158} table{width:100%;border-collapse:collapse;margin-bottom:4px}
      th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e2dbd2} th{background:#f3efe9;font-size:11px;text-transform:uppercase;color:#6b6158}
      tr{break-inside:avoid} h2{break-after:avoid}
    </style></head><body>
      <h1>Customer insights</h1><p>${esc(filters.join(" · "))} · ${esc(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</p>
      <h2>Overview</h2>
      ${table(
        ["Metric", "Value", "Change"],
        [
          [
            "Total customers",
            k.total_customers.value,
            change(k.total_customers.change_pct),
          ],
          [
            "Active customers",
            k.active_customers.value,
            change(k.active_customers.change_pct),
          ],
          [
            "Repeat rate",
            `${k.repeat_rate.value}%`,
            change(null, k.repeat_rate.change_pp),
          ],
          [
            "Avg. purchase value",
            formatMoney(k.avg_purchase_value.value_minor, currency),
            change(k.avg_purchase_value.change_pct),
          ],
          [
            "Customer lifetime value",
            formatMoney(k.lifetime_value.value_minor, currency),
            change(k.lifetime_value.change_pct),
          ],
          [
            "New vs returning",
            `${k.new_vs_returning.new_pct}% : ${k.new_vs_returning.returning_pct}%`,
            `${k.new_vs_returning.new} new, ${k.new_vs_returning.returning} returning`,
          ],
        ],
      )}
      <h2>Customer growth</h2>
      ${table(
        ["Month", "Total customers"],
        d.growth.map((g) => [monthName(g.month, true), g.customers]),
      )}
      <h2>Membership distribution</h2>
      ${table(
        ["Tier", "Customers"],
        TIERS.map((t) => [
          SEGMENT_META[t].label,
          d.segments.find((x) => x.key === t)?.customers ?? 0,
        ]),
      )}
      <h2>Top tags</h2>
      ${table(
        ["Tag", "Customers"],
        d.tags.map((t) => [t.name, t.customers]),
      )}
      <h2>Customer retention (cohort analysis)</h2>
      ${table(
        [
          "Cohort",
          "Customers",
          "Month 0",
          "Month 1",
          "Month 2",
          "Month 3",
          "Month 4",
          "Month 5",
        ],
        d.cohorts.map((c) => [
          monthName(c.cohort, true),
          c.customers,
          ...c.retention.map((r) => (r === null ? "—" : `${r}%`)),
        ]),
      )}
      <h2>Top customers</h2>${people(d.top_customers)}
      <h2>High-value customers</h2>${people(d.high_value_customers)}
      <h2>Churn-risk customers</h2>${people(d.churn_risk_customers)}
    </body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) return frame.remove();
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };

  const growthData =
    d?.growth.map((g) => ({ ...g, label: monthName(g.month) })) ?? [];
  const tiers =
    d?.segments.filter((s) => TIERS.includes(s.key) && s.customers > 0) ?? [];
  const members = tiers.reduce((n, s) => n + s.customers, 0);
  const rows =
    d &&
    (list === "top"
      ? d.top_customers
      : list === "high"
        ? d.high_value_customers
        : d.churn_risk_customers);
  const k = d?.kpis;

  return (
    <div className="space-y-space-4">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!d}
            className="inline-flex h-10 items-center justify-center gap-space-2 rounded-md border border-line bg-card px-space-4 text-[14px] font-semibold text-ink-900 shadow-[var(--shadow-sm)] hover:border-brand-300 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <HugeiconsIcon icon={Download01Icon} size={16} /> Export insights
            <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]"
          >
            <DropdownMenuItem onClick={exportCsv}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf}>
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {d && k && (
        <div className="grid grid-cols-2 gap-space-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label="Total Customers"
            value={k.total_customers.value}
            icon={UserGroupIcon}
          >
            <Change pct={k.total_customers.change_pct} period={period} />
          </Kpi>
          <Kpi
            label="Active Customers"
            value={k.active_customers.value}
            icon={UserCheck01Icon}
          >
            <Change pct={k.active_customers.change_pct} period={period} />
          </Kpi>
          <Kpi
            label="Repeat Rate"
            value={`${k.repeat_rate.value}%`}
            icon={RepeatIcon}
          >
            <Change pp={k.repeat_rate.change_pp} period={period} />
          </Kpi>
          <Kpi
            label="Avg. Purchase Value"
            value={formatMoney(k.avg_purchase_value.value_minor, currency)}
            icon={ShoppingCart01Icon}
          >
            <Change pct={k.avg_purchase_value.change_pct} period={period} />
          </Kpi>
          <Kpi
            label="Customer Lifetime Value"
            value={formatMoney(k.lifetime_value.value_minor, currency)}
            icon={Wallet01Icon}
          >
            <Change pct={k.lifetime_value.change_pct} period={period} />
          </Kpi>
          <Kpi
            label="New vs Returning Ratio"
            value={
              k.new_vs_returning.new + k.new_vs_returning.returning === 0
                ? "—"
                : `${k.new_vs_returning.new_pct}% : ${k.new_vs_returning.returning_pct}%`
            }
            icon={UserAdd01Icon}
          >
            <p className="text-[11.5px] text-ink-400">
              {k.new_vs_returning.new} new • {k.new_vs_returning.returning}{" "}
              returning
            </p>
          </Kpi>
        </div>
      )}

      <Card className="grid gap-space-3 p-space-3 sm:grid-cols-2 lg:grid-cols-5">
        <FilterField label="Date Range">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as InsightPeriod)}
            aria-label="Date range"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Membership">
          <Select
            value={segment}
            onValueChange={setSegment}
            aria-label="Membership"
          >
            <option value="">All memberships</option>
            {(Object.keys(SEGMENT_META) as Segment[]).map((s) => (
              <option key={s} value={s}>
                {SEGMENT_META[s].label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Tag">
          <Select value={tag} onValueChange={setTag} aria-label="Tag">
            <option value="">All tags</option>
            {(tags.data ?? []).map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Segment">
          <Select
            value={segmentId}
            onValueChange={setSegmentId}
            aria-label="Segment"
          >
            <option value="">All segments</option>
            {(savedSegments.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Branch">
          <Select
            value={branchId}
            onValueChange={setBranchId}
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </Select>
        </FilterField>
      </Card>

      {q.error && (
        <p className="text-[13px] font-medium text-error">{q.error}</p>
      )}
      {!d || !k ? (
        !q.error && <SkeletonLines rows={6} />
      ) : (
        <>
          <div className="grid gap-space-4 xl:grid-cols-[1.45fr_1fr_1.25fr]">
            <Panel
              icon={ChartBarLineIcon}
              title="Customer Growth"
              subtitle="Total customers over time"
              aside={
                k.total_customers.change_pct !== null && (
                  <span className="shrink-0 text-right text-[11.5px] text-ink-600">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold",
                        k.total_customers.change_pct >= 0
                          ? "bg-success-tint text-success"
                          : "bg-destructive-tint text-error",
                      )}
                    >
                      {k.total_customers.change_pct >= 0 ? "↑ +" : "↓ "}
                      {k.total_customers.change_pct}%
                    </span>
                    <br />
                    vs. previous period
                  </span>
                )
              }
            >
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={growthData}
                    margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="growthFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4a5d45"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#4a5d45"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10.5, fill: "#6b6158" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10.5, fill: "#6b6158" }}
                    />
                    <Tooltip
                      formatter={(v) => [`${v}`, "Customers"]}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Area
                      type="linear"
                      dataKey="customers"
                      stroke="#4a5d45"
                      strokeWidth={1.75}
                      fill="url(#growthFill)"
                      dot={{
                        r: 3,
                        fill: "#fff",
                        stroke: "#4a5d45",
                        strokeWidth: 1.5,
                      }}
                      label={{
                        position: "top",
                        fontSize: 10.5,
                        fontWeight: 600,
                        fill: "#2a211c",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              icon={CrownIcon}
              title="Membership Distribution"
              subtitle="Customers by membership tier"
            >
              <div className="flex flex-wrap items-center justify-center gap-x-space-4 gap-y-space-3">
                <div className="relative h-[160px] w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tiers}
                        dataKey="customers"
                        nameKey="key"
                        innerRadius={50}
                        outerRadius={80}
                        startAngle={90}
                        endAngle={-270}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {tiers.map((s) => (
                          <Cell key={s.key} fill={DONUT[s.key]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, _n, item) => [
                          `${v}`,
                          SEGMENT_META[item.payload.key as Segment].label,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-bold leading-none text-ink-900">
                      {members}
                    </span>
                    <span className="mt-1 text-[11px] text-ink-600">
                      Members
                    </span>
                  </div>
                </div>
                <ul className="min-w-[150px] flex-1 space-y-space-2 text-[12.5px]">
                  {TIERS.map((key) => {
                    const n =
                      d.segments.find((s) => s.key === key)?.customers ?? 0;
                    return (
                      <li key={key} className="flex items-center gap-space-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: DONUT[key] }}
                        />
                        <span className="flex-1 font-semibold text-ink-900">
                          {SEGMENT_META[key].label}
                        </span>
                        <span className="whitespace-nowrap text-ink-900">
                          {n} ({members ? Math.round((100 * n) / members) : 0}%)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Panel>

            <Panel
              icon={Tag01Icon}
              title="Top Tags / Segments"
              subtitle="Customers by tags or segments"
            >
              {d.tags.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">
                  No tagged customers yet.
                </p>
              ) : (
                <ul className="space-y-space-3">
                  {d.tags.map((t, i) => {
                    const color =
                      TAG_COLOR[t.color as TagColor] ?? TAG_COLOR.grey;
                    const icon = TAG_ICON[t.icon as TagIcon] ?? Tag01Icon;
                    const max = d.tags[0].customers;
                    return (
                      <li
                        key={t.name}
                        className="flex items-center gap-space-3"
                      >
                        <span
                          className={cn(
                            "inline-flex w-[132px] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold",
                            color.chip,
                          )}
                        >
                          <HugeiconsIcon
                            icon={icon}
                            size={13}
                            className="shrink-0"
                          />
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="h-3.5 min-w-0 flex-1">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              BAR_SHADES[Math.min(i, BAR_SHADES.length - 1)],
                            )}
                            style={{
                              width: `${Math.max(8, (t.customers / max) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="w-[68px] shrink-0 whitespace-nowrap text-right text-[12px] text-ink-900">
                          {t.customers} (
                          {d.total
                            ? Math.round((100 * t.customers) / d.total)
                            : 0}
                          %)
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-space-4 xl:grid-cols-[1fr_1.15fr]">
            <Panel
              icon={UserMultiple02Icon}
              title="Customer Retention (Cohort Analysis)"
              subtitle="% of customers who made a repeat purchase in subsequent months"
            >
              {d.cohorts.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">
                  No first purchases in the last 6 months.
                </p>
              ) : (
                <div>
                  <table className="w-full table-fixed border-collapse text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11.5px] text-ink-600">
                        <th className="w-[22%] py-2 pr-2 font-semibold">
                          Cohort (First Purchase)
                        </th>
                        <th className="w-[15%] px-2 font-semibold">
                          Customers
                        </th>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <th
                            key={i}
                            className="px-1 text-center font-semibold"
                          >
                            Month {i}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.cohorts.map((c) => (
                        <tr key={c.cohort} className="border-t border-line">
                          <td className="py-2 pr-2 font-medium text-ink-900">
                            {monthName(c.cohort, true)}
                          </td>
                          <td className="px-2 text-ink-900">{c.customers}</td>
                          {c.retention.map((r, i) => (
                            <td
                              key={i}
                              className="px-1 py-1 text-center font-medium"
                              style={
                                r === null
                                  ? undefined
                                  : { background: shade(r) }
                              }
                            >
                              <span
                                className={
                                  r !== null && r >= 60
                                    ? "text-white"
                                    : "text-ink-900"
                                }
                              >
                                {r === null ? "—" : `${r}%`}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Card className="min-w-0 p-space-4">
              <Tabs
                tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
                value={list}
                onChange={setList}
                className="mb-space-3"
              />
              {list === "risk" && (
                <p className="mb-space-2 flex items-center gap-space-2 text-[12px] text-ink-600">
                  <HugeiconsIcon icon={Alert02Icon} size={14} />
                  Customers who bought before but not in the last 90 days.
                </p>
              )}
              <CustomerTable
                rows={rows ?? []}
                currency={currency}
                empty="No customers to show."
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
