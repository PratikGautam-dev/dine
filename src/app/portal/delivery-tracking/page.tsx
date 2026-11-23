"use client";

import { useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Globe,
  Hourglass,
  RefreshCw,
  Search,
  Timer,
  User,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DeliveryDetailPanel,
  StatusPill,
  clock,
  duration,
  minutesBetween,
} from "@/components/portal/DeliveryDetailPanel";
import { DispatchModal } from "@/components/portal/DispatchModal";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { type FoodOrder, orderStatusLabel, useFoodOrders } from "@/hooks/useFoodOrders";
import { useBranchFilter } from "@/lib/branchContext";
import { cn } from "@/lib/cn";
import { isSameLocalDay, parseOrderTime, rupees } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";
import { Select } from "@/components/erp-ui/Select";

const POLL_MS = 10_000;
// Delivery orders are loaded for the last week so "Delivered" and "Cancelled" have something to show; the tiles count today only.
const HISTORY_DAYS = 7;

type TabKey = "live" | "upcoming" | "delivered" | "cancelled";
const TAB_STATUSES: Record<TabKey, string[]> = {
  live: ["out_for_delivery"],
  // delivery orders the kitchen has not handed to a partner yet
  upcoming: ["placed", "paid", "accepted", "preparing", "ready_for_pickup"],
  delivered: ["completed"],
  cancelled: ["cancelled"],
};
const TAB_LABEL: Record<TabKey, string> = {
  live: "Live Deliveries",
  upcoming: "Upcoming",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const TAB_ORDER: TabKey[] = ["live", "upcoming", "delivered", "cancelled"];

function DeliveryRow({
  order,
  selected,
  onSelect,
}: {
  order: FoodOrder;
  selected: boolean;
  onSelect: () => void;
}) {
  const delivered = order.status === "completed";
  const cancelled = order.status === "cancelled";
  const live = order.status === "out_for_delivery";
  const since = order.dispatched_at ?? order.updated_at ?? order.created_at;
  const timeLabel = live
    ? `On the road ${duration(minutesBetween(since, new Date().toISOString()))}`
    : delivered
      ? `Delivered at ${clock(order.updated_at)}`
      : cancelled
        ? `Cancelled at ${clock(order.updated_at)}`
        : `Placed at ${clock(order.created_at)}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-space-3 rounded-lg border px-space-3 py-space-3 text-left transition-colors",
        selected ? "border-brand-300 bg-brand-50/70" : "border-transparent hover:bg-paper",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          delivered
            ? "bg-success-tint text-success"
            : cancelled
              ? "bg-black/[0.04] text-ink-400"
              : "bg-brand-50 text-brand-600",
        )}
      >
        {cancelled ? <XCircle size={20} /> : <Bike size={20} />}
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-[14px] font-bold text-ink-900">
          {order.reference_id ?? `#${order.id}`}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-900">
          <User size={12} className="shrink-0 text-ink-400" />
          <span className="truncate">{order.patient_name || "Guest"}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
          {order.source === "web" ? (
            <Globe size={12} className="shrink-0 text-ink-400" />
          ) : (
            <WhatsAppIcon size={12} />
          )}
          <span className="truncate">{order.source === "web" ? "Website" : order.source === "skip_queue" ? "Skip queue" : "WhatsApp"}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill status={order.status} />
        <span className="text-[12px] font-semibold text-ink-400 tabular-nums">
          {rupees(order.total_paise)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-space-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink-600">
          <Timer size={11} /> {timeLabel}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-400" />
    </button>
  );
}

/** Every delivery order in one place: out on the road, waiting to go out, delivered and cancelled, with the selected order's progress,
 * items, customer and delivery partner beside the list. */
export default function PortalDeliveryTrackingPage() {
  const { restaurant, ready } = usePortalGuard();
  const { orders, error, actingId, load, runAction, dispatchOrder } = useFoodOrders(
    ready,
    "",
    HISTORY_DAYS,
    POLL_MS,
    useBranchFilter().selectedBranchId,
  );
  const canWrite = usePermission("food_orders", "write");

  const [tab, setTab] = useState<TabKey>("live");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"" | "web" | "whatsapp">("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // the order whose delivery partner is being entered / corrected
  const [dispatching, setDispatching] = useState<FoodOrder | null>(null);

  const delivery = useMemo(
    () => (orders || []).filter((o) => o.fulfillment_type === "delivery"),
    [orders],
  );
  const byTab = useMemo(() => {
    const newestFirst = (a: FoodOrder, b: FoodOrder) =>
      parseOrderTime(b.created_at).getTime() - parseOrderTime(a.created_at).getTime();
    return Object.fromEntries(
      TAB_ORDER.map((k) => [
        k,
        delivery.filter((o) => TAB_STATUSES[k].includes(o.status)).sort(newestFirst),
      ]),
    ) as Record<TabKey, FoodOrder[]>;
  }, [delivery]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = (o: FoodOrder) =>
      isSameLocalDay(parseOrderTime(o.updated_at || o.created_at), now);
    const deliveredToday = byTab.delivered.filter(today);
    const timed = deliveredToday.filter((o) => o.dispatched_at);
    const avg = timed.length
      ? Math.round(
          timed.reduce(
            (sum, o) => sum + minutesBetween(o.dispatched_at as string, o.updated_at),
            0,
          ) / timed.length,
        )
      : null;
    return {
      deliveredToday: deliveredToday.length,
      avg,
      cancelledToday: byTab.cancelled.filter(today).length,
    };
  }, [byTab]);

  const statusOptions = useMemo(() => [...new Set(byTab[tab].map((o) => o.status))], [byTab, tab]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return byTab[tab].filter(
      (o) =>
        (!source || o.source === source) &&
        (!status || o.status === status) &&
        (!q ||
          (o.reference_id ?? `#${o.id}`).toLowerCase().includes(q) ||
          (o.patient_name ?? "").toLowerCase().includes(q) ||
          o.phone.includes(q)),
    );
  }, [byTab, tab, query, source, status]);
  const selected = visible.find((o) => o.id === selectedId) ?? visible[0] ?? null;

  return (
    <PortalShell restaurant={restaurant} active="delivery-tracking">
      <PageHeader
        title="Delivery Tracking"
        icon={<Bike size={22} />}
        description="Track all out-for-delivery orders in real time, managed by DAAP Delivery."
        actions={
          <span className="flex items-center gap-space-2 rounded-lg bg-brand-50 px-space-3 py-2 text-[14px] font-bold text-brand-700">
            <Bike size={20} /> DAAP Delivery
          </span>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {orders && (
        <div
          className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-3 xl:grid-cols-5"
          data-testid="delivery-status"
        >
          <StatTile
            icon={<Bike size={22} />}
            label="Out for Delivery"
            value={byTab.live.length}
            deltaPct={null}
            hint="With DAAP Delivery"
          />
          <StatTile
            icon={<Hourglass size={22} />}
            label="Upcoming"
            value={byTab.upcoming.length}
            deltaPct={null}
            hint="Not handed over yet"
          />
          <StatTile
            icon={<CheckCircle2 size={22} />}
            label="Delivered Today"
            value={stats.deliveredToday}
            deltaPct={null}
            hint="Completed deliveries"
          />
          <StatTile
            icon={<Timer size={22} />}
            label="Avg. Delivery Time"
            value={stats.avg === null ? "—" : `${stats.avg} min`}
            deltaPct={null}
            hint={
              stats.avg === null ? "No timed deliveries today" : "Handed over → delivered, today"
            }
          />
          <StatTile
            icon={<XCircle size={22} />}
            label="Cancelled Today"
            value={stats.cancelledToday}
            deltaPct={null}
            upIsGood={false}
            hint="Delivery orders"
          />
        </div>
      )}

      <Card className="mb-space-3 p-space-3">
        <div className="flex flex-wrap items-center gap-space-3">
          <div role="tablist" aria-label="Delivery views" className="flex flex-wrap gap-space-1">
            {TAB_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => {
                  setTab(k);
                  setStatus("");
                  setSelectedId(null);
                }}
                className={cn(
                  "border-b-2 px-space-3 py-2 text-[13px] font-semibold",
                  tab === k
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-600 hover:text-ink-900",
                )}
              >
                {TAB_LABEL[k]} ({byTab[k].length})
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-space-2">
            <label className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-space-2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Order ID, Customer, Phone…"
                aria-label="Search deliveries"
                className="h-9 w-64 rounded-md border border-line bg-card pr-space-2 pl-8 text-[12.5px] text-ink-900"
              />
            </label>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as "" | "web" | "whatsapp")}
              aria-label="Source"
            >
              <option value="">All Sources</option>
              <option value="web">Website</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v)} aria-label="Status">
              <option value="">All Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel({ status: s, fulfillment_type: "delivery" })}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => load()}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-brand-700 hover:bg-paper"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </Card>

      {!orders ? null : visible.length === 0 ? (
        <Card className="p-space-4">
          <p className="rounded-lg border border-dashed border-line py-space-5 text-center text-[12.5px] text-ink-400">
            {tab === "live" && byTab.live.length === 0
              ? "No deliveries on the road right now."
              : query || source || status
                ? "No deliveries match these filters."
                : `No ${TAB_LABEL[tab].toLowerCase()} deliveries.`}
          </p>
        </Card>
      ) : (
        <div className="grid items-start gap-space-3 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)]">
          <div
            className="max-h-[780px] space-y-space-2 overflow-y-auto pr-1"
            data-testid="delivery-list"
          >
            {visible.map((o) => (
              <DeliveryRow
                key={o.id}
                order={o}
                selected={selected?.id === o.id}
                onSelect={() => setSelectedId(o.id)}
              />
            ))}
          </div>
          {selected && (
            <DeliveryDetailPanel
              key={selected.id}
              order={selected}
              canWrite={canWrite}
              busy={actingId === selected.id}
              onAssign={() => setDispatching(selected)}
              onDelivered={() => runAction(selected, "complete")}
            />
          )}
        </div>
      )}

      {dispatching && (
        <DispatchModal
          order={dispatching}
          busy={actingId === dispatching.id}
          onClose={() => setDispatching(null)}
          onSubmit={(details) => dispatchOrder(dispatching, details)}
        />
      )}
    </PortalShell>
  );
}
