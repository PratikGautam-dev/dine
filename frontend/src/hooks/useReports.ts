import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";

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
  channel_breakdown: { channel: string; total_orders: number; revenue_paise: number; average_order_value_paise: number; revenue_is_estimated: boolean }[];
  retention_trend: { label: string; repeat_pct: number }[];
  period_days: number;
};

/** Loads /api/portal/reports -- an aggregate over real food_orders + appointments + patients data.
 * No multi-channel (Swiggy/Zomato), payment-method-split, or export exists in this app. */
export function useReports(ready: boolean, days: number) {
  const router = useRouter();
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await portalFetch(`/api/portal/reports?days=${days}`);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setData(result.data as ReportsSummary);
  }, [router, days]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { data, error };
}
