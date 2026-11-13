import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { rangeParams, type DateRange } from "@/lib/globalFilter";

export type ReportsSummary = {
  kpis: {
    total_revenue_paise: number;
    total_revenue_change_pct: number | null;
    total_orders: number;
    total_orders_change_pct: number | null;
    total_reservations: number;
    total_reservations_change_pct: number | null;
    average_order_value_paise: number;
    average_order_value_change_pct: number | null;
    repeat_customers_pct: number | null;
    total_customers: number;
  };
  trend: { date: string; label: string; revenue_paise: number; orders: number }[];
  reservation_outcomes: { department_name: string; count: number }[];
  peak_order_hours: number[];
  top_items: { name: string; orders: number; revenue_paise: number }[];
  channel_breakdown: {
    channel: string;
    total_orders: number;
    revenue_paise: number;
    average_order_value_paise: number;
    revenue_is_estimated: boolean;
  }[];
  retention_trend: { label: string; repeat_pct: number }[];
  period_days: number;
  channel: string | null;
  branch_id: string | null;
};

// whatsapp/web (food_orders.source) and takeaway/delivery (fulfillment_type) are real order-level
// filters; dine_in has no orders at all (a reservation isn't a FoodOrder) so it zeroes every
// order-derived number and leaves reservation KPIs, which are never channel-scoped, untouched.
// Comma-joined sales channel ("whatsapp"/"web") and pickup type ("dine_in"/"takeaway"/"delivery"); see channelParam().
export type ReportChannel = string;

export type BranchComparisonRow = {
  branch_id: string;
  name: string;
  total_orders: number;
  revenue_paise: number;
  average_order_value_paise: number;
};

/** Loads /api/portal/reports/branch-comparison -- one row per active branch, side by side.
 * Always "all branches" by definition (the backend refuses a branch-restricted staff member
 * outright, same as requesting the regular summary with no branch_id), so this never takes a
 * branchId param the way useReports() does. Returns [] for a single-branch restaurant -- the
 * page doesn't render the table in that case. */
export function useBranchComparison(ready: boolean, days: number, channel: ReportChannel = "") {
  const router = useRouter();
  const [rows, setRows] = useState<BranchComparisonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ days: String(days) });
    if (channel) params.set("channel", channel);
    const result = await portalFetch(`/api/portal/reports/branch-comparison?${params.toString()}`);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setRows((result.data as { branches: BranchComparisonRow[] }).branches);
  }, [router, days, channel]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { rows, error };
}

/** Loads /api/portal/reports -- an aggregate over real food_orders + appointments + patients data.
 * `channel` is a real backend filter (db/repositories/reports.py's _channel_where()), not
 * decorative -- payment-method-split is still the one illustrative-only card on this page. */
export function useReports(
  ready: boolean,
  days: number,
  channel: ReportChannel = "",
  branchId: string | null = null,
  // the exact dates (from the header filter); without it the API uses the rolling `days`
  range: DateRange | null = null,
) {
  const router = useRouter();
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;

  const load = useCallback(async () => {
    const requestedBranchId = branchId;
    const params = new URLSearchParams({ days: String(days) });
    if (channel) params.set("channel", channel);
    if (branchId) params.set("branch_id", branchId);
    if (range) for (const [k, v] of Object.entries(rangeParams(range))) params.set(k, v);
    const result = await portalFetch(`/api/portal/reports?${params.toString()}`);
    if (branchIdRef.current !== requestedBranchId) return;
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setData(result.data as ReportsSummary);
  }, [router, days, channel, branchId, range]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { data, error };
}
