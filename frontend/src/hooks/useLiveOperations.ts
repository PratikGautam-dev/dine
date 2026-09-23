import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type LiveBooking = {
  id: number;
  scheduled_at: string;
  patient_name: string | null;
  phone: string;
  party_size: number | null;
  table_name: string | null;
  status: string;
  source: string;
};

export type LiveOrder = {
  id: number;
  reference_id: string | null;
  status: string;
  patient_name: string | null;
  phone: string;
  fulfillment_type: string | null;
  total_paise: number;
  created_at: string;
  item_count: number;
};

export type LiveHandoff = {
  id: number;
  phone: string;
  patient_name: string | null;
  reason: string;
  message_text: string | null;
  created_at: string;
};

export type LiveTable = {
  id: string;
  name: string;
  capacity: number;
  status: "free" | "occupied" | "needs_cleaning" | "blocked";
  department_id: string;
};

export type LiveActivityEvent = {
  kind: "booking" | "order" | "message";
  label: string;
  guest_name: string | null;
  at: string;
};

export type LiveOperationsData = {
  kpis: {
    active_tables_occupied: number;
    active_tables_total: number;
    upcoming_bookings_today: number;
    orders_in_kitchen: number;
    orders_ready: number;
    open_conversations: number;
  };
  bookings_queue: LiveBooking[];
  orders_queue: LiveOrder[];
  handoffs_queue: LiveHandoff[];
  tables: LiveTable[];
  activity_feed: LiveActivityEvent[];
};

// This page is explicitly meant to feel "live" -- shorter than the dashboard's own 20s poll (no
// websocket/SSE infra in this app either, same reasoning usePortalDashboard.ts's own comment gives).
const POLL_INTERVAL_MS = 10_000;

/** Loads + polls /api/portal/live-operations, and owns the action calls each queue/the floor grid
 * triggers -- every action reuses an existing, already-permissioned endpoint (tables/food-orders/
 * bookings/handoffs each enforce their own write permission); this hook never duplicates that logic,
 * just calls it and refetches the summary. */
export function useLiveOperations(ready: boolean) {
  const router = useRouter();
  const [data, setData] = useState<LiveOperationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/live-operations");
    if (!result.ok) {
      if (result.unauthorized) routerRef.current.push("/portal/login");
      else setError(result.error);
      return;
    }
    setData(result.data as LiveOperationsData);
  }, []);

  useEffect(() => {
    if (!ready) return;
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, load]);

  async function runAction(actId: string, path: string, successMessage: string, body?: object) {
    setActingId(actId);
    const result = await portalFetch(path, {
      method: "POST",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    setActingId(null);
    if (!result.ok) {
      if (result.unauthorized) toast.error("Session expired", "Please log in again.");
      else {
        // A 409 means someone else already acted (double tap, or another staff member) -- refresh, don't
        // treat it as a hard failure, same "no-op, not an error" contract the underlying endpoints enforce.
        toast.error("Couldn't update", result.error);
        load();
      }
      return;
    }
    toast.success(successMessage);
    load();
  }

  return {
    data,
    error,
    actingId,
    setTableStatus: (tableId: string, action: "seat" | "clear" | "needs_cleaning") =>
      runAction(`table-${tableId}`, `/api/portal/tables/${tableId}/${action}`, "Table updated"),
    advanceOrder: (orderId: number, action: string) =>
      runAction(`order-${orderId}`, `/api/portal/food-orders/${orderId}/${action}`, "Order updated"),
    markArrived: (bookingId: number) =>
      runAction(`booking-${bookingId}`, `/api/portal/bookings/${bookingId}/attendance`, "Marked arrived", { attended: true }),
  };
}
