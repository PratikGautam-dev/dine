import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type FoodOrderItem = {
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_paise_snapshot: number;
  quantity: number;
};

export type FoodOrder = {
  id: number;
  phone: string;
  status: string;
  fulfillment_type: string | null;
  delivery_address: string | null;
  subtotal_paise: number;
  total_paise: number;
  reference_id: string | null;
  created_at: string;
  items?: FoodOrderItem[];
};

// One action per status a kitchen/front-of-house action can trigger --
// mirrors backend/portal/routes/food_ordering.py's own action names exactly
// (accept/start_preparing/mark_ready/complete/cancel), never a raw status
// string picked freely by the UI.
export const NEXT_ACTION_BY_STATUS: Record<string, { action: string; label: string } | undefined> = {
  paid: { action: "accept", label: "Accept" },
  accepted: { action: "start_preparing", label: "Start Preparing" },
  preparing: { action: "mark_ready", label: "Mark Ready" },
  ready_for_pickup: { action: "complete", label: "Complete" },
  out_for_delivery: { action: "complete", label: "Complete" },
};

export const CANCELLABLE_STATUSES = new Set(["paid", "accepted", "preparing"]);

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  paid: "Paid",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Loads + owns every status-transition action on the /portal/food-orders
 * page. Each action call is a specific named endpoint (never a raw
 * status-setter), matching the guarded-UPDATE transitions
 * db/repositories/food_orders.py's advance_order_status() itself enforces
 * server-side -- a stale/double-tapped action gets a 409 back, handled here
 * as "refresh, don't crash," not a generic error. */
export function useFoodOrders(ready: boolean, statusFilter: string) {
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    const result = await portalFetch(`/api/portal/food-orders${query}`);
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setOrders((result.data as { food_orders: FoodOrder[] }).food_orders);
  }, [statusFilter]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function runAction(order: FoodOrder, action: string) {
    setActingId(order.id);
    const result = await portalFetch(`/api/portal/food-orders/${order.id}/${action}`, { method: "POST" });
    setActingId(null);
    if (!result.ok) {
      if (result.unauthorized) {
        toast.error("Session expired", "Please log in again.");
      } else {
        // A 409 here means the order already moved on (double tap, or
        // another staff member acted first) -- refresh rather than treat it
        // as a hard failure, same "no-op, not an error" contract
        // advance_order_status() establishes server-side.
        toast.error("Couldn't update order", result.error);
        load();
      }
      return;
    }
    toast.success("Order updated");
    load();
  }

  return { orders, error, actingId, load, runAction };
}
