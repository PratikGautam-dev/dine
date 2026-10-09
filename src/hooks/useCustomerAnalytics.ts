import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";

export type CustomerAnalytics = {
  total_customers: number;
  tier_distribution: Record<string, number>;
  repeat_rate_pct: number;
  avg_spend_paise: number;
  signups_by_week: { week_start: string; count: number }[];
};

/** Customers page's Analytics tab -- aggregates derived entirely from existing data
 * (list_patients()/the loyalty ledger), no new tracking. */
export function useCustomerAnalytics(ready: boolean) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/patients/analytics");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setAnalytics(result.data as CustomerAnalytics);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { analytics, error };
}
