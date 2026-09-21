"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, ChefHat, ClipboardList, MoreHorizontal, PackageCheck, Search, ShoppingBag, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { PeakHoursChart } from "@/components/portal/PeakHoursChart";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import {
  CANCELLABLE_STATUSES, FoodOrder, NEXT_ACTION_BY_STATUS, STATUS_LABELS, useFoodOrders,
} from "@/hooks/useFoodOrders";
import { cn } from "@/lib/cn";
import {
  formatOrderTime, isSameLocalDay, matchesOrderView, parseOrderTime, rupees, type OrderView,
} from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

const VIEW_TABS: { id: OrderView; label: string; always: boolean }[] = [
  { id: "all", label: "All", always: true },
  { id: "new", label: "New", always: true },
  { id: "kitchen", label: "In the kitchen", always: true },
  { id: "ready", label: "Ready", always: true },
  { id: "completed", label: "Completed", always: true },
  { id: "cancelled", label: "Cancelled", always: true },
  { id: "awaiting_payment", label: "Awaiting payment", always: false },
];

const STATUS_TONE: Record<string, "brand" | "clay" | "success" | "neutral"> = {
  pending_payment: "neutral",
  placed: "clay",
  paid: "clay",
  accepted: "clay",
  preparing: "brand",
  ready_for_pickup: "brand",
  out_for_delivery: "brand",
  completed: "success",
  cancelled: "neutral",
};

