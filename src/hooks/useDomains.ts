"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** One DNS record the owner adds at their domain provider. `name` is relative to the domain ("@" = the domain itself). */
export type DnsRecord = {
  type: string;
  name: string;
  host: string;
  value: string;
  purpose: "website" | "ownership" | "host";
};

export type DomainStatus = "pending" | "connected" | "attention" | "expired";

/** A shop's own domain (Settings > Domains). `kind: "alias"` = the www twin of an apex, which always redirects to it. */
export type StoreDomain = {
  id: string;
  host: string;
  kind: "custom" | "alias";
  parent_id: string | null;
  is_primary: boolean;
  status: DomainStatus;
  error: string | null;
  dns_records: DnsRecord[];
  last_checked_at: string | null;
  connected_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export type DomainList = {
  /** false = the platform has no website host configured, so domains can't be connected yet. */
  enabled: boolean;
  max_domains: number;
  /** url / primary_url: full addresses from the server (https://, or http:// with the port locally); use them for links. */
  platform: { host: string | null; url: string | null; is_primary: boolean };
  primary_host: string | null;
  primary_url: string | null;
  domains: StoreDomain[];
};

const BASE = "/api/v1/store-admin/domains";

export function useDomains(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.storeDomains,
    queryFn: () => erpGet<DomainList>(BASE),
    enabled: options.enabled ?? true,
    retry: false,
  });
}

function useDomainMutation<T, R>(fn: (arg: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storeDomains }),
  });
}

export const useConnectDomain = () =>
  useDomainMutation((host: string) => erpSend<{ domains: StoreDomain[] }>(BASE, "POST", { host }));

export const useCheckDomain = () =>
  useDomainMutation((id: string) =>
    erpSend<{ domains: StoreDomain[] }>(`${BASE}/${id}/check`, "POST"),
  );

/** `null` = make the platform address primary again. */
export const useSetPrimaryDomain = () =>
  useDomainMutation((domainId: string | null) =>
    erpSend<DomainList>(`${BASE}/primary`, "PUT", { domain_id: domainId }),
  );

export const useRemoveDomain = () =>
  useDomainMutation((id: string) => erpSend<DomainList>(`${BASE}/${id}`, "DELETE"));
