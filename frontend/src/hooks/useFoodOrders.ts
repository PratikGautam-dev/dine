import { useCallback, useEffect, useRef, useState } from "react";
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
  // the guest's name from their profile at this restaurant; null when they never gave one
  patient_name: string | null;
  status: string;
  fulfillment_type: string | null;
  delivery_address: string | null;
  subtotal_paise: number;
  delivery_fee_paise: number | null;
  total_paise: number;
  payment_method: "online" | "pay_at_restaurant";
  reference_id: string | null;
  created_at: string;
  // Was already returned by the backend (advance_order_status() stamps it on every transition) but
  // never declared here until the Kitchen Orders page's real avg-order-time metric needed it.
  updated_at: string;
  // Web Storefront: which front door this order came through. Every order predates 'web' as
  // 'whatsapp' (the column's own DB default) -- see food-orders/page.tsx's own Source column.
  source: "whatsapp" | "web";
  mock_payment_ref: string | null;
  items?: FoodOrderItem[];
};

// One action per status a kitchen/front-of-house action can trigger --
// mirrors backend/portal/routes/food_ordering.py's own action names exactly
// (accept/start_preparing/mark_ready/complete/cancel), never a raw status
// string picked freely by the UI.
export const NEXT_ACTION_BY_STATUS: Record<string, { action: string; label: string } | undefined> = {
  placed: { action: "accept", label: "Accept" },
  paid: { action: "accept", label: "Accept" },
  accepted: { action: "start_preparing", label: "Start Preparing" },
  preparing: { action: "mark_ready", label: "Mark Ready" },
  ready_for_pickup: { action: "complete", label: "Complete" },
  out_for_delivery: { action: "complete", label: "Complete" },
};

export const CANCELLABLE_STATUSES = new Set(["placed", "paid", "accepted", "preparing"]);

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  placed: "New order",
  paid: "Paid",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_pickup: "Ready for Takeaway",
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
export function useFoodOrders(ready: boolean, statusFilter: string, days = 90, pollMs?: number, branchId: string | null = null) {
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  // Guards against an older, slower (e.g. unfiltered "All Branches") request resolving AFTER a
  // newer one and clobbering its correct data.
  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;

  const load = useCallback(async () => {
    const requestedBranchId = branchId;
    // days limits how far back the list goes (0 = all time), so a page load never fetches every order ever placed
    const query = `?days=${days}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`;
    const result = await portalFetch(`/api/portal/food-orders${query}`);
    if (branchIdRef.current !== requestedBranchId) return;
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setOrders((result.data as { food_orders: FoodOrder[] }).food_orders);
  }, [statusFilter, days, branchId]);

  useEffect(() => {
    if (!ready) return;
    load();
    // Optional -- the Kitchen Orders display wants this live (no websocket/SSE infra in this app,
    // same reasoning every other "live" page this session polls for); the main Food Orders page
    // leaves pollMs unset and keeps its existing "load once, reload after an action" behavior.
    if (!pollMs) return;
    const interval = setInterval(load, pollMs);
    return () => clearInterval(interval);
  }, [ready, load, pollMs]);

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

export type OrderStatusHistoryEntry = {
  from_status: string;
  to_status: string;
  changed_by: string | null;
  created_at: string;
};

export type OrderPayment = {
  id: number;
  method: string;
  provider: string | null;
  status: "pending" | "paid" | "failed";
  amount_paise: number;
  provider_payment_id: string | null;
  paid_at: string | null;
};

export type OrderRefund = {
  id: number;
  amount_paise: number;
  reason: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type FoodOrderDetail = {
  food_order: FoodOrder;
  status_history: OrderStatusHistoryEntry[];
  payment: OrderPayment | null;
  refunds: OrderRefund[];
};

/** Loads a single order's full detail -- status timeline (migration 0057) and payment/refund
 * record (migration 0056) -- for the Food Orders page's detail drawer. Separate from the list
 * hook above since the list itself doesn't need this per-order detail, only the drawer does. */
export function useFoodOrderDetail(orderId: number | null) {
  const [detail, setDetail] = useState<FoodOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const idRef = useRef(orderId);
  idRef.current = orderId;

  const load = useCallback(async () => {
    if (orderId == null) {
      setDetail(null);
      return;
    }
    const requestedId = orderId;
    setLoading(true);
    const result = await portalFetch(`/api/portal/food-orders/${orderId}`);
    setLoading(false);
    if (idRef.current !== requestedId) return;
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't load order", result.error);
      return;
    }
    setDetail(result.data as FoodOrderDetail);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function issueRefund(amountPaise: number, reason: string): Promise<boolean> {
    if (orderId == null) return false;
    setRefunding(true);
    const result = await portalFetch(`/api/portal/food-orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_paise: amountPaise, reason: reason || null }),
    });
    setRefunding(false);
    if (!result.ok) {
      if (result.unauthorized) toast.error("Session expired", "Please log in again.");
      else toast.error("Couldn't issue refund", result.error);
      return false;
    }
    toast.success("Refund recorded");
    load();
    return true;
  }

  return { detail, loading, refunding, issueRefund, reload: load };
}
