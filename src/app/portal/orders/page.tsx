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
  IndianRupee,
  MoreHorizontal,
  PackageCheck,
  Receipt,
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
import { DispatchModal } from "@/components/portal/DispatchModal";
import { OrderDetailDrawer } from "@/components/portal/OrderDetailDrawer";
import { PeakHoursChart } from "@/components/portal/PeakHoursChart";
import { BILL_STATUS_LABEL, PosBillDrawer } from "@/components/portal/PosBillDrawer";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Select } from "@/components/erp-ui/Select";
import { useBranchFilter } from "@/lib/branchContext";
import { cn } from "@/lib/cn";
import { formatOrderTime, rupees, type OrderView } from "@/lib/foodOrders";
import {
  CHANNEL_LABEL,
  ORDER_CHANNELS,
  ORDER_PERIODS,
  ORDER_PICKUPS,
  PICKUP_LABEL,
  formatRange,
  usePageChannels,
  usePagePeriod,
  usePagePickups,
  type GlobalChannel,
  type GlobalPickup,
} from "@/lib/globalFilter";
import { usePermission } from "@/lib/staffAuth";
import {
  CANCELLABLE_STATUSES,
  NOTIFIABLE_STATUSES,
  STATUS_TONE,
  nextActionFor,
  orderStatusLabel,
  useFoodOrderActions,
  type FoodOrder,
} from "@/hooks/useFoodOrders";
import { fetchAllOrders, useOrders, useSalesSummary, type OrderRow } from "@/hooks/useOrders";

const VIEW_TABS: { id: OrderView; label: string; always: boolean }[] = [
  { id: "all", label: "All Orders", always: true },
  { id: "new", label: "New", always: true },
  { id: "kitchen", label: "In the kitchen", always: true },
  { id: "ready", label: "Ready", always: true },
  { id: "completed", label: "Completed", always: true },
  { id: "cancelled", label: "Cancelled", always: true },
  { id: "awaiting_payment", label: "Awaiting payment", always: false },
];

const PAGE_SIZE = 50;
const MAX_LINES_SHOWN = 3;
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  due: "On credit",
};
// The links an older version of the portal used (?source=web).
const OLD_SOURCE: Record<string, GlobalChannel> = { web: "website", skip_queue: "skipq" };

/** How the order is paid, in the words staff use at the counter. */
function paymentLine(row: OrderRow): string {
  if (row.kind === "pos") {
    if (row.status === "complimentary") return "Complimentary";
    const methods = row.bill?.payment_methods ?? [];
    return methods.length
      ? methods.map((m) => METHOD_LABEL[m] ?? m).join(" · ")
      : "Paid at the till";
  }
  if (row.payment_method === "pay_at_restaurant") {
    return row.order_type === "delivery" ? "Pays on delivery" : "Pays at the restaurant";
  }
  return row.status === "pending_payment" ? "Awaiting online payment" : "Paid online";
}

function statusLabel(row: OrderRow): string {
  if (row.kind === "pos") return BILL_STATUS_LABEL[row.status] ?? row.status;
  return orderStatusLabel({
    status: row.status,
    fulfillment_type: row.food_order?.fulfillment_type ?? null,
  });
}

function ChannelCell({ channel }: { channel: GlobalChannel }) {
  if (channel === "whatsapp")
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-ink-700">
        <WhatsAppIcon size={16} /> WhatsApp
      </span>
    );
  const tone = channel === "pos" ? "violet" : channel === "skipq" ? "clay" : "brand";
  return <Badge tone={tone}>{CHANNEL_LABEL[channel]}</Badge>;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Orders from every channel -- WhatsApp, Website, App, skipQ and the till (POS) -- in one list (backend sales/orders.py). Online
 * orders keep their actions; a till bill opens read-only, because the till runs those orders. */
