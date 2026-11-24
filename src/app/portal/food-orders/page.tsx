"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bell,
  BellRing,
  ChefHat,
  ClipboardList,
  Download,
  Eye,
  MoreHorizontal,
  PackageCheck,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { OrderDetailDrawer } from "@/components/portal/OrderDetailDrawer";
import { PeakHoursChart } from "@/components/portal/PeakHoursChart";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useBranchFilter } from "@/lib/branchContext";
import {
  ORDER_CHANNELS,
  ORDER_PERIODS,
  formatRange,
  inRange,
  usePageChannels,
  usePagePeriod,
} from "@/lib/globalFilter";
import {
  CANCELLABLE_STATUSES,
  FoodOrder,
  nextActionFor,
  orderStatusLabel,
  STATUS_TONE,
  NOTIFIABLE_STATUSES,
  useFoodOrders,
} from "@/hooks/useFoodOrders";
import { cn } from "@/lib/cn";
import {
  formatOrderTime,
  isSameLocalDay,
  matchesOrderView,
  parseOrderTime,
  rupees,
  type OrderView,
} from "@/lib/foodOrders";
import { DispatchModal } from "@/components/portal/DispatchModal";
import { usePermission } from "@/lib/staffAuth";
import { Select } from "@/components/erp-ui/Select";

const VIEW_TABS: { id: OrderView; label: string; always: boolean }[] = [
  { id: "all", label: "All Orders", always: true },
  { id: "new", label: "New", always: true },
  { id: "kitchen", label: "In the kitchen", always: true },
  { id: "ready", label: "Ready", always: true },
  { id: "completed", label: "Completed", always: true },
  { id: "cancelled", label: "Cancelled", always: true },
  { id: "awaiting_payment", label: "Awaiting payment", always: false },
];

// Web Storefront: a second real channel now exists alongside the WhatsApp bot.
type SourceFilter = "all" | "whatsapp" | "web" | "app" | "skip_queue";
type TypeFilter = "all" | "pickup" | "delivery";