// How far back the list goes. 90 days is the default; "All time" is one click away.
const PERIODS: { days: number; label: string }[] = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last year" },
  { days: 0, label: "All time" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINES_SHOWN = 3;

/** How this guest settles the order, in the words staff use at the counter. */
function paymentLine(order: FoodOrder): string {
  if (order.payment_method === "pay_at_restaurant") {
    return order.fulfillment_type === "delivery" ? "Pays on delivery" : "Pays at the restaurant";
  }
  return order.status === "pending_payment" ? "Awaiting online payment" : "Paid online";
}

export default function PortalFoodOrdersPage() {
  const { hospital, ready } = usePortalGuard();
  // Everything is loaded once and filtered here, so every view can show its own count.
  const [days, setDays] = useState(90);
  const { orders, error, actingId, runAction } = useFoodOrders(ready, "", days);
  const canWrite = usePermission("food_orders", "write");

  const [view, setView] = useState<OrderView>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [search, setSearch] = useState("");
  const [pendingCancel, setPendingCancel] = useState<FoodOrder | null>(null);

  const viewCounts = useMemo(() => {
    const counts: Record<OrderView, number> = { all: 0, new: 0, kitchen: 0, ready: 0, completed: 0, cancelled: 0, awaiting_payment: 0 };
    for (const o of orders || []) {
      for (const v of Object.keys(counts) as OrderView[]) if (matchesOrderView(o.status, v)) counts[v] += 1;
    }
    return counts;
  }, [orders]);

  // Everything below is computed from the orders themselves -- no numbers that aren't in the list.
  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - DAY_MS);
    let today = 0, yesterdayCount = 0, valueToday = 0;
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      days.push({ date: d.toDateString(), label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: 0 });
    }
    const hours = new Array<number>(24).fill(0);
    for (const o of orders || []) {
      const when = parseOrderTime(o.created_at);
      if (Number.isNaN(when.getTime())) continue;
      if (isSameLocalDay(when, now) && o.status !== "cancelled") {
        today += 1;
        valueToday += o.total_paise;
      }
      if (isSameLocalDay(when, yesterday) && o.status !== "cancelled") yesterdayCount += 1;
      const day = days.find((d) => d.date === when.toDateString());
      if (day && o.status !== "cancelled") day.count += 1;
      if (now.getTime() - when.getTime() <= 30 * DAY_MS && o.status !== "cancelled") hours[when.getHours()] += 1;
    }
    return {
      today, valueToday, days, hours,
      // a delta only when there is a real yesterday to compare with
      todayDelta: yesterdayCount > 0 ? Math.round(((today - yesterdayCount) / yesterdayCount) * 100) : null,
    };
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (!matchesOrderView(o.status, view)) return false;
      if (typeFilter !== "all" && o.fulfillment_type !== typeFilter) return false;
      if (!q) return true;
      return (
        (o.reference_id || "").toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.patient_name || "").toLowerCase().includes(q) ||
        (o.items || []).some((i) => i.item_name_snapshot.toLowerCase().includes(q))
      );
    });
  }, [orders, view, typeFilter, search]);

  const columns = useMemo<ColumnDef<FoodOrder>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="font-mono text-[12px] font-semibold text-ink-900">{row.original.reference_id ?? `#${row.original.id}`}</div>
            <div className="text-[12px] text-ink-600">{formatOrderTime(row.original.created_at)}</div>
          </div>
        ),
      },
      {
        id: "guest",
        header: "Guest",
        cell: ({ row }) => (
          <div className="min-w-[110px] text-ink-900">
            <div className="font-semibold">{row.original.patient_name || row.original.phone}</div>
            {row.original.patient_name && <div className="text-[12px] text-ink-600">{row.original.phone}</div>}
          </div>
        ),
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => {
          const lines = row.original.items || [];
          return (
            <ul className="min-w-[140px] text-[13px] text-ink-900">
              {lines.slice(0, MAX_LINES_SHOWN).map((l) => (
                <li key={l.menu_item_id}>{l.quantity} × {l.item_name_snapshot}</li>
              ))}
              {lines.length > MAX_LINES_SHOWN && <li className="text-[12px] text-ink-600">+{lines.length - MAX_LINES_SHOWN} more</li>}
            </ul>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <div className="max-w-[120px]">
            <div className="font-semibold text-ink-900">{row.original.fulfillment_type === "delivery" ? "Delivery" : "Takeaway"}</div>
            {row.original.fulfillment_type === "delivery" && row.original.delivery_address && (
              <div className="truncate text-[12px] text-ink-600" title={row.original.delivery_address}>{row.original.delivery_address}</div>
            )}
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="font-semibold tabular-nums text-ink-900">{rupees(row.original.total_paise)}</div>
            <div className="text-[12px] text-ink-600">{paymentLine(row.original)}</div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <Badge tone={STATUS_TONE[row.original.status] ?? "neutral"}>{STATUS_LABELS[row.original.status] ?? row.original.status}</Badge>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const order = row.original;
          const next = NEXT_ACTION_BY_STATUS[order.status];
          const busy = actingId === order.id;
          if (!canWrite || (!next && !CANCELLABLE_STATUSES.has(order.status))) return null;
          return (
            <div className="flex items-center justify-end gap-space-2 whitespace-nowrap">
              {next && (
                <Button size="md" disabled={busy} onClick={() => runAction(order, next.action)}>
                  {busy ? "…" : next.label}
                </Button>
              )}
              {CANCELLABLE_STATUSES.has(order.status) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`More actions for order ${order.reference_id ?? order.id}`}
                    disabled={busy}
                    className="inline-flex h-10 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50"
                  >
                    <MoreHorizontal size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem variant="destructive" onClick={() => setPendingCancel(order)}>
                      <X size={15} /> Cancel order
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        },
      },
    ],
    [actingId, canWrite, runAction],
  );

  return (
    <PortalShell hospital={hospital} active="food-orders">
      <PageHeader
        title="Orders"
        icon={<ClipboardList size={22} />}
        description="Incoming food orders, from payment through completion."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {orders && (
        <>
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile icon={<ShoppingBag size={22} />} label="Orders today" value={stats.today} deltaPct={stats.todayDelta} hint="vs yesterday" />
            <StatTile icon={<BellRing size={22} />} label="Needs action" value={viewCounts.new} deltaPct={null} hint="New orders to accept" />
            <StatTile icon={<ChefHat size={22} />} label="In the kitchen" value={viewCounts.kitchen} deltaPct={null} hint="Accepted or preparing" />
            <StatTile icon={<PackageCheck size={22} />} label="Ready" value={viewCounts.ready} deltaPct={null} hint="For pickup or out for delivery" />
            <StatTile
              icon={<Wallet size={22} />} label="Order value today" prefix="₹" value={Math.round(stats.valueToday / 100)}
              deltaPct={null} hint="Cancelled orders excluded"
            />
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
            <WeeklyTrendChart data={stats.days} title="Order volume" unit="orders" />
            <PeakHoursChart hours={stats.hours} periodLabel="Orders by hour of the day, last 30 days" />
          </div>
        </>
      )}

      <div className="mb-space-3 flex flex-wrap gap-space-2">
        {VIEW_TABS.filter((t) => t.always || viewCounts[t.id] > 0 || view === t.id).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={cn(
              "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
              view === t.id
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {t.label}
            <span className={cn("ml-space-1 tabular-nums", view === t.id ? "text-white/80" : "text-ink-400")}>{viewCounts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="mb-space-3 flex flex-wrap items-center gap-space-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text" placeholder="Search guest, phone, order or dish…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />
        </div>
        <select
          aria-label="Filter by order type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
        >
          <option value="all">Takeaway and delivery</option>
          <option value="pickup">Takeaway only</option>
          <option value="delivery">Delivery only</option>
        </select>
        <select
          aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
        >
          {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
        </select>
      </div>

      <Card className="p-space-4">
        {!orders ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">No orders here yet.</p>
        ) : visible.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">No orders match your search or filter.</p>
        ) : (
          <DataTable columns={columns} data={visible} getRowId={(o) => String(o.id)} />
        )}
        {orders && days !== 0 && (
          <p className="mt-space-3 text-[12px] text-ink-400">
            Showing orders from the last {days} days.{" "}
            <button type="button" onClick={() => setDays(0)} className="font-semibold text-brand-700 hover:underline">
              Show all time
            </button>
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={pendingCancel !== null}
        title={pendingCancel ? `Cancel order ${pendingCancel.reference_id ?? `#${pendingCancel.id}`}?` : ""}
        message="The order is cancelled and any stock it took goes back on the menu. This can't be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) runAction(pendingCancel, "cancel");
          setPendingCancel(null);
        }}
      />
    </PortalShell>
  );
}
