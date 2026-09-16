"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import {
  CANCELLABLE_STATUSES, FoodOrder, NEXT_ACTION_BY_STATUS, STATUS_LABELS, useFoodOrders,
} from "@/hooks/useFoodOrders";

const FILTERS = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_TONE: Record<string, "brand" | "clay" | "success" | "neutral"> = {
  pending_payment: "neutral",
  paid: "clay",
  accepted: "clay",
  preparing: "brand",
  ready_for_pickup: "brand",
  out_for_delivery: "brand",
  completed: "success",
  cancelled: "neutral",
};

function OrderCard({ order, actingId, runAction }: {
  order: FoodOrder; actingId: number | null; runAction: (order: FoodOrder, action: string) => void;
}) {
  const nextAction = NEXT_ACTION_BY_STATUS[order.status];
  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const busy = actingId === order.id;

  return (
    <Card className="p-space-4">
      <div className="mb-space-2 flex items-start justify-between gap-space-2">
        <div>
          <h3 className="text-body-lg font-semibold">{order.reference_id ?? `Order #${order.id}`}</h3>
          <p className="text-[12px] text-ink-400">{order.phone}</p>
        </div>
        <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{STATUS_LABELS[order.status] ?? order.status}</Badge>
      </div>
      <p className="mb-space-1 text-[13px] text-ink-600">
        {order.fulfillment_type === "delivery" ? `Delivery: ${order.delivery_address}` : "Pickup"}
      </p>
      {order.items && order.items.length > 0 && (
        <ul className="mb-space-2 text-[13px] text-ink-600">
          {order.items.map((line) => (
            <li key={line.menu_item_id}>{line.quantity}x {line.item_name_snapshot}</li>
          ))}
        </ul>
      )}
      <p className="mb-space-3 text-[13px] font-semibold">Total: ₹{(order.total_paise / 100).toFixed(2)}</p>
      {(nextAction || canCancel) && (
        <div className="flex gap-space-2">
          {nextAction && (
            <Button disabled={busy} onClick={() => runAction(order, nextAction.action)}>
              {busy ? "…" : nextAction.label}
            </Button>
          )}
          {canCancel && (
            <Button variant="secondary" disabled={busy} onClick={() => runAction(order, "cancel")}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PortalFoodOrdersPage() {
  const { hospital, ready } = usePortalGuard();
  const [statusFilter, setStatusFilter] = useState("");
  const { orders, error, actingId, runAction } = useFoodOrders(ready, statusFilter);

  return (
    <PortalShell hospital={hospital} active="food-orders">
      <PageHeader title="Orders" description="Incoming food orders, from payment through completion." />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 flex flex-wrap gap-space-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-space-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
              statusFilter === f.value ? "bg-brand-600 text-white" : "bg-paper text-ink-600 hover:text-ink-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!orders ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-[13px] text-ink-400">No orders here yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} actingId={actingId} runAction={runAction} />
          ))}
        </div>
      )}
    </PortalShell>
  );
}
