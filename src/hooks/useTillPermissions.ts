"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** One action a role may be given on the POS till (the backend's pos/till_permissions.py catalogue). */
export type TillPermission = { key: string; group: string; label: string; hint: string };
export type TillRole = { permissions: string[]; max_discount_bps: number; is_default: boolean };
type View = { catalogue: TillPermission[]; roles: Record<string, TillRole> };

/** The Till tab of Roles & Permissions: the catalogue of till actions and what each role holds there. */
export function useTillPermissions(canView: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.tillPermissions,
    queryFn: () => erpGet<View>("/api/portal/roles/till-permissions"),
    enabled: canView,
  });

  /** Saves one role's till permissions. Returns an error message, or null on success. */
  async function save(
    role: string,
    permissions: string[],
    maxDiscountBps: number,
  ): Promise<string | null> {
    try {
      const saved = await erpSend<TillRole & { role: string }>(
        `/api/portal/roles/${encodeURIComponent(role)}/till-permissions`,
        "PUT",
        {
          permissions,
          max_discount_bps: maxDiscountBps,
        },
      );
      qc.setQueryData<View>(queryKeys.tillPermissions, (prev) =>
        prev ? { ...prev, roles: { ...prev.roles, [role]: saved } } : prev,
      );
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return {
    catalogue: query.data?.catalogue ?? null,
    roles: query.data?.roles ?? null,
    error: query.error ? query.error.message : null,
    save,
  };
}
