"use client";

// Re-skinned onto dine-client's app/track/page.tsx visual structure (status bar + timeline + map
// on the left, courier/outlet/summary/actions on the right). Every real behavior from the previous
// version is unchanged: the auth gate, the load()/10s-poll effects, the pending_payment and
// cancelled special screens, and cancelOrder() -- only the JSX and the split into
// src/components/storefront/tracking/* components changed. The LiveMap and DeliveryPartnerCard
// pieces are decorative-only (see their own files); nothing else here is.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { formatOrderTime } from "@/lib/foodOrders";
import { STATUS_LABELS, STATUS_TONE, trackerStepIndex } from "@/components/storefront/orderStatus";
import { OrderStatusBar } from "@/components/storefront/tracking/OrderStatusBar";
import { TrackingTimeline } from "@/components/storefront/tracking/TrackingTimeline";
import { LiveMap } from "@/components/storefront/tracking/LiveMap";
import { DeliveryPartnerCard } from "@/components/storefront/tracking/DeliveryPartnerCard";
import { OutletContactCard } from "@/components/storefront/tracking/OutletContactCard";
import { TrackedOrderSummary } from "@/components/storefront/tracking/TrackedOrderSummary";
import { TrackingActions } from "@/components/storefront/tracking/TrackingActions";

type OrderItem = {
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_paise_snapshot: number;
  quantity: number;
};

type Order = {
  id: number;
  public_id: string;
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
    const result = await publicFetch<{ order: Order }>(`/api/public/orders/${orderId}/cancel`, {
      method: "POST",
    });
    setCancelling(false);
    setConfirmCancel(false);
    if (result.ok) setOrder(result.data.order);
    else setError(result.error);
  }

  if (error)
    return (
      <div className="mx-auto max-w-[560px] px-4 py-space-9 text-center font-sf-body text-[13.5px] text-sf-error">
        {error}
      </div>
    );

  if (!order) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-space-6 sm:px-8">
        <div className="h-[300px] animate-pulse rounded-2xl bg-sf-surface-container" />
      </div>
    );
  }

  if (order.status === "pending_payment") {
    return (
      <div className="mx-auto flex max-w-[440px] flex-col items-center px-4 py-space-9 text-center">
        <p className="mb-space-4 font-sf-body text-[14px] font-semibold text-sf-on-surface">
          This order is awaiting payment.
        </p>
        <Button href={`/order/pay/${order.public_id}`}>Complete payment</Button>
      </div>
    );
  }

  const stepIndex = trackerStepIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-space-6 sm:px-8">
      <OrderStatusBar
        orderId={order.id}
        restaurantName={order.restaurant?.name}
        status={order.status}
        statusLabel={STATUS_LABELS[order.status] || order.status}
        statusTone={STATUS_TONE[order.status]}
        isTerminal={isTerminal}
      />
      <p className="mb-space-5 font-sf-body text-[12.5px] text-sf-text-muted">
        Placed {formatOrderTime(order.created_at)}
      </p>

      {isCancelled ? (
        <Card className="p-space-5 text-center">
          <p className="font-sf-body text-[13.5px] font-semibold text-sf-on-surface">
            This order was cancelled.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-space-5 lg:grid-cols-12">
          <div className="flex flex-col gap-space-5 lg:col-span-7">
            <TrackingTimeline
              stepIndex={stepIndex}
              restaurantName={order.restaurant?.name}
              fulfillmentType={order.fulfillment_type}
              deliveryAddress={order.delivery_address}
              paymentMethod={order.payment_method}
            />
            {!isTerminal && <LiveMap outletLabel={order.restaurant?.name} />}
          </div>

          <div className="flex flex-col gap-space-5 lg:col-span-5">
            {!isTerminal && <DeliveryPartnerCard />}
            <OutletContactCard restaurantName={order.restaurant?.name} />
            {order.fulfillment_type === "delivery" && order.delivery_address && (
              <Card className="flex items-start gap-space-2 p-space-5 font-sf-body text-[13px] text-sf-text-body">
                <MapPin size={15} className="mt-0.5 shrink-0 text-sf-text-muted" />
                {order.delivery_address}
              </Card>
            )}
            <TrackedOrderSummary
              items={order.items}
              subtotalPaise={order.subtotal_paise}
              deliveryFeePaise={order.delivery_fee_paise}
              discountPaise={order.discount_paise}
              totalPaise={order.total_paise}
            />
            <TrackingActions
              cancellable={CANCELLABLE_STATUSES.includes(order.status)}
              cancelling={cancelling}
              confirmOpen={confirmCancel}
              onRequestCancel={() => setConfirmCancel(true)}
              onConfirmCancel={cancelOrder}
              onDismissConfirm={() => setConfirmCancel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
