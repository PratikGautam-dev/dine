"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

export type PolicyKind = "returns" | "privacy" | "terms" | "contact" | "legal";

/** One written policy (Settings > Policies). `body_html` is sanitized by the backend; empty = "No policy set". */
export type StorePolicy = {
  kind: PolicyKind;
  title: string;
  body_html: string;
  published: boolean;
  updated_at: string | null;
};

const BASE = "/api/v1/store-admin/policies";

export function usePolicies() {
  return useQuery({ queryKey: queryKeys.storePolicies, queryFn: () => erpGet<StorePolicy[]>(BASE) });
}

export function useSavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, body_html }: { kind: PolicyKind; body_html: string }) =>
      erpSend<StorePolicy>(`${BASE}/${kind}`, "PUT", { body_html }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storePolicies }),
  });
}

/** The rules the till, website and portal apply to returns (shown on Settings > Policies). */
export type ReturnRules = {
  online_window_days: number;
  pos_window_days: number;
  exchanges_enabled: boolean;
  store_credit_enabled: boolean;
  loyalty_enabled: boolean;
};

export function useReturnRules() {
  return useQuery({ queryKey: queryKeys.returnPolicy, queryFn: () => erpGet<ReturnRules>("/api/v1/tenant/return-policy") });
}

export function useSaveReturnRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ReturnRules>) => erpSend<ReturnRules>("/api/v1/tenant/return-policy", "PUT", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.returnPolicy }),
  });
}
