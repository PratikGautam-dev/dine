"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle, Bike, CalendarClock, ChefHat, MessageCircle, PackageCheck, Radio, ShoppingBag, Sparkles,
  UserRound, UtensilsCrossed,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { NEXT_ACTION_BY_STATUS, STATUS_LABELS as ORDER_STATUS_LABELS } from "@/hooks/useFoodOrders";
import { type LiveTable, useLiveOperations } from "@/hooks/useLiveOperations";
import { cn } from "@/lib/cn";
import { formatTimeOnly } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

const TABLE_STATUS: Record<LiveTable["status"], { label: string; classes: string }> = {
  free: { label: "Free", classes: "border-success bg-success-tint text-success" },
  occupied: { label: "Occupied", classes: "border-brand-300 bg-brand-50 text-brand-700" },
  needs_cleaning: { label: "Needs cleaning", classes: "border-warning bg-warning-tint text-warning" },
  // Tables page follow-up: deliberately out of service -- Unblock lives on the Tables page's own
  // floor map (where Block/Unblock were built), not here, so a blocked table just shows the badge.
  blocked: { label: "Blocked", classes: "border-accent-violet/40 bg-accent-violet-tint text-accent-violet" },
};

// Same tone tokens StatTile's own icon-squares draw from -- one color per card/event kind so the page
// reads at a glance instead of every panel sharing the same flat gray icon.
const TONE_CLASSES = {
  brand: "bg-brand-50 text-brand-600",
  clay: "bg-clay-100 text-clay-700",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  neutral: "bg-black/[0.04] text-ink-600",
} as const;

function CardIcon({ tone, children }: { tone: keyof typeof TONE_CLASSES; children: ReactNode }) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[tone])}>
      {children}
    </span>
  );
}

const ACTIVITY_ICON = { booking: CalendarClock, order: ChefHat, message: MessageCircle } as const;
const ACTIVITY_TONE = { booking: "clay", order: "warning", message: "brand" } as const;

