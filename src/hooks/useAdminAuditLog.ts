import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { superAdminFetch } from "@/lib/superAdminAuth";

/** Mirrors db/repositories/audit_logs.py's get_audit_logs() return shape
 * exactly -- before_value/after_value are arbitrary JSON objects (only the
 * fields that changed, never a full row) or null, actor_level is
 * "platform_admin" (a super-admin's own change via admin/tenants_api.py) or
 * "portal" (a tenant's own staff-portal mutation). */
export type AuditLogEntry = {
  id: number;
  actor_level: "platform_admin" | "portal";
  hospital_id: number | null;
  actor_label: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  created_at: string;
};

/** The platform-wide route additionally injects hospital_name (a lookup, not
 * a join), since an id alone isn't identifying enough once entries span
 * every tenant on the platform. */
export type PlatformAuditLogEntry = AuditLogEntry & { hospital_name: string | null };

/** Loads /api/admin/tenants/{tenantId}/audit-log -- both audit levels for
 * ONE tenant, for the "Activity log" section at the bottom of its detail
 * page. */
export function useTenantAuditLog(tenantId: number) {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await superAdminFetch(`/api/admin/tenants/${tenantId}/audit-log`);
    setLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setEntries((result.data as { entries: AuditLogEntry[] }).entries);
  }, [router, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, error, reload: load };
}

export type PlatformAuditLogFilters = {
  hospitalId: number | null;
  actorLevel: "platform_admin" | "portal" | null;
};

/** Loads /api/admin/audit-log -- the cross-tenant "what's happening across
 * the whole platform" view, optionally narrowed by hospital_id/actor_level
 * (reloads whenever those filters change). */
export function usePlatformAuditLog(filters: PlatformAuditLogFilters) {
  const router = useRouter();
  const [entries, setEntries] = useState<PlatformAuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.hospitalId != null) params.set("hospital_id", String(filters.hospitalId));
    if (filters.actorLevel) params.set("actor_level", filters.actorLevel);
    const qs = params.toString();
    const result = await superAdminFetch(`/api/admin/audit-log${qs ? `?${qs}` : ""}`);
    setLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setEntries((result.data as { entries: PlatformAuditLogEntry[] }).entries);
  }, [router, filters.hospitalId, filters.actorLevel]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, error, reload: load };
}
