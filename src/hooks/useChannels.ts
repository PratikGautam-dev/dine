"use client";

import { useQuery } from "@tanstack/react-query";
import { erpGet, type Channel } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

export type ReadinessItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
  href: string;
  required: boolean;
  available: boolean;
};
export type Readiness = {
  channel: Channel;
  label: string;
  /** Dine has no plans: always true. Kept so the ERP's shape is unchanged. */
  in_plan: boolean;
  ended: boolean;
  items: ReadinessItem[];
  met: number;
  total: number;
  ready: boolean;
};

/** The checklist for one channel, worked out by the server from real data. `enabled: false` (no permission) fetches nothing. */
export function useChannelReadiness(channel: Channel, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.channelReadiness(channel),
    queryFn: () => erpGet<Readiness>(`/api/v1/channels/${channel}/readiness`),
    enabled,
  });
}
