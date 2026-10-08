"use client";

// REAL best-effort reorder: starts a fresh cart for the order's restaurant and adds each line
// from the order's own item snapshot (menu_item_id/item_name_snapshot/unit_price_paise_snapshot).
// Snapshot items may no longer exist on the live menu or may have changed price since this order
// was placed -- this intentionally does NOT re-validate against the live menu (that would need an
// extra fetch); it's a best-effort "put what you ordered last time back in the cart", same as the
// real create/update flows elsewhere in this app trust the price the caller provides at order
// time, not a live re-check. After adding every line, routes to /order/cart to review before
// placing.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { toast } from "@/lib/toast";
import type { OrderSummary } from "./OrderHistory";

export function useReorder() {
  const router = useRouter();
  const { startNewCart, addItem } = useCart();
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  function reorder(order: OrderSummary) {
    const slug = order.restaurant?.slug;
    const restaurantName = order.restaurant?.name ?? "";
    if (!slug || order.items.length === 0) return;
    setReorderingId(order.id);
    startNewCart(slug, restaurantName);
    for (const line of order.items) {
      for (let i = 0; i < line.quantity; i++) {
        addItem(slug, restaurantName, {
          menu_item_id: line.menu_item_id,
          name: line.item_name_snapshot,
          price_paise: line.unit_price_paise_snapshot,
          image_url: null,
        });
      }
    }
    toast.success(`Added ${order.items.length} item${order.items.length === 1 ? "" : "s"} from your last order`);
    setReorderingId(null);
    router.push("/order/cart");
  }

  return { reorder, reorderingId };
}
