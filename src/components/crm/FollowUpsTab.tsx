"use client";

import {
  Alert02Icon,
  Calendar03Icon,
  ChartBarLineIcon,
  CheckmarkCircle02Icon,
  MoreHorizontalIcon,
  PhoneCheckIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AddFollowUpModal } from "@/components/crm/AddFollowUpModal";
import {
  FOLLOW_UP_CHANNEL,
  FOLLOW_UP_PRIORITY,
  FOLLOW_UP_STATUS,
  FOLLOW_UP_TYPE,
  type Icon,
} from "@/components/crm/followUpMeta";
import { Avatar } from "@/components/crm/shared";
import { Card } from "@/components/erp-ui/Card";
import { DataTable } from "@/components/erp-ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Input } from "@/components/erp-ui/Input";
import { Select } from "@/components/erp-ui/Select";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { cn } from "@/lib/cn";
import type {
  FollowUp,
  FollowUpBoard,
  FollowUpChannel,
  FollowUpPriority,
  FollowUpStatus,
} from "@/lib/erp/crm";
import { erp, qs, useErpQuery } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

const RANGES = [
  { value: "", label: "All dates" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "1y", label: "Last 12 months" },
];

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

function Chip({
  className,
  icon,
  children,
}: {
  className: string;
  icon?: Icon;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold",
        className,
      )}
    >
      {icon && <HugeiconsIcon icon={icon} size={13} className="shrink-0" />}
      {children}
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "text-brand-700 bg-brand-50",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: Icon;
  tone?: string;
}) {
  return (
    <Card className="min-w-0 p-space-3">
      <div className="mb-space-2 flex items-center gap-space-2">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            tone,
          )}
        >
          <HugeiconsIcon icon={icon} size={18} />
        </span>
        <p className="text-[12.5px] text-ink-600">{label}</p>
      </div>
      <p className="text-[24px] font-bold leading-tight text-ink-900">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11.5px] text-ink-400">{hint}</p>}
    </Card>
  );
}

