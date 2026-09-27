"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { formatOrderTime, rupees } from "@/lib/foodOrders";
import { STATUS_LABELS, STATUS_TONE, TRACKER_STEPS, trackerStepIndex } from "@/components/storefront/orderStatus";

type OrderItem = { menu_item_id: string; item_name_snapshot: string; unit_price_paise_snapshot: number; quantity: number };

type Order = {
  id: number;
  status: string;
  fulfillment_type: string;
  delivery_address: string | null;
  subtotal_paise: number;
  delivery_fee_paise: number | null;
  discount_paise: number;
  total_paise: number;
  payment_method: string;
  created_at: string;
  items: OrderItem[];
  restaurant: { name: string; slug: string | null } | null;
};

const TERMINAL_STATUSES = ["completed", "cancelled"];
const CANCELLABLE_STATUSES = ["pending_payment", "placed"];
const TRACKER_LABELS: Record<(typeof TRACKER_STEPS)[number], string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready",
  completed: "Done",
};

export default function OrderTrackerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function load() {
    const result = await publicFetch<{ order: Order }>(`/api/public/orders/${orderId}`);
    if (result.ok) setOrder(result.data.order);
    else setError(result.error);
  }

  useEffect(() => {
    if (!getCustomerToken()) {
      router.replace(`/order/login?next=/order/orders/${orderId}`);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, router]);

  useEffect(() => {
    if (!order || TERMINAL_STATUSES.includes(order.status)) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]);

  async function cancelOrder() {
    setCancelling(true);
    const result = await publicFetch<{ order: Order }>(`/api/public/orders/${orderId}/cancel`, { method: "POST" });
    setCancelling(false);
    setConfirmCancel(false);
    if (result.ok) setOrder(result.data.order);
    else setError(result.error);
  }

  if (error) return <div className="mx-auto max-w-[560px] px-space-4 py-space-9 text-center text-[13.5px] text-error">{error}</div>;

  if (!order) {
    return (
      <div className="mx-auto max-w-[560px] px-space-4 py-space-6">
        <div className="h-[300px] animate-pulse rounded-lg bg-line/40" />
      </div>
    );
  }

  if (order.status === "pending_payment") {
    return (
      <div className="mx-auto flex max-w-[440px] flex-col items-center px-space-4 py-space-9 text-center">
        <p className="mb-space-4 text-[14px] font-semibold text-ink-600">This order is awaiting payment.</p>
        <Button href={`/order/pay/${order.id}`}>Complete payment</Button>
      </div>
    );
  }

  const stepIndex = trackerStepIndex(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="mx-auto max-w-[560px] px-space-4 py-space-6">
      <div className="mb-space-5 flex items-center justify-between">
        <div>
          <h1 className="text-display text-[20px]">{order.restaurant?.name}</h1>
          <p className="text-[12.5px] text-ink-500">Order #{order.id} · {formatOrderTime(order.created_at)}</p>
        </div>
        <Badge tone={STATUS_TONE[order.status] || "neutral"}>{STATUS_LABELS[order.status] || order.status}</Badge>
      </div>

      {isCancelled ? (
        <Card className="mb-space-5 p-space-5 text-center">
          <p className="text-[13.5px] font-semibold text-ink-600">This order was cancelled.</p>
        </Card>
      ) : (
        <Card className="mb-space-5 p-space-5">
          <div className="relative flex items-start justify-between">
            <div className="pointer-events-none absolute top-3.5 right-4 left-4 h-0.5 bg-line">
              <div
                className="h-full bg-brand-600 transition-[width] duration-300"
                style={{ width: `${(Math.max(0, stepIndex) / (TRACKER_STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {TRACKER_STEPS.map((step, i) => {
              const done = i <= stepIndex;
              return (
                <div key={step} className="relative z-10 flex flex-1 flex-col items-center gap-space-2 text-center">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-card text-[11px] font-bold",
                      done ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-400",
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn("text-[11px] font-semibold", done ? "text-brand-700" : "text-ink-400")}>
                    {TRACKER_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mb-space-4 p-space-4">
        <h2 className="mb-space-2 flex items-center gap-space-2 text-[13px] font-bold text-ink-900">
          <Package size={15} /> Items
        </h2>
        {order.items.map((item) => (
          <div key={item.menu_item_id} className="flex justify-between border-b border-line py-space-2 text-[13px] last:border-0">
            <span className="text-ink-700">
              {item.quantity}× {item.item_name_snapshot}
            </span>
            <span className="font-semibold text-ink-900">{rupees(item.unit_price_paise_snapshot * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-space-2 space-y-space-1 border-t border-line pt-space-2 text-[13px]">
          <div className="flex justify-between text-ink-600">
            <span>Subtotal</span>
            <span>{rupees(order.subtotal_paise)}</span>
          </div>
          {!!order.delivery_fee_paise && order.delivery_fee_paise > 0 && (
            <div className="flex justify-between text-ink-600">
              <span>Delivery fee</span>
              <span>{rupees(order.delivery_fee_paise)}</span>
            </div>
          )}
          {order.discount_paise > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span>-{rupees(order.discount_paise)}</span>
            </div>
          )}
          <div className="flex justify-between text-[14px] font-bold text-ink-900">
            <span>Total</span>
            <span>{rupees(order.total_paise)}</span>
          </div>
        </div>
      </Card>

      {order.fulfillment_type === "delivery" && order.delivery_address && (
        <Card className="mb-space-4 flex items-start gap-space-2 p-space-4 text-[13px] text-ink-600">
          <MapPin size={15} className="mt-0.5 shrink-0 text-ink-400" />
          {order.delivery_address}
        </Card>
      )}

      {CANCELLABLE_STATUSES.includes(order.status) && (
        <Button variant="destructive" className="w-full" onClick={() => setConfirmCancel(true)}>
          Cancel order
        </Button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message="The restaurant will be notified immediately. This can't be undone."
        confirmLabel="Cancel order"
        destructive
        busy={cancelling}
        onConfirm={cancelOrder}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
