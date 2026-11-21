"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

export type ModuleKey =
  | "dining"
  | "table_bookings"
  | "kitchen"
  | "delivery"
  | "marketing"
  | "messaging"
  | "feedback"
  | "workforce";

/** One optional module as the server sees it (services/optional_modules.py). `reason` says why an inactive module is off: "parent" is
 * Dining operations being off (the module keeps its own switch). */
export type OptionalModule = {
  key: ModuleKey;
  label: string;
  /** the module it sits under ("dining" for the Dining operations modules) */
  parent: ModuleKey | null;
  /** the platform's switch: false = disabled by Dine Connect, the business can't turn it on */
  allowed: boolean;
  /** the business's own switch */
  enabled: boolean;
  active: boolean;
  reason: "platform" | "business" | "no_service" | "parent" | null;
  /** in-progress work; any of it blocks switching off */
  open_work: {
    key: string;
    label: string;
    count: number;
    amount_minor?: number;
  }[];
};

/** Settings > Modules: Dining operations and its modules, and the standalone modules, with both switches and their open work. */
export function useModules() {
  return useQuery({
    queryKey: queryKeys.modules,
    queryFn: () => erpGet<OptionalModule[]>("/api/v1/tenant/modules"),
  });
}

/** Switch a module on or off for the business. Every query is refetched so the menu follows at once
 * (the master switch touches several pages). */
export function useSwitchModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: ModuleKey; enabled: boolean }) =>
      erpSend<OptionalModule>(`/api/v1/tenant/modules/${key}`, "PUT", {
        enabled,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });
}

/** The modules that are switched off (by the business, the platform or Back office), for the menus. Empty while loading or if the
 * server can't be asked: the menu then shows everything, and the server's own checks stay the real enforcement. */
export function useInactiveModules(): ReadonlySet<ModuleKey> {
  const { data } = useModules();
  return new Set((data ?? []).filter((m) => !m.active).map((m) => m.key));
}