export default function LiveOperationsPage() {
  const { hospital, ready } = usePortalGuard();
  const { data, error, actingId, setTableStatus, advanceOrder, markArrived } = useLiveOperations(ready);
  const canWriteTables = usePermission("tables", "write");
  const canWriteOrders = usePermission("food_orders", "write");
  const canWriteBookings = usePermission("appointments", "write");

  return (
    <PortalShell hospital={hospital} active="live-operations">
      <PageHeader
        title="Live Operations"
        icon={<Radio size={22} />}
        description="A real-time view across today's bookings, kitchen orders, guest conversations and the floor."
      />

      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {!data ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
      ) : (
        <>
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile
              tone="brand" icon={<UtensilsCrossed size={22} />} label="Active tables" deltaPct={null}
              value={data.kpis.active_tables_occupied} hint={`${data.kpis.active_tables_total} total, occupied now`}
            />
            <StatTile
              tone="clay" icon={<CalendarClock size={22} />} label="Upcoming bookings" deltaPct={null}
              value={data.kpis.upcoming_bookings_today} hint="Still to come today"
            />
            <StatTile
              tone="warning" icon={<ChefHat size={22} />} label="Orders in kitchen" deltaPct={null}
              value={data.kpis.orders_in_kitchen} hint="Accepted or preparing"
            />
            <StatTile
              tone="success" icon={<PackageCheck size={22} />} label="Ready" deltaPct={null}
              value={data.kpis.orders_ready} hint="For pickup or delivery"
            />
            <StatTile
              tone="neutral" icon={<MessageCircle size={22} />} label="Needs a reply" deltaPct={null}
              value={data.kpis.open_conversations} hint="Open guest conversations"
            />
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
            {/* Bookings queue */}
            <Card className="flex flex-col p-0">
              <div className="flex items-center gap-space-3 border-b border-line px-space-4 py-space-3">
                <CardIcon tone="clay"><CalendarClock size={17} /></CardIcon>
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900">Today&apos;s bookings</h3>
                  <p className="text-hint">{data.bookings_queue.length} on the schedule</p>
                </div>
              </div>
              <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {data.bookings_queue.length === 0 && (
                  <p className="px-space-4 py-space-4 text-center text-[13px] text-ink-400">No reservations today.</p>
                )}
                {data.bookings_queue.map((b) => {
                  const SourceIcon = b.source === "whatsapp" ? MessageCircle : UserRound;
                  return (
                  <div key={b.id} className="flex items-center justify-between gap-space-2 px-space-4 py-space-2 text-[13px]">
                    <div className="min-w-0">
                      <div className="font-semibold tabular-nums text-ink-900">{formatTimeOnly(b.scheduled_at)}</div>
                      <div className="flex items-center gap-1 truncate text-ink-600">
                        <SourceIcon size={12} className="shrink-0 text-clay-600" />
                        {b.patient_name || b.phone} · {b.table_name || "—"}{b.party_size ? ` · ${b.party_size}p` : ""}
                      </div>
                    </div>
                    {canWriteBookings && b.status === "booked" ? (
                      <button
                        type="button"
                        disabled={actingId === `booking-${b.id}`}
                        onClick={() => markArrived(b.id)}
                        className="shrink-0 rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {actingId === `booking-${b.id}` ? "…" : "Arrived"}
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-black/[0.04] px-space-2 py-0.5 text-[11px] font-semibold text-ink-600">
                        {b.status === "attended" ? "Attended" : b.status === "no_show" ? "No-show" : b.status}
                      </span>
                    )}
                  </div>
                  );
                })}
              </div>
            </Card>

            {/* Orders queue */}
            <Card className="flex flex-col p-0">
              <div className="flex items-center gap-space-3 border-b border-line px-space-4 py-space-3">
                <CardIcon tone="warning"><ChefHat size={17} /></CardIcon>
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900">Live food orders</h3>
                  <p className="text-hint">{data.orders_queue.length} in progress</p>
                </div>
              </div>
              <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {data.orders_queue.length === 0 && (
                  <p className="px-space-4 py-space-4 text-center text-[13px] text-ink-400">No open orders right now.</p>
                )}
                {data.orders_queue.map((o) => {
                  const next = NEXT_ACTION_BY_STATUS[o.status];
                  const FulfillmentIcon = o.fulfillment_type === "delivery" ? Bike : ShoppingBag;
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-space-2 px-space-4 py-space-2 text-[13px]">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-900">{o.reference_id ?? `#${o.id}`}</div>
                        <div className="flex items-center gap-1 truncate text-ink-600">
                          <FulfillmentIcon size={12} className="shrink-0 text-warning" />
                          {o.patient_name || o.phone} · {o.item_count} item{o.item_count === 1 ? "" : "s"} · {rupees(o.total_paise)}
                        </div>
                        <div className="text-[11.5px] text-ink-400">{ORDER_STATUS_LABELS[o.status] ?? o.status}</div>
                      </div>
                      {canWriteOrders && next && (
                        <button
                          type="button"
                          disabled={actingId === `order-${o.id}`}
                          onClick={() => advanceOrder(o.id, next.action)}
                          className="shrink-0 rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          {actingId === `order-${o.id}` ? "…" : next.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Guest conversations */}
            <Card className="flex flex-col p-0">
              <div className="flex items-center gap-space-3 border-b border-line px-space-4 py-space-3">
                <CardIcon tone="brand"><MessageCircle size={17} /></CardIcon>
                <div>
                  <h3 className="text-[15px] font-bold text-ink-900">Guests needing a reply</h3>
                  <p className="text-hint">{data.handoffs_queue.length} open conversation{data.handoffs_queue.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
                {data.handoffs_queue.length === 0 && (
                  <p className="px-space-4 py-space-4 text-center text-[13px] text-ink-400">Nothing needs a reply right now.</p>
                )}
                {data.handoffs_queue.map((h) => {
                  const ReasonIcon = h.reason === "system_error" ? AlertTriangle : MessageCircle;
                  return (
                  <div key={h.id} className="px-space-4 py-space-2 text-[13px]">
                    <div className="flex items-center justify-between gap-space-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 font-semibold text-ink-900">
                          <ReasonIcon size={12} className={cn("shrink-0", h.reason === "system_error" ? "text-warning" : "text-brand-500")} />
                          {h.patient_name || h.phone}
                        </div>
                        {h.message_text && <div className="truncate text-ink-600" title={h.message_text}>{h.message_text}</div>}
                      </div>
                      <a
                        href={`/portal/messages?handoff=${h.id}`}
                        className="shrink-0 rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700"
                      >
                        Reply
                      </a>
                    </div>
                  </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-[1.4fr_1fr]">
            {/* Floor & table status */}
            <Card className="p-space-4">
              <div className="mb-space-3 flex items-center justify-between gap-space-3">
                <div className="flex items-center gap-space-3">
                  <CardIcon tone="success"><UtensilsCrossed size={17} /></CardIcon>
                  <h3 className="text-[15px] font-bold text-ink-900">Floor &amp; table status</h3>
                </div>
                <p className="text-hint">Staff-set -- Seat when a party sits down, Clear once they leave</p>
              </div>
              {data.tables.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">No active tables yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-space-2 sm:grid-cols-3 xl:grid-cols-4">
                  {data.tables.map((t) => {
                    const style = TABLE_STATUS[t.status];
                    const busy = actingId === `table-${t.id}`;
                    return (
                      <div key={t.id} className={cn("rounded-md border p-space-2", style.classes)}>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold">{t.name}</span>
                          <UserRound size={13} className="opacity-70" />
                        </div>
                        <div className="text-[11.5px]">{t.capacity} seats · {style.label}</div>
                        {canWriteTables && (
                          <div className="mt-space-2 flex flex-wrap gap-1">
                            {t.status === "free" && (
                              <button type="button" disabled={busy} onClick={() => setTableStatus(t.id, "seat")} className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white disabled:opacity-50">
                                Seat
                              </button>
                            )}
                            {t.status === "occupied" && (
                              <>
                                <button type="button" disabled={busy} onClick={() => setTableStatus(t.id, "clear")} className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white disabled:opacity-50">
                                  Clear
                                </button>
                                <button type="button" disabled={busy} onClick={() => setTableStatus(t.id, "needs_cleaning")} className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white disabled:opacity-50">
                                  Needs cleaning
                                </button>
                              </>
                            )}
                            {t.status === "needs_cleaning" && (
                              <button type="button" disabled={busy} onClick={() => setTableStatus(t.id, "clear")} className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-white disabled:opacity-50">
                                <Sparkles size={11} className="mr-0.5 inline" /> Cleared
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Activity feed */}
            <Card className="flex flex-col p-0">
              <div className="flex items-center gap-space-3 border-b border-line px-space-4 py-space-3">
                <CardIcon tone="brand"><Radio size={17} /></CardIcon>
                <h3 className="text-[15px] font-bold text-ink-900">Alerts &amp; activity</h3>
              </div>
              <div className="max-h-[360px] divide-y divide-line overflow-y-auto">
                {data.activity_feed.length === 0 && (
                  <p className="px-space-4 py-space-4 text-center text-[13px] text-ink-400">Nothing yet.</p>
                )}
                {data.activity_feed.map((e, i) => {
                  const Icon = ACTIVITY_ICON[e.kind];
                  const tone = ACTIVITY_TONE[e.kind];
                  return (
                    <div key={i} className="flex items-start gap-space-2 px-space-4 py-space-2 text-[13px]">
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[tone])}>
                        <Icon size={12} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-ink-900">{e.label}{e.guest_name ? ` · ${e.guest_name}` : ""}</div>
                        <div className="text-[11.5px] text-ink-400">{formatTimeOnly(e.at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </PortalShell>
  );
}