export default function PortalOrdersPage() {
  const { restaurant, ready } = usePortalGuard();
  const { range, period, label: periodLabel, setPeriod } = usePagePeriod(ORDER_PERIODS);
  const { channels, setChannels } = usePageChannels(ORDER_CHANNELS);
  const { pickups, setPickups } = usePagePickups(ORDER_PICKUPS);
  const branchId = useBranchFilter().selectedBranchId;
  const canWrite = usePermission("food_orders", "write");

  const [view, setView] = useState<OrderView>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pendingCancel, setPendingCancel] = useState<FoodOrder | null>(null);
  const [dispatching, setDispatching] = useState<FoodOrder | null>(null);
  const [openOrder, setOpenOrder] = useState<{ kind: "online" | "pos"; id: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({ range, branchId, channels, pickups }),
    [range, branchId, channels, pickups],
  );
  const { page, error, loading, reload } = useOrders(
    ready,
    filters,
    view,
    search,
    offset,
    PAGE_SIZE,
  );
  const { summary, reload: reloadSummary } = useSalesSummary(ready, filters);
  const { actingId, runAction, dispatchOrder } = useFoodOrderActions(() => {
    reload();
    reloadSummary();
  });

  // Links from elsewhere: the sidebar's channel entries (?source=whatsapp|website, ?source=all) set the starting channel, and a
  // customer's purchase history opens one order (?open=<id>&kind=online|pos). Read once on arrival (useSearchParams would need a
  // Suspense boundary to prerender); later header changes must stick.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const channel = source ? (OLD_SOURCE[source] ?? source) : null;
    if (channel && (ORDER_CHANNELS as readonly string[]).includes(channel))
      setChannels([channel as GlobalChannel]);
    else if (source === "all") setChannels([]);
    const open = params.get("open");
    const kind = params.get("kind");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address on arrival
    if (open) setOpenOrder({ id: open, kind: kind === "pos" ? "pos" : "online" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typing searches after a short pause, from the first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any other filter change starts again from the first page.
  const filterKey = `${period}|${range.from?.getTime()}|${branchId}|${channels.join()}|${pickups.join()}|${view}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setOffset(0);
  }

  const counts = page?.counts;
  const singleChannel = channels.length === 1 ? channels[0] : null;

  async function exportCsv() {
    setExporting(true);
    const rows = await fetchAllOrders(filters, view, search);
    setExporting(false);
    const header = [
      "Order",
      "Channel",
      "Order type",
      "Customer",
      "Phone",
      "Placed",
      "Amount (INR)",
      "Payment",
      "Status",
    ];
    const lines = rows.map((r) => [
      r.number,
      CHANNEL_LABEL[r.channel],
      PICKUP_LABEL[r.order_type],
      r.customer_name ?? "",
      r.customer_phone ?? "",
      formatOrderTime(r.placed_at),
      (r.total_paise / 100).toFixed(2),
      paymentLine(r),
      statusLabel(r),
    ]);
    const csv = [header, ...lines]
      .map((r) => r.map((c) => csvCell(String(c))).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <div className="whitespace-nowrap font-mono text-[12px] font-semibold text-ink-900">
            {row.original.number}
          </div>
        ),
      },
      {
        id: "guest",
        header: "Customer",
        cell: ({ row }) => {
          const o = row.original;
          const name = o.customer_name || o.customer_phone;
          return (
            <div className="min-w-[110px] text-ink-900">
              <div className="font-semibold">{name || (o.kind === "pos" ? "Walk-in" : "—")}</div>
              {o.customer_name && o.customer_phone && (
                <div className="text-[12px] text-ink-600">{o.customer_phone}</div>
              )}
            </div>
          );
        },
      },
      {
        id: "channel",
        header: "Channel",
        cell: ({ row }) => <ChannelCell channel={row.original.channel} />,
      },
      {
        id: "type",
        header: "Order Type",
        cell: ({ row }) => {
          const o = row.original;
          const tone =
            o.order_type === "delivery"
              ? "violet"
              : o.order_type === "dine_in"
                ? "brand"
                : "success";
          return (
            <div className="whitespace-nowrap">
              <Badge tone={tone}>{PICKUP_LABEL[o.order_type]}</Badge>
              {o.table_name && (
                <div className="mt-0.5 text-[12px] text-ink-600">{o.table_name}</div>
              )}
            </div>
          );
        },
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => {
          const lines = row.original.items;
          return (
            <ul className="min-w-[140px] text-[13px] text-ink-900">
              {lines.slice(0, MAX_LINES_SHOWN).map((l, i) => (
                <li key={i}>
                  {l.quantity} × {l.name}
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
            {formatOrderTime(row.original.placed_at)}
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
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const o = row.original;
          const tone =
            o.kind === "pos"
              ? o.status === "settled"
                ? "success"
                : "warning"
              : (STATUS_TONE[o.status] ?? "neutral");
          return (
            <div className="whitespace-nowrap">
              <Badge tone={tone}>{statusLabel(o)}</Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const o = row.original;
          if (o.kind === "pos") {
            return (
              <div className="flex justify-end">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => setOpenOrder({ kind: "pos", id: o.id })}
                >
                  <Receipt size={14} /> View bill
                </Button>
              </div>
            );
          }
          const order = o.food_order;
          if (!order) return null;
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
                  aria-label={`Notify ${o.customer_name || o.customer_phone} on WhatsApp about order ${o.number}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-space-3 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50"
                >
                  <Bell size={14} /> Notify
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More actions for order ${o.number}`}
                  disabled={busy}
                  className="inline-flex h-10 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50"
                >
                  <MoreHorizontal size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setOpenOrder({ kind: "online", id: order.id })}>
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
    [actingId, canWrite, runAction],
  );

  const days = summary?.by_day ?? [];
  const trend = days.map((d) => ({
    date: d.date,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString(
      "en-IN",
      days.length <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" },
    ),
    count: d.orders,
  }));
  const revenueDelta =
    summary?.previous && summary.previous.revenue_paise > 0
      ? Math.round(
          ((summary.revenue_paise - summary.previous.revenue_paise) /
            summary.previous.revenue_paise) *
            100,
        )
      : null;
  const total = page?.total ?? 0;

  return (
    <PortalShell restaurant={restaurant} active="orders">
      <PageHeader
        title={singleChannel ? `${CHANNEL_LABEL[singleChannel]} Orders` : "Orders"}
        icon={<ClipboardList size={22} />}
        description={
          singleChannel === "pos"
            ? "Bills settled on your tills. They open read-only: the till runs those orders."
            : singleChannel
              ? `Orders placed through ${CHANNEL_LABEL[singleChannel]}.`
              : "Every order in one place: WhatsApp, your website, the app, skipQ and your tills."
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {counts && (
        <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            tone="success"
            icon={<BellRing size={22} />}
            label="New Orders"
            value={counts.new}
            deltaPct={null}
            hint="Awaiting acceptance"
          />
          <StatTile
            tone="warning"
            icon={<ChefHat size={22} />}
            label="In preparation"
            value={counts.kitchen}
            deltaPct={null}
            hint="Accepted or preparing"
          />
          <StatTile
            tone="info"
            icon={<PackageCheck size={22} />}
            label="Ready"
            value={counts.ready}
            deltaPct={null}
            hint="Pickup or delivery"
          />
          <StatTile
            tone="violet"
            icon={<ShieldCheck size={22} />}
            label="Completed"
            value={counts.completed}
            deltaPct={null}
            hint="Served, collected, delivered or billed"
          />
          <StatTile
            tone="brand"
            icon={<XCircle size={22} />}
            label="Cancelled"
            value={counts.cancelled}
            deltaPct={null}
            upIsGood={false}
            hint={periodLabel}
          />
          <StatTile
            tone="clay"
            icon={<IndianRupee size={22} />}
            label="Sales"
            value={summary ? rupees(summary.revenue_paise) : "—"}
            deltaPct={revenueDelta}
            hint={
              summary
                ? `${summary.orders} orders · vs the period before`
                : "Pick a period to see sales"
            }
          />
        </div>
      )}

      {summary && (
        <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
          <WeeklyTrendChart
            data={trend}
            title="Order Volume"
            unit="orders"
            periodLabel={`${periodLabel} · ${formatRange(range)}`}
          />
          <PeakHoursChart
            hours={summary.by_hour}
            periodLabel={`Orders by hour of the day, ${periodLabel.toLowerCase()}`}
          />
          <Card className="p-space-4">
            <h3 className="text-[15px] font-bold text-ink-900">Sales by channel</h3>
            <p className="mb-space-3 text-hint">{periodLabel}</p>
            {summary.by_channel.length === 0 ? (
              <p className="text-[13px] text-ink-400">No sales in this period.</p>
            ) : (
              <ul className="space-y-space-2 text-[13px]">
                {summary.by_channel.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-space-2">
                    <ChannelCell channel={c.key as GlobalChannel} />
                    <span className="tabular-nums text-ink-600">
                      {c.orders} ·{" "}
                      <span className="font-semibold text-ink-900">{rupees(c.revenue_paise)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mb-space-3 flex flex-wrap gap-space-2">
        {VIEW_TABS.filter((t) => t.always || (counts?.[t.id] ?? 0) > 0 || view === t.id).map(
          (t) => (
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
                {counts?.[t.id] ?? 0}
              </span>
            </button>
          ),
        )}
      </div>

      <div className="mb-space-3 flex flex-wrap items-center gap-space-3 md:flex-nowrap">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            placeholder="Search by order or bill number, customer or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search orders"
            className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />
        </div>
        <Select
          value={singleChannel ?? "all"}
          onValueChange={(v) => setChannels(v === "all" ? [] : [v as GlobalChannel])}
          className="!h-10 !w-[170px] shrink-0"
          aria-label="Filter by channel"
        >
          <option value="all">All channels</option>
          {ORDER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </Select>
        <Select
          value={pickups.length === 1 ? pickups[0] : "all"}
          onValueChange={(v) => setPickups(v === "all" ? [] : [v as GlobalPickup])}
          className="!h-10 !w-[190px] shrink-0"
          aria-label="Filter by order type"
        >
          <option value="all">Every order type</option>
          {ORDER_PICKUPS.map((p) => (
            <option key={p} value={p}>
              {PICKUP_LABEL[p]}
            </option>
          ))}
        </Select>
        <Button
          className="shrink-0"
          variant="secondary"
          size="md"
          onClick={exportCsv}
          disabled={total === 0 || exporting}
        >
          <Download size={14} /> {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>

      <Card className="p-space-4">
        {!page ? (
          <TableSkeleton rows={6} columns={6} />
        ) : page.orders.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">
            {search || view !== "all" || channels.length || pickups.length
              ? "No orders match your search or filter."
              : "No orders here yet."}
          </p>
        ) : (
          <div className={cn(loading && "opacity-60 transition-opacity")}>
            <DataTable columns={columns} data={page.orders} getRowId={(o) => `${o.kind}-${o.id}`} />
          </div>
        )}
        {page && total > 0 && (
          <div className="mt-space-3 flex flex-wrap items-center justify-between gap-space-2 text-[12.5px] text-ink-600">
            <span className="tabular-nums">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-space-2">
              <Button
                size="md"
                variant="secondary"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="md"
                variant="secondary"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        {page && period !== "all" && (
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

      {openOrder?.kind === "online" && (
        <OrderDetailDrawer orderId={openOrder.id} onClose={() => setOpenOrder(null)} />
      )}
      {openOrder?.kind === "pos" && (
        <PosBillDrawer billId={openOrder.id} onClose={() => setOpenOrder(null)} />
      )}
    </PortalShell>
  );
}
