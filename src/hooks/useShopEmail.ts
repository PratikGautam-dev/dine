"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** The restaurant's one customer-facing email (Settings > Notifications). */
export type ShopEmail = {
  /** false = the platform has no email provider set up, so codes can't be sent. */
  configured: boolean;
  email: string | null;
  verified: boolean;
  verified_at: string | null;
  shop_name: string;
  /** The platform address guests see after the restaurant's name. */
  platform_address: string | null;
  replies_go_to: string | null;
  sending_from: string | null;
};

const BASE = "/api/v1/store-admin/email-sender";

export function useShopEmail(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.shopEmail,
    queryFn: () => erpGet<ShopEmail>(BASE),
    enabled: options.enabled ?? true,
  });
}

function useShopEmailMutation<T, R>(fn: (arg: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shopEmail }),
  });
}

/** Saves the address (unconfirmed) and emails it a code; the answer's `challenge` goes back with the code. */
export const useStartShopEmail = () =>
  useShopEmailMutation((email: string) =>
    erpSend<{ challenge: string; expires_in: number }>(`${BASE}/start`, "POST", { email }),
  );

export const useVerifyShopEmail = () =>
  useShopEmailMutation((v: { code: string; challenge: string }) =>
    erpSend<ShopEmail>(`${BASE}/verify`, "POST", v),
  );

export const useRemoveShopEmail = () =>
  useShopEmailMutation(() => erpSend<ShopEmail>(BASE, "DELETE"));

export const useTestShopEmail = () =>
  useMutation({ mutationFn: () => erpSend<{ sent: boolean }>(`${BASE}/test`, "POST") });
