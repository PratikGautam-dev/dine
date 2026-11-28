import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { superAdminFetch } from "@/lib/superAdminAuth";

/** Direct mirror of usePlatformOffers.ts's shape, talking to
 * /api/admin/tenants{,/\{id\}} -- admin/tenants_api.py's "correct an
 * already-onboarded restaurant" API, not the separate onboarding flow. */
export type TenantSummary = {
  id: number;
  name: string;
  whatsapp_phone_number_id: string;
  data_tier: string;
  is_active: boolean;
};

/** The DAAP business behind a restaurant (restaurants come only from DAAP Core; the owner signs in with DAAP). */
export type TenantDaap = {
  business_id: string | null;
  verification: string | null;
  owner_email: string | null;
  owner_name: string | null;
};

/** Mirrors admin/tenants_api.py's _tenant_detail() exactly -- field-for-field,
 * including the "masked, never round-tripped" credential fields and the
 * capability/feature catalogs the detail page renders its checkbox grids
 * from (all_capabilities, default_capabilities, feature_default_labels). */
export type TenantDetail = {
  id: number;
  name: string;
  whatsapp_phone_number_id: string;
  access_token_masked: string;
  app_secret_masked: string;
  welcome_message_text: string;
  reminder_offsets_hours: string;
  reminder_template_name: string;
  data_tier: string;
  external_api_base_url: string;
  external_api_key: string;
  is_active: boolean;
  /** null for a restaurant made before DAAP */
  daap: TenantDaap | null;
  enabled_features: string[];
  feature_default_labels: Record<string, string>;
  admin_capabilities: string[];
  all_capabilities: string[];
  default_capabilities: string[];
  appointment_types: unknown[];
};

/** Body shape for POST /api/admin/tenants/{id}, matching TenantUpdatePayload.
 * enabled_features/admin_capabilities are "omit the key entirely
 * to leave unchanged, send it (even []) to set it" per the backend's
 * model_fields_set distinction -- hence they're optional here, and callers
 * that want to touch them must include the key even when empty. */
export type TenantUpdatePayload = {
  name?: string;
  whatsapp_phone_number_id?: string;
  access_token?: string;
  app_secret?: string;
  welcome_message_text?: string;
  reminder_offsets_hours?: string;
  reminder_template_name?: string;
  data_tier?: string;
  api_base_url?: string;
  api_key?: string;
  enabled_features?: string[];
  admin_capabilities?: string[];
};

/** Loads /api/admin/tenants -- the restaurant list, summary-shaped. */
export function useAdminTenantsList() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await superAdminFetch("/api/admin/tenants");
    setLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setTenants((result.data as { tenants: TenantSummary[] }).tenants);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return { tenants, loading, error, reload: load };
}

/** Loads/updates /api/admin/tenants/{id} -- the full edit-tenant detail. */
export function useAdminTenantDetail(tenantId: number) {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await superAdminFetch(`/api/admin/tenants/${tenantId}`);
    setLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setTenant((result.data as { tenant: TenantDetail }).tenant);
  }, [router, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  /** POSTs the update; returns null on success (and refreshes `tenant`), or
   * the backend's `errors: string[]` array on a 400 validation failure. */
  async function updateTenant(payload: TenantUpdatePayload): Promise<string[] | null> {
    const result = await superAdminFetch(`/api/admin/tenants/${tenantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      if (result.unauthorized) {
        router.push("/admin/login");
        return null;
      }
      return [result.error];
    }
    const data = result.data as { tenant?: TenantDetail; errors?: string[] };
    if (data.errors) return data.errors;
    if (data.tenant) setTenant(data.tenant);
    return null;
  }

  return { tenant, loading, error, reload: load, updateTenant };
}

/** Loads /api/admin/stats/total-bookings -- a single platform-wide lifetime
 * count, deliberately not bundled into useAdminTenantsList since it's an
 * unrelated metric shown as a small tile above that list, not part of it. */
export function useTotalBookingsStat() {
  const router = useRouter();
  const [totalBookings, setTotalBookings] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await superAdminFetch("/api/admin/stats/total-bookings");
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        if (result.unauthorized) router.push("/admin/login");
        return;
      }
      setTotalBookings((result.data as { total_bookings: number }).total_bookings);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { totalBookings, loading };
}
