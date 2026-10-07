import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type LoyaltySettings = {
  enabled: boolean;
  paise_per_point: number;
  vip_spend_threshold_paise: number;
  redeem_points: number;
  redeem_value_paise: number;
  vip_benefit: string;
};

/** Loyalty settings for this restaurant (migration 0063): earn rate, VIP threshold, redemption and the VIP benefit text. */
export function useLoyaltySettings(ready: boolean) {
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/loyalty");
    if (result.ok) setSettings(result.data as LoyaltySettings);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function update(patch: Partial<LoyaltySettings>): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch("/api/portal/settings/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!result.ok)
      return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    setSettings(result.data as LoyaltySettings);
    toast.success("Loyalty settings updated");
    return null;
  }

  return { settings, saving, update };
}
