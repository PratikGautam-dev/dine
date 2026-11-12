import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalRestaurant, portalFetch, type PortalRestaurant } from "@/lib/portalAuth";
import { rangeParams, type DateRange } from "@/lib/globalFilter";

export type DashboardData = {
  restaurant: PortalRestaurant;
  stats: {
    today_appointments: number;
    today_appointments_delta_pct: number | null;
    confirmed_today: number;
    confirmed_today_delta_pct: number | null;
    new_patients_today: number;
    new_patients_today_delta_pct: number | null;
    no_shows_today: number;
    no_shows_today_delta_pct: number | null;
    upcoming_appointments: number;
  };
  weekly_counts: { date: string; label: string; count: number }[];
  department_breakdown: { department_name: string; count: number }[];
  activity_feed: {
    label: string;
    guest_name: string | null;
    phone: string;
    doctor_name: string | null;
    table_name: string | null;
    party_size: number | null;
    department_name: string;
    at: string;
  }[];
  recent_appointments: {
    id: number;
    phone: string;
    patient_name: string | null;
    patient_display_id: string | null;
    department_name: string;
    doctor_name: string | null;
    table_name: string | null;
    party_size: number | null;
    scheduled_at: string;
    status: string;
    source: string;
    reference_id: string | null;
  }[];
};

// New bookings (WhatsApp or staff-created) don't push to this tab -- there's
// no websocket/SSE infra in this app -- so poll instead of fetching once on
// mount, otherwise the numbers only ever update on a manual page reload.
const POLL_INTERVAL_MS = 20_000;

/** Loads + polls the /portal/dashboard stats. `range` (from the header's period filter) limits every number, the
 * trend, the by-section split and both lists to those dates; null is the original "today / last 7 days" view. */
export function usePortalDashboard(
  ready: boolean,
  branchId: string | null = null,
  range: DateRange | null = null,
) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ query: string; data: DashboardData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<PortalRestaurant | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  // Branch and period together make the request; a response is only used (and only shown) for the request
  // that is current. An unfiltered "All Branches" fetch can take longer than a filtered one, so switching
  // quickly can otherwise let a slower, now-stale response land after the new one and overwrite it.
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set("branch_id", branchId);
    if (range) for (const [k, v] of Object.entries(rangeParams(range))) params.set(k, v);
    const text = params.toString();
    return text ? `?${text}` : "";
  }, [branchId, range]);
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async () => {
    const requested = query;
    const result = await portalFetch(`/api/portal/dashboard${requested}`);
    if (queryRef.current !== requested) return; // another branch or period was selected meanwhile
    if (!result.ok) {
      if (result.unauthorized) routerRef.current.push("/portal/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setLoaded({ query: requested, data: result.data as DashboardData });
  }, [query]);

  useEffect(() => {
    if (!ready) return;
    setRestaurant(getPortalRestaurant());
    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, load]);

  // while a newly chosen period is loading, show the loading state, not the previous period's numbers
  const data = loaded && loaded.query === query ? loaded.data : null;
  return { data, error, restaurant };
}
