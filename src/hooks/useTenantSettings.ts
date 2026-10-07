import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type Branding = {
  primary_color?: string;
  logo_url?: string;
  invoice_footer_text?: string;
};

export type TenantSettings = {
  currency: string;
  date_format: string;
  tax_inclusive_prices: boolean;
  default_tax_rate: number;
  branding: Branding;
};

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

/** General Settings' own data source (migration 0061) -- currency/date format/tax fields/
 * branding. tax_inclusive_prices/default_tax_rate/branding are stored for reference only; no tax
 * engine or branded-invoice rendering exists yet to consume them. */
export function useTenantSettings(ready: boolean) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/tenant");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setSettings(result.data as TenantSettings);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function update(patch: Partial<TenantSettings>): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch("/api/portal/settings/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!result.ok)
      return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    setSettings(result.data as TenantSettings);
    toast.success("General settings updated");
    return null;
  }

  return { settings, error, saving, update, reload: load };
}
