"use client";

// REAL (not ported from dine-client's lib/account.ts fake PastOrder[]) -- fetches the same
// GET /api/public/orders this app's old orders/page.tsx used, re-skinned onto the account page's
// "Daap Dine" visual language. The backend's items array (via get_food_order(), shared by both
// the list and detail routes) includes menu_item_id/unit_price_paise_snapshot even though the
// old frontend type for this endpoint only declared item_name_snapshot/quantity -- declared
// fully here so Reorder (useReorder.ts) has what it needs.
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicFetch } from "@/lib/customerAuth";
import { formatOrderTime, rupees } from "@/lib/foodOrders";
import { STATUS_LABELS, STATUS_TONE } from "@/components/storefront/orderStatus";
import { Card } from "./Card";
import { useReorder } from "./useReorder";

export type OrderLine = { menu_item_id: string; item_name_snapshot: string; unit_price_paise_snapshot: number; quantity: number };
export type OrderSummary = {
  id: number;
  public_id: string;
  status: string;
  total_paise: number;
  created_at: string;
  items: OrderLine[];
  restaurant: { name: string; slug: string | null } | null;
};

const TONE_CLASS: Record<string, string> = {
  success: "bg-sf-success-soft text-sf-veg-green",
  warning: "bg-sf-warning-soft text-sf-rating-amber",
  brand: "bg-sf-primary-light text-sf-primary",
  violet: "bg-sf-tertiary/10 text-sf-tertiary",
  clay: "bg-sf-danger-soft text-sf-danger",
  neutral: "bg-sf-surface-container-high text-sf-text-body",
};

export function OrderHistory() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { reorder, reorderingId } = useReorder();

  useEffect(() => {
    publicFetch<{ orders: OrderSummary[] }>("/api/public/orders").then((result) => {
      if (result.ok) setOrders(result.data.orders);
      else setError(result.error);
    });
  }, []);

  if (error) {
    return (
      <Card className="p-6 text-center font-sf-body text-[13.5px] text-sf-error">{error}</Card>
    );
  }

  if (orders === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-sf-surface-container-low" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-10 text-center">
        <span className="material-symbols-outlined text-4xl text-sf-text-muted">receipt_long</span>
        <h3 className="mt-2 font-sf-headline text-lg font-bold text-sf-on-surface">No orders yet</h3>
        <p className="mt-1 font-sf-body text-sm text-sf-text-muted">Your order history will show up here.</p>
        <Link
          href="/order"
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-sf-primary px-5 font-sf-body text-sm font-bold text-sf-on-primary transition-colors hover:bg-sf-secondary"
        >
          Browse restaurants
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const tone = TONE_CLASS[STATUS_TONE[o.status] || "neutral"] || TONE_CLASS.neutral;
        return (
          <Card key={o.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/order/orders/${o.public_id}`} className="truncate font-sf-headline text-[15px] font-bold text-sf-on-surface hover:text-sf-primary">
                    {o.restaurant?.name ?? "Restaurant"}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 font-sf-body text-[10.5px] font-bold uppercase ${tone}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>
                <p className="mt-1 truncate font-sf-body text-[12.5px] text-sf-text-muted">
                  {o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(", ")}
                </p>
                <p className="mt-1 font-sf-body text-[12px] text-sf-text-muted">
                  {formatOrderTime(o.created_at)} • {rupees(o.total_paise)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {o.restaurant?.slug && (
                  <button
                    type="button"
                    onClick={() => reorder(o)}
                    disabled={reorderingId === o.id}
                    className="rounded-lg border border-sf-border-divider px-3 py-1.5 font-sf-body text-xs font-bold text-sf-on-surface transition-colors hover:bg-sf-surface-container-low disabled:opacity-50"
                  >
                    {reorderingId === o.id ? "Adding…" : "Reorder"}
                  </button>
                )}
                <Link
                  href={`/order/orders/${o.public_id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sf-text-muted hover:bg-sf-surface-container-low hover:text-sf-on-surface"
                  aria-label="View order"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