/** Customers > Follow-ups: every follow-up with who does it, how and by when; what is due today; how well they turn into sales. */
export function FollowUpsTab({
  canEdit,
  reloadKey,
  onChanged,
  onUsers,
}: {
  canEdit: boolean;
  /** Bump to refetch (after a follow-up is added). */
  reloadKey: number;
  onChanged: () => void;
  /** Hands the team members up, for the Add follow-up dialog's "Assigned to". */
  onUsers: (users: { id: string; name: string }[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [channel, setChannel] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [perf, setPerf] = useState("30d");
  const [q, setQ] = useState("");
  const board = useErpQuery<FollowUpBoard>(
    `/api/v1/crm/follow-ups/board${qs({ q, assigned_to: assignedTo, channel, priority, status, period, perf_period: perf, k: reloadKey || undefined })}`,
  );
  const d = board.data;
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const users = d?.users;
  useEffect(() => {
    if (users) onUsers(users);
  }, [users, onUsers]);

  async function remove(n: FollowUp) {
    const res = await erp(`/api/v1/crm/notes/${n.id}`, "DELETE");
    if (res.error)
      return toast.error("Couldn't delete the follow-up", res.error);
    board.reload();
    onChanged();
  }

  if (!d)
    return board.error ? (
      <p className="text-[13px] font-medium text-error">{board.error}</p>
    ) : (
      <SkeletonLines rows={8} />
    );
  const k = d.kpis;
  const points = d.performance.points.map((p) => ({
    ...p,
    label: new Date(`${p.day}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <div className="space-y-space-4">
      <div className="grid grid-cols-2 gap-space-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Follow-ups" value={k.total} icon={PhoneCheckIcon} />
        <Kpi label="Due Today" value={k.due_today} icon={Calendar03Icon} />
        <Kpi
          label="Upcoming"
          value={k.upcoming}
          hint="next 7 days"
          icon={Calendar03Icon}
        />
        <Kpi
          label="Completed"
          value={k.completed}
          hint={`${k.completion_rate}% completion rate`}
          icon={CheckmarkCircle02Icon}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Kpi
          label="Overdue"
          value={k.overdue}
          icon={Alert02Icon}
          tone="bg-red-50 text-red-700"
        />
        <Kpi
          label="Follow-up Conversion"
          value={`${k.conversion_rate}%`}
          hint={`${k.converted} / ${k.total} converted`}
          icon={ChartBarLineIcon}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-space-2 p-space-3">
        <div className="relative min-w-[240px] flex-[1_1_360px]">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            aria-label="Search follow-ups"
            placeholder="Search follow-ups by customer name, phone or note..."
            className="!rounded-md pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setQ(search.trim())}
            onBlur={() => setQ(search.trim())}
          />
        </div>
        <Select
          value={assignedTo}
          onValueChange={setAssignedTo}
          aria-label="Assigned to"
          className="!w-[138px] min-w-[110px] shrink"
        >
          <option value="">Assigned To</option>
          {d.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select
          value={channel}
          onValueChange={setChannel}
          aria-label="Channel"
          className="!w-[138px] min-w-[110px] shrink"
        >
          <option value="">Channel</option>
          {(Object.keys(FOLLOW_UP_CHANNEL) as FollowUpChannel[]).map((c) => (
            <option key={c} value={c}>
              {FOLLOW_UP_CHANNEL[c].label}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onValueChange={setPriority}
          aria-label="Priority"
          className="!w-[138px] min-w-[110px] shrink"
        >
          <option value="">Priority</option>
          {(Object.keys(FOLLOW_UP_PRIORITY) as FollowUpPriority[]).map((p) => (
            <option key={p} value={p}>
              {FOLLOW_UP_PRIORITY[p].label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onValueChange={setStatus}
          aria-label="Status"
          className="!w-[138px] min-w-[110px] shrink"
        >
          <option value="">Status</option>
          {(Object.keys(FOLLOW_UP_STATUS) as FollowUpStatus[]).map((s) => (
            <option key={s} value={s}>
              {FOLLOW_UP_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select
          value={period}
          onValueChange={setPeriod}
          aria-label="Date range"
          className="!w-[138px] min-w-[110px] shrink"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.value ? r.label : "Date Range"}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="min-w-0 p-space-3">
        <DataTable
          data={d.items}
          getRowId={(n) => n.id}
          pageSize={10}
          containerClassName="[&_td:not(:first-child)]:px-1.5 [&_th:not(:first-child)]:px-1.5 [&_td]:min-w-0 [&_th]:min-w-0"
          emptyMessage="No follow-ups match. Add one to start tracking."
          columns={[
            {
              header: "Customer",
              cell: ({ row: { original: n } }) => (
                <Link
                  href={`/portal/customers/${n.customer_id}`}
                  className="flex items-center gap-space-2 hover:underline"
                >
                  <Avatar name={n.customer_name} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink-900">
                      {n.customer_name}
                    </span>
                    <span className="block text-[11.5px] text-ink-400">
                      {n.customer_code ?? ""}
                    </span>
                  </span>
                </Link>
              ),
            },
            {
              header: "Follow-up Type",
              cell: ({ row: { original: n } }) => {
                const t = FOLLOW_UP_TYPE[n.follow_up_type];
                return (
                  <Chip className={t.chip} icon={t.icon}>
                    {t.label}
                  </Chip>
                );
              },
            },
            {
              header: "Purpose",
              cell: ({ row: { original: n } }) => (
                <span className="line-clamp-2 min-w-[140px]">{n.purpose}</span>
              ),
            },
            {
              header: "Assigned To",
              cell: ({ row: { original: n } }) => (
                <span className="whitespace-nowrap">
                  {n.assigned_name ?? "—"}
                </span>
              ),
            },
            {
              header: "Last Contact",
              cell: ({ row: { original: n } }) => (
                <span className="whitespace-nowrap">
                  {when(n.last_contact_at)}
                </span>
              ),
            },
            {
              header: "Next Follow-up",
              cell: ({ row: { original: n } }) => (
                <span className="whitespace-nowrap">
                  {when(n.follow_up_at)}
                </span>
              ),
            },
            {
              header: "Channel",
              cell: ({ row: { original: n } }) => {
                const c = FOLLOW_UP_CHANNEL[n.channel];
                return (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <HugeiconsIcon icon={c.icon} size={14} />
                    {c.label}
                  </span>
                );
              },
            },
            {
              header: "Priority",
              cell: ({ row: { original: n } }) => {
                const p = FOLLOW_UP_PRIORITY[n.priority];
                return <Chip className={p.chip}>{p.label}</Chip>;
              },
            },
            {
              header: "Status",
              cell: ({ row: { original: n } }) => {
                const st = FOLLOW_UP_STATUS[n.status];
                return (
                  <Chip className={st.chip} icon={st.icon}>
                    {st.label}
                  </Chip>
                );
              },
            },
            {
              id: "actions",
              header: "Actions",
              cell: ({ row: { original: n } }) =>
                canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Follow-up actions"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.06]"
                    >
                      <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(n)}>
                        Edit follow-up
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => remove(n)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
            },
          ]}
        />
      </Card>

      <div className="grid gap-space-4 xl:grid-cols-[1fr_1.1fr]">
        <Card className="min-w-0 p-space-4">
          <div className="mb-space-3 flex items-center gap-space-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <HugeiconsIcon icon={Calendar03Icon} size={18} />
            </span>
            <h2 className="flex-1 text-[15px] font-bold text-ink-900">
              Upcoming Today ({d.today.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQ("");
                setAssignedTo("");
                setChannel("");
                setPriority("");
                setStatus("");
                setPeriod("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              View all →
            </button>
          </div>
          {d.today.length === 0 ? (
            <p className="py-space-4 text-center text-[13px] text-ink-400">
              Nothing due today.
            </p>
          ) : (
            <ul className="max-h-[260px] divide-y divide-line overflow-y-auto">
              {d.today.map((n) => {
                const c = FOLLOW_UP_CHANNEL[n.channel];
                return (
                  <li
                    key={n.id}
                    className="flex flex-wrap items-center gap-x-space-3 gap-y-1 py-space-2 text-[12.5px]"
                  >
                    <Link
                      href={`/portal/customers/${n.customer_id}`}
                      className="flex min-w-[150px] flex-[2_1_150px] items-center gap-space-2 hover:underline"
                    >
                      <Avatar name={n.customer_name} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">
                          {n.customer_name}
                        </span>
                        <span className="block text-[11px] text-ink-400">
                          {n.customer_code ?? ""}
                        </span>
                      </span>
                    </Link>
                    <span className="inline-flex min-w-[90px] flex-[1_1_90px] items-center gap-1.5">
                      <HugeiconsIcon icon={c.icon} size={14} />
                      {c.label}
                    </span>
                    <span className="min-w-[120px] flex-[2_1_130px] truncate text-ink-900">
                      {n.purpose}
                    </span>
                    <span className="whitespace-nowrap">
                      {timeOnly(n.follow_up_at)}
                    </span>
                    <Chip className={FOLLOW_UP_PRIORITY[n.priority].chip}>
                      {FOLLOW_UP_PRIORITY[n.priority].label}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 p-space-4">
          <div className="mb-space-3 flex items-center gap-space-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <HugeiconsIcon icon={ChartBarLineIcon} size={18} />
            </span>
            <h2 className="flex-1 text-[15px] font-bold text-ink-900">
              Follow-up Performance
            </h2>
            <Select
              value={perf}
              onValueChange={setPerf}
              aria-label="Performance period"
              className="!w-auto min-w-[130px]"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="1y">Last 12 months</option>
            </Select>
          </div>
          <div className="flex flex-wrap gap-space-3">
            <div className="min-w-[96px] flex-[0_0_104px] border-r border-line pr-space-2">
              <p className="text-[30px] font-bold leading-tight text-ink-900">
                {d.performance.rate}%
              </p>
              <p className="text-[12.5px] text-ink-600">Conversion Rate</p>
              {d.performance.change_pp !== null && (
                <p className="mt-space-2 text-[11.5px] text-ink-400">
                  <span
                    className={cn(
                      "mr-1 inline-block rounded-full px-2 py-0.5 font-semibold",
                      d.performance.change_pp >= 0
                        ? "bg-success-tint text-success"
                        : "bg-destructive-tint text-error",
                    )}
                  >
                    {d.performance.change_pp >= 0 ? "↑ +" : "↓ "}
                    {d.performance.change_pp} pp
                  </span>
                  vs. previous period
                </p>
              )}
            </div>
            <div className="h-[190px] min-w-[240px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={points}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fuFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4a5d45" stopOpacity={0.3} />
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
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10.5, fill: "#6b6158" }}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, "Conversion"]} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    connectNulls
                    stroke="#4a5d45"
                    strokeWidth={1.75}
                    fill="url(#fuFill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
      {editing && (
        <AddFollowUpModal
          editing={editing}
          users={d.users}
          onClose={() => setEditing(null)}
          onAdded={() => {
            board.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