// The same status, read as "what stage is the kitchen at" -- a coarser view of the identical
// real `status` value, not a second tracked field. Blank before a kitchen is even involved yet.
const KITCHEN_STATUS_LABELS: Record<string, string> = {
  accepted: "In preparation",
  preparing: "In preparation",
  ready_for_pickup: "Ready",
  out_for_delivery: "Ready",
  completed: "Ready",
  cancelled: "—",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINES_SHOWN = 3;

/** How this guest settles the order, in the words staff use at the counter. */
function paymentLine(order: FoodOrder): string {
  if (order.payment_method === "pay_at_restaurant") {
    return order.fulfillment_type === "delivery" ? "Pays on delivery" : "Pays at the restaurant";
  }
  return order.status === "pending_payment" ? "Awaiting online payment" : "Paid online";
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export default function PortalFoodOrdersPage() {
  const { restaurant, ready } = usePortalGuard();
  // Everything is loaded once and filtered here, so every view can show its own count.
  // the period and channel come from the header's global filter
  const { days, range, period, setPeriod } = usePagePeriod(ORDER_PERIODS);
  const { channels: globalChannels, setChannels: setGlobalChannels } =
    usePageChannels(ORDER_CHANNELS);
  const { orders, error, actingId, runAction, dispatchOrder } = useFoodOrders(
    ready,
    "",
    days,
    undefined,
    useBranchFilter().selectedBranchId,
  );
  const canWrite = usePermission("food_orders", "write");

  const [view, setView] = useState<OrderView>("all");
  // several channels can be ticked at once; the page is "one channel" (own heading, own nav item) only when exactly one is
  const selectedSources = globalChannels;
  const sourceFilter: SourceFilter =
    selectedSources.length === 1 ? (selectedSources[0] as SourceFilter) : "all";
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [pendingCancel, setPendingCancel] = useState<FoodOrder | null>(null);
  // the delivery order being handed to DAAP Delivery (the rider form)
  const [dispatching, setDispatching] = useState<FoodOrder | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);

  // Sidebar's Sales Channels group (Online/WhatsApp) deep-links here with ?source=web|whatsapp
  // instead of duplicating this whole page per channel -- read via window.location.search rather
  // than next/navigation's useSearchParams(), which needs a <Suspense> boundary to statically
  // prerender (this codebase already hit that exact build break once on the storefront's home
  // page and fixed it the same way).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const source = new URLSearchParams(window.location.search).get("source");
    if (source === "web" || source === "whatsapp") setGlobalChannels([source]);
    // the sidebar's plain "Food Orders" link is ?source=all: the channel filter is remembered, so without this
    // it would reopen on whichever channel was last picked (WhatsApp) and highlight that sidebar row instead
    else if (source === "all") setGlobalChannels([]);
    // run once on arrival: the link only sets the starting channel, later header changes must stick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Website and WhatsApp in the sidebar are now their channel pages; their orders are this page with the channel filter on.
  const activeNavKey = "food-orders";

  const viewCounts = useMemo(() => {
    const counts: Record<OrderView, number> = {
      all: 0,
      new: 0,
      kitchen: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
      awaiting_payment: 0,
    };
    let delivered = 0;
    let served = 0;
    for (const o of orders || []) {
      if (!inRange(parseOrderTime(o.created_at), range)) continue;
      if (o.status === "completed") {
        if (o.fulfillment_type === "delivery") delivered += 1;
        else served += 1;
      }
      for (const v of Object.keys(counts) as OrderView[])
        if (matchesOrderView(o.status, v)) counts[v] += 1;
    }
    return { ...counts, delivered, served };
  }, [orders, range]);

  // Everything below is computed from the orders themselves -- no numbers that aren't in the list.
  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - DAY_MS);
    let today = 0,
      yesterdayCount = 0,
      valueToday = 0;
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      days.push({
        date: d.toDateString(),
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        count: 0,
      });
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
      if (now.getTime() - when.getTime() <= 30 * DAY_MS && o.status !== "cancelled")
        hours[when.getHours()] += 1;
    }
    return {
      today,
      valueToday,
      days,
      hours,
      // a delta only when there is a real yesterday to compare with
      todayDelta:
        yesterdayCount > 0 ? Math.round(((today - yesterdayCount) / yesterdayCount) * 100) : null,
    };
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (!inRange(parseOrderTime(o.created_at), range)) return false;
      if (!matchesOrderView(o.status, view)) return false;
      if (selectedSources.length > 0 && !selectedSources.some((c) => c === o.source)) return false;
      if (typeFilter !== "all" && o.fulfillment_type !== typeFilter) return false;
      if (!q) return true;
      return (
        (o.reference_id || "").toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.patient_name || "").toLowerCase().includes(q) ||
        (o.items || []).some((i) => i.item_name_snapshot.toLowerCase().includes(q))
      );
    });
  }, [orders, range, view, selectedSources, typeFilter, search]);

  function exportCsv() {
    const header = [
      "Order ID",
      "Customer",
      "Phone",
      "Source",
      "Order Type",
      "Placed",
      "Amount (INR)",
      "Payment",
      "Status",
    ];
    const rows = visible.map((o) => [
      o.reference_id ?? `#${o.id}`,
      o.patient_name || "",
      o.phone,
      o.source === "web" ? "Web" : o.source === "skip_queue" ? "SkipQ" : "WhatsApp",
      o.fulfillment_type === "delivery" ? "Delivery" : "Takeaway",
      formatOrderTime(o.created_at),
      (o.total_paise / 100).toFixed(2),
      paymentLine(o),
      orderStatusLabel(o),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => csvCell(String(c))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `food-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<FoodOrder>[]>(
    () => [
      {
        id: "order",
        header: "Order ID",
        cell: ({ row }) => (
          <div className="whitespace-nowrap font-mono text-[12px] font-semibold text-ink-900">
            {row.original.reference_id ?? `#${row.original.id}`}
          </div>
        ),
      },
      {
        id: "guest",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-[110px] text-ink-900">
            <div className="font-semibold">{row.original.patient_name || row.original.phone}</div>
            {row.original.patient_name && (
              <div className="text-[12px] text-ink-600">{row.original.phone}</div>
            )}
          </div>
        ),
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) =>
          row.original.source === "web" ? (
            <Badge tone="brand">Website</Badge>
          ) : row.original.source === "app" ? (
            <Badge tone="brand">App</Badge>
          ) : row.original.source === "skip_queue" ? (
            <Badge tone="clay">SkipQ</Badge>
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-ink-700">
              <WhatsAppIcon size={16} /> WhatsApp
            </span>
          ),
      },
      {
        id: "type",
        header: "Order Type",
        cell: ({ row }) =>
          row.original.fulfillment_type === "delivery" ? (
            <Badge tone="violet">Delivery</Badge>
          ) : (
            <Badge tone="success">Takeaway</Badge>
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
                <li key={l.menu_item_id}>
                  {l.quantity} × {l.item_name_snapshot}
                </li>
              ))}
              {lines.length > MAX_LINES_SHOWN && (
                <li className="text-[12px] text-ink-600">+{lines.length - MAX_LINES_SHOWN} more</li>
              )}
            </ul>
          );
        },
      },
      {
        id: "placed",
        header: "Placed",
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-[12.5px] text-ink-600">
            {formatOrderTime(row.original.created_at)}
          </div>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <div className="font-semibold tabular-nums text-ink-900">
              {rupees(row.original.total_paise)}
            </div>
            <div className="text-[12px] text-ink-600">{paymentLine(row.original)}</div>
          </div>
        ),
      },
      {
        id: "kitchen_status",
        header: "Kitchen Status",
        cell: ({ row }) => {
          const label = KITCHEN_STATUS_LABELS[row.original.status];
          return label ? (
            <Badge
              tone={
                row.original.status === "cancelled" ? "neutral" : STATUS_TONE[row.original.status]
              }
            >
              {label}
            </Badge>
          ) : (
            <span className="text-[12px] text-ink-300">—</span>
          );
        },
      },
      {
        id: "status",
        header: "Order Status",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <Badge tone={STATUS_TONE[row.original.status] ?? "neutral"}>
              {orderStatusLabel(row.original)}
            </Badge>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const order = row.original;
          const next = nextActionFor(order);
          const busy = actingId === order.id;
          return (
            <div className="flex items-center justify-end gap-space-2 whitespace-nowrap">
              {canWrite && next && (
                <Button
                  size="md"
                  disabled={busy}
                  onClick={() =>
                    next.action === "dispatch"
                      ? setDispatching(order)
                      : runAction(order, next.action)
                  }
                >
                  {busy ? "…" : next.label}
                </Button>
              )}
              {canWrite && NOTIFIABLE_STATUSES.has(order.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(order, "notify")}
                  aria-label={`Notify ${order.patient_name || order.phone} on WhatsApp about order ${order.reference_id ?? order.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-space-3 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50"
                >
                  <Bell size={14} /> Notify
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More actions for order ${order.reference_id ?? order.id}`}
                  disabled={busy}
                  className="inline-flex h-10 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50"
                >
                  <MoreHorizontal size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setDetailOrderId(order.id)}>
                    <Eye size={15} /> View details
                  </DropdownMenuItem>
                  {canWrite && CANCELLABLE_STATUSES.has(order.status) && (
                    <DropdownMenuItem variant="destructive" onClick={() => setPendingCancel(order)}>
                      <X size={15} /> Cancel order
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [actingId, canWrite, runAction, setDispatching],
  );

  return (
    <PortalShell restaurant={restaurant} active={activeNavKey}>
      <PageHeader
        title={
          sourceFilter === "web"
            ? "Online Orders"
            : sourceFilter === "whatsapp"
              ? "WhatsApp Orders"
              : "Food Orders"
        }
        icon={<ClipboardList size={22} />}
        description={
          sourceFilter === "web"
            ? "Orders placed through your online storefront."
            : sourceFilter === "whatsapp"
              ? "Orders placed through your WhatsApp ordering bot."
              : "All your orders from WhatsApp and your online storefront — in one place."
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {orders && (
        <>
          <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile
              tone="success"
              filled
              icon={<BellRing size={22} />}
              label="New Orders"
              value={viewCounts.new}
              deltaPct={null}
              hint="Awaiting acceptance"
            />
            <StatTile
              tone="warning"
              filled
              icon={<ChefHat size={22} />}
              label="In preparation"
              value={viewCounts.kitchen}
              deltaPct={null}
              hint="Accepted or preparing"
            />
            <StatTile
              tone="info"
              filled
              icon={<PackageCheck size={22} />}
              label="Ready"
              value={viewCounts.ready}
              deltaPct={null}
              hint="Pickup or delivery"
            />
            <StatTile
              tone="violet"
              filled
              icon={<ShieldCheck size={22} />}
              label="Served / Picked up"
              value={viewCounts.served}
              deltaPct={null}
              hint="Completed pickup or dine-in"
            />
            <StatTile
              tone="brand"
              filled
              icon={<XCircle size={22} />}
              label="Cancelled"
              value={viewCounts.cancelled}
              deltaPct={null}
              upIsGood={false}
              hint="All time"
            />
            <StatTile
              tone="clay"
              filled
              icon={<Download size={22} />}
              label="Delivered"
              value={viewCounts.delivered}
              deltaPct={null}
              upIsGood={false}
              hint="Completed deliveries"
            />
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
            <WeeklyTrendChart data={stats.days} title="Order Volume" unit="orders" />
            <PeakHoursChart
              hours={stats.hours}
              periodLabel="Orders by hour of the day, last 30 days"
            />
            <Card className="flex flex-col justify-center gap-space-2 bg-brand-50 p-space-4">
              <div className="flex items-center gap-2">
                <WhatsAppIcon size={22} />
                <p className="text-[13px] font-bold text-brand-700">
                  Orders from WhatsApp,
                  <br />
                  captured in one queue
                </p>
              </div>
              <ul className="mt-space-2 space-y-1 text-[12.5px] text-ink-600">
                <li>✅ No orders missed</li>
                <li>✅ Real-time kitchen updates</li>
                <li>✅ Faster, happier customers</li>
              </ul>
            </Card>
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
            <span
              className={cn(
                "ml-space-1 tabular-nums",
                view === t.id ? "text-white/80" : "text-ink-400",
              )}
            >
              {viewCounts[t.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-space-3 flex flex-wrap items-center gap-space-3 md:flex-nowrap">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            placeholder="Search by Order ID, customer or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />
        </div>
        <Select
          value={sourceFilter}
          onValueChange={(v) =>
            setGlobalChannels(v === "all" ? [] : [v as "web" | "whatsapp" | "app" | "skip_queue"])
          }
          className="!h-10 !w-[170px] shrink-0"
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="web">Website</option>
          <option value="app">App</option>
          <option value="skip_queue">SkipQ</option>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as TypeFilter)}
          className="!h-10 !w-[210px] shrink-0"
          aria-label="Filter by order type"
        >
          <option value="all">Takeaway and delivery</option>
          <option value="pickup">Takeaway only</option>
          <option value="delivery">Delivery only</option>
        </Select>
        <Button
          className="shrink-0"
          variant="secondary"
          size="md"
          onClick={exportCsv}
          disabled={visible.length === 0}
        >
          <Download size={14} /> Export
        </Button>
      </div>

      <Card className="p-space-4">
        {!orders ? (
          <TableSkeleton rows={6} columns={6} />
        ) : orders.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">No orders here yet.</p>
        ) : visible.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">
            No orders match your search or filter.
          </p>
        ) : (
          <DataTable columns={columns} data={visible} getRowId={(o) => String(o.id)} />
        )}
        {orders && period !== "all" && (
          <p className="mt-space-3 text-[12px] text-ink-400">
            Showing orders from {formatRange(range)}.{" "}
            <button
              type="button"
              onClick={() => setPeriod("all")}
              className="font-semibold text-brand-700 hover:underline"
            >
              Show all time
            </button>
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={pendingCancel !== null}
        title={
          pendingCancel
            ? `Cancel order ${pendingCancel.reference_id ?? `#${pendingCancel.id}`}?`
            : ""
        }
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

      {dispatching && (
        <DispatchModal
          order={dispatching}
          busy={actingId === dispatching.id}
          onClose={() => setDispatching(null)}
          onSubmit={(details) => dispatchOrder(dispatching, details)}
        />
      )}

      {detailOrderId !== null && (
        <OrderDetailDrawer orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
      )}
    </PortalShell>
  );
}
