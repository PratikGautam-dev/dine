"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend, type Channel, type ChannelClient } from "@/lib/erp/erp";
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

/** The API keys the channels use to place orders. `enabled: false` fetches nothing. */
export function useChannelClients(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.channelClients,
    queryFn: () => erpGet<ChannelClient[]>("/api/v1/channel-clients"),
    enabled,
  });
}

function useClientMutation<T, V>(fn: (v: V) => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.channelClients }),
        qc.invalidateQueries({ queryKey: queryKeys.channels }),
      ]),
  });
}

/** Create a key for a channel (and optionally one branch). The full key is in the response and is shown only once. */
export function useCreateChannelClient() {
  return useClientMutation((input: { channel: Channel; name: string; branch_id: string | null }) =>
    erpSend<{ api_key: string }>("/api/v1/channel-clients", "POST", input),
  );
}

export function useRevokeChannelClient() {
  return useClientMutation((id: string) => erpSend(`/api/v1/channel-clients/${id}`, "DELETE"));
}

export function useDeleteChannelClient() {
  return useClientMutation((id: string) =>
    erpSend(`/api/v1/channel-clients/${id}/revoked`, "DELETE"),
  );
}
