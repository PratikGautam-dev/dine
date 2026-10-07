"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { formatOrderTime, rupees } from "@/lib/foodOrders";
import { STATUS_LABELS, STATUS_TONE } from "@/components/storefront/orderStatus";

type OrderSummary = {
  id: number;
  public_id: string;
  status: string;
  total_paise: number;
  created_at: string;
  items: { item_name_snapshot: string; quantity: number }[];
  restaurant: { name: string; slug: string | null } | null;
};

export default function OrdersListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCustomerToken()) {
      router.replace("/order/login?next=/order/orders");
      return;
    }
    publicFetch<{ orders: OrderSummary[] }>("/api/public/orders").then((result) => {
      if (result.ok) setOrders(result.data.orders);
      else setError(result.error);
    });
  }, [router]);

  if (error)
    return (
      <div className="mx-auto max-w-[600px] px-space-4 py-space-9 text-center text-[13.5px] text-error">
        {error}
      </div>
    );

  if (orders === null) {
    return (
      <div className="mx-auto max-w-[600px] px-space-4 py-space-6">
        <div className="h-[300px] animate-pulse rounded-lg bg-line/40" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-space-3 px-space-4 py-space-9 text-center">
        <ClipboardList size={32} className="text-ink-300" />
        <p className="text-[14px] font-semibold text-ink-600">No orders yet</p>
        <Link href="/order" className="text-[13px] font-semibold text-brand-600 hover:underline">
          Browse restaurants
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[600px] px-space-4 py-space-6">
      <h1 className="text-display mb-space-5 text-[22px]">My Orders</h1>
      <div className="space-y-space-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/order/orders/${o.public_id}`}
            className="flex items-center gap-space-3 rounded-lg border border-line bg-card p-space-4 shadow-[var(--shadow-sm)] transition-colors hover:border-brand-200"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-space-2">
                <p className="truncate text-[14px] font-bold text-ink-900">{o.restaurant?.name}</p>
                <Badge tone={STATUS_TONE[o.status] || "neutral"}>
                  {STATUS_LABELS[o.status] || o.status}
                </Badge>
              </div>
              <p className="mt-space-1 truncate text-[12.5px] text-ink-500">
                {o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(", ")}
              </p>
              <p className="mt-space-1 text-[12px] text-ink-400">
                {formatOrderTime(o.created_at)} · {rupees(o.total_paise)}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-ink-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
