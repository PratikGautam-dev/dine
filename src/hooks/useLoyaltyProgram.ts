import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";

export type LoyaltyProgram = {
  enabled: boolean;
  paise_per_point: number;
  redeem_points: number;
  redeem_value_paise: number;
  silver_spend_threshold_paise: number;
  silver_benefit: string;
  gold_spend_threshold_paise: number;
  gold_benefit: string;
  platinum_spend_threshold_paise: number;
  platinum_benefit: string;
};

/** Read-only loyalty program rules (tier thresholds/benefits, earn/redeem rates) for the
 * Customers page's Loyalty tab -- same data useLoyaltySettings.ts reads for the Settings page's
 * edit form, but via GET /api/portal/patients/loyalty-program (authorized under "patients"/"view"
 * instead of "settings"/"view") so a role that can see customers but not Settings still sees why
 * a guest is close to (or just reached) their next tier. */
export function useLoyaltyProgram(ready: boolean) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await portalFetch("/api/portal/patients/loyalty-program");
    setLoading(false);
    if (result.ok) setProgram(result.data as LoyaltyProgram);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { program, loading };
}
