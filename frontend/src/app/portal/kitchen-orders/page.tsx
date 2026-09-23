"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownUp, Bike, ChefHat, Maximize2, PackageCheck, Printer, Settings2, ShoppingBag, Timer, X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChefNotesCard } from "@/components/portal/ChefNotesCard";
import { KitchenLoadDonut } from "@/components/portal/KitchenLoadDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { NEXT_ACTION_BY_STATUS, type FoodOrder, useFoodOrders } from "@/hooks/useFoodOrders";
import { cn } from "@/lib/cn";
import { isSameLocalDay, parseOrderTime, rupees } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

const POLL_MS = 10_000;
const DEFAULT_DELAYED_AFTER_MINUTES = 20;

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - parseOrderTime(iso).getTime()) / 60000));
}

function printSlip(order: FoodOrder) {
  const win = window.open("", "_blank", "width=360,height=600");
  if (!win) return;
  const lines = (order.items || []).map((l) => `<div>${l.quantity} × ${l.item_name_snapshot}</div>`).join("");
  win.document.write(`
    <html><head><title>${order.reference_id ?? order.id}</title>
    <style>body{font-family:monospace;padding:16px;font-size:14px} h1{font-size:16px;margin:0 0 8px}
    hr{border:none;border-top:1px dashed #999;margin:8px 0}</style></head>
    <body>
      <h1>${order.reference_id ?? `#${order.id}`}</h1>
      <div>${order.patient_name || order.phone}</div>
      <div>${order.fulfillment_type === "delivery" ? "Delivery" : "Takeaway"}</div>
      <hr />
      ${lines}
      <hr />
      <div>Total: ${rupees(order.total_paise)}</div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function OrderCard({ order, canWrite, busy, delayedAfter, onAction }: {
  order: FoodOrder; canWrite: boolean; busy: boolean; delayedAfter: number; onAction: (action: string) => void;
}) {
  const next = NEXT_ACTION_BY_STATUS[order.status];
  const age = minutesSince(order.created_at);
  const delayed = age >= delayedAfter && order.status !== "completed" && order.status !== "cancelled";
  const FulfillmentIcon = order.fulfillment_type === "delivery" ? Bike : ShoppingBag;
  return (
    <Card className={cn("p-space-3", delayed && "border-destructive/50 bg-destructive-tint/30")}>
      <div className="mb-space-2 flex items-start justify-between gap-space-2">
        <div>
          <div className="font-mono text-[12px] font-semibold text-ink-900">{order.reference_id ?? `#${order.id}`}</div>
          <div className="flex items-center gap-1 text-[13px] font-semibold text-ink-900">
            {order.patient_name || order.phone}
          </div>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-space-2 py-0.5 text-[11px] font-bold", delayed ? "bg-destructive text-white" : "bg-black/[0.04] text-ink-600")}>
          <Timer size={11} /> {age}m
        </span>
      </div>
      <div className="mb-space-2 flex items-center gap-2 text-[12px] text-ink-600">
        <span className="flex items-center gap-1"><WhatsAppIcon size={13} /> WhatsApp</span>
        <span className="flex items-center gap-1"><FulfillmentIcon size={13} className="text-ink-400" /> {order.fulfillment_type === "delivery" ? "Delivery" : "Takeaway"}</span>
      </div>
      <ul className="mb-space-3 space-y-0.5 text-[13px] text-ink-900">
        {(order.items || []).map((l) => (
          <li key={l.menu_item_id}>{l.quantity} × {l.item_name_snapshot}</li>
        ))}
      </ul>
      <div className="mb-space-3 flex items-center justify-between text-[12.5px]">
        <span className="font-semibold tabular-nums text-ink-900">{rupees(order.total_paise)}</span>
      </div>
      <div className="flex gap-space-2">
        {canWrite && next && (
          <button
            type="button" disabled={busy} onClick={() => onAction(next.action)}
            className="flex-1 rounded-md bg-brand-600 py-space-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "…" : next.label}
          </button>
        )}
        <button
          type="button" onClick={() => printSlip(order)} aria-label="Print slip"
          className="flex items-center justify-center rounded-md border border-line px-space-2 text-ink-600 hover:bg-paper"
        >
          <Printer size={15} />
        </button>
      </div>
    </Card>
  );
}

/** A leaner, auto-refreshing kitchen-display view over the SAME real orders Food Orders shows --
 * no charts/history/search, just what's actively cooking, grouped by stage. */
export default function PortalKitchenOrdersPage() {
  const { hospital, ready } = usePortalGuard();
  const { orders, error, actingId, runAction } = useFoodOrders(ready, "", 1, POLL_MS);
  const canWrite = usePermission("food_orders", "write");

  const [sortDesc, setSortDesc] = useState(false);
  const [delayedAfter, setDelayedAfter] = useState(DEFAULT_DELAYED_AFTER_MINUTES);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  const groups = useMemo(() => {
    const all = orders || [];
    const sort = (list: FoodOrder[]) =>
      [...list].sort((a, b) => (sortDesc ? 1 : -1) * (parseOrderTime(a.created_at).getTime() - parseOrderTime(b.created_at).getTime()));
    const now = new Date();
    return {
      newOrders: sort(all.filter((o) => o.status === "placed" || o.status === "paid")),
      preparing: sort(all.filter((o) => o.status === "accepted" || o.status === "preparing")),
      ready: sort(all.filter((o) => o.status === "ready_for_pickup" || o.status === "out_for_delivery")),
      served: sort(all.filter((o) => o.status === "completed" && isSameLocalDay(parseOrderTime(o.created_at), now))).slice(0, 10),
    };
  }, [orders, sortDesc]);

  const delayed = useMemo(() => {
    const active = [...groups.newOrders, ...groups.preparing, ...groups.ready];
    return active.filter((o) => minutesSince(o.created_at) >= delayedAfter).sort((a, b) => minutesSince(b.created_at) - minutesSince(a.created_at));
  }, [groups, delayedAfter]);

  // "Placed to completed" (the only two timestamps a food order actually has) -- an honest proxy
  // for kitchen speed, not a precise "prep time" (which would need a per-transition timestamp
  // history this schema doesn't keep).
  const avgOrderMinutes = useMemo(() => {
    const now = new Date();
    const completedToday = (orders || []).filter((o) => o.status === "completed" && isSameLocalDay(parseOrderTime(o.updated_at || o.created_at), now));
    if (completedToday.length === 0) return null;
    const totalMin = completedToday.reduce((sum, o) => sum + Math.max(0, (parseOrderTime(o.updated_at || o.created_at).getTime() - parseOrderTime(o.created_at).getTime()) / 60000), 0);
    return Math.round(totalMin / completedToday.length);
  }, [orders]);

  const columns: { key: "newOrders" | "preparing" | "ready" | "served"; label: string; icon: typeof ChefHat }[] = [
    { key: "newOrders", label: "New Orders", icon: ChefHat },
    { key: "preparing", label: "In Preparation", icon: Timer },
    { key: "ready", label: "Ready to Serve", icon: PackageCheck },
    { key: "served", label: "Served / Picked Up", icon: PackageCheck },
  ];

  return (
    <div ref={containerRef} className={cn(fullscreen && "overflow-y-auto bg-paper p-space-4")}>
      <PortalShell hospital={hospital} active="kitchen-orders">
        <PageHeader
          title="Kitchen Orders (KDS)"
          icon={<ChefHat size={22} />}
          description="Real-time kitchen orders — refreshes automatically."
          actions={
            <>
              <div className="relative">
                <button type="button" onClick={() => setShowSettings((s) => !s)} className="flex items-center gap-1 rounded-md border border-line bg-card px-space-3 py-2 text-[12.5px] font-semibold text-ink-600 hover:bg-paper">
                  <Settings2 size={14} /> KDS Settings
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-11 z-20 w-64 rounded-md border border-line bg-card p-space-3 shadow-[var(--shadow-md)]">
                    <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Flag as delayed after (minutes)</label>
                    <input
                      type="number" min={1} value={delayedAfter} onChange={(e) => setDelayedAfter(Math.max(1, Number(e.target.value) || 1))}
                      className="h-9 w-full rounded-md border border-line bg-card px-space-2 text-[13px]"
                    />
                    <button type="button" onClick={() => setShowSettings(false)} className="mt-space-2 text-[12px] font-semibold text-brand-700 hover:underline">Done</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={toggleFullscreen} className="flex items-center gap-1 rounded-md border border-line bg-card px-space-3 py-2 text-[12.5px] font-semibold text-ink-600 hover:bg-paper">
                <Maximize2 size={14} /> Full Screen
              </button>
            </>
          }
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {orders && (
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile tone="success" filled icon={<ChefHat size={22} />} label="New Tickets" value={groups.newOrders.length} deltaPct={null} hint="Awaiting acceptance" />
            <StatTile tone="warning" filled icon={<Timer size={22} />} label="In Preparation" value={groups.preparing.length} deltaPct={null} hint="On the line" />
            <StatTile tone="info" filled icon={<PackageCheck size={22} />} label="Ready to Serve" value={groups.ready.length} deltaPct={null} hint="Pickup or delivery" />
            <StatTile tone="brand" filled icon={<AlertTriangle size={22} />} label="Delayed" value={delayed.length} deltaPct={null} upIsGood={false} hint={`Over ${delayedAfter} min`} />
            <StatTile
              tone="violet" filled icon={<Timer size={22} />} label="Avg Order Time" deltaPct={null}
              value={avgOrderMinutes ?? 0} hint={avgOrderMinutes === null ? "No completed orders yet today" : "min · placed → completed, today"}
            />
          </div>
        )}

        <div className="mb-space-3 flex justify-end">
          <button type="button" onClick={() => setSortDesc((s) => !s)} className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-600 hover:text-brand-700">
            <ArrowDownUp size={13} /> Sort by time: {sortDesc ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {!orders ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
        ) : (
          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-4">
            {columns.map(({ key, label, icon: Icon }) => (
              <div key={key}>
                <div className="mb-space-2 flex items-center gap-2">
                  <Icon size={16} className="text-ink-600" />
                  <h3 className="text-[14px] font-bold text-ink-900">{label}</h3>
                  <span className="text-hint">{groups[key].length}</span>
                </div>
                <div className="max-h-[600px] space-y-space-3 overflow-y-auto pr-1">
                  {groups[key].length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line py-space-4 text-center text-[12.5px] text-ink-400">Nothing here right now.</p>
                  ) : (
                    groups[key].map((o) => (
                      <OrderCard key={o.id} order={o} canWrite={canWrite} busy={actingId === o.id} delayedAfter={delayedAfter} onAction={(action) => runAction(o, action)} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-3">
          <KitchenLoadDonut newOrders={groups.newOrders.length} preparing={groups.preparing.length} ready={groups.ready.length} />

          <Card className="p-space-4">
            <div className="mb-space-3 flex items-center gap-space-2">
              <AlertTriangle size={16} className="text-destructive" />
              <h3 className="text-[15px] font-bold text-ink-900">Priority Orders</h3>
              <span className="text-hint">{delayed.length} delayed</span>
            </div>
            {delayed.length === 0 ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">Nothing is running late.</p>
            ) : (
              <div className="max-h-[280px] space-y-space-2 overflow-y-auto">
                {delayed.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md bg-destructive-tint/40 p-space-2 text-[12.5px]">
                    <div>
                      <div className="font-mono font-semibold text-ink-900">{o.reference_id ?? `#${o.id}`}</div>
                      <div className="text-ink-600">{o.patient_name || o.phone}</div>
                    </div>
                    <span className="flex items-center gap-1 font-bold text-destructive"><Timer size={12} /> {minutesSince(o.created_at)}m</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <ChefNotesCard ready={ready} canWrite={canWrite} />
        </div>
      </PortalShell>
    </div>
  );
}
