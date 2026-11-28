"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffFetch, useStaffSession } from "@/lib/staffAuth";

/** DAAP's three services for Dine (the plan in DAAP Account decides which are on). */
export type DaapService = "pos" | "website" | "whatsapp";

export type DaapStatus =
  | { linked: false; account_url: string | null }
  | {
      linked: true;
      verification:
        | "not_submitted"
        | "verification_pending"
        | "changes_requested"
        | "verified"
        | "rejected"
        | null;
      note: string | null;
      /** true = DAAP keeps the business locked until it has checked it: only the waiting screen opens. */
      awaiting_verification: boolean;
      daap_id: string | null;
      /** the first-open screen (confirm the first outlet) is still to do */
      first_open: boolean;
      services: {
        service: DaapService;
        on: boolean;
        status: string | null;
        plan_name: string | null;
        trial_ends_at: string | null;
      }[];
      /** online payments: the business's own Razorpay account, connected in DAAP Account */
      payments: {
        status: "not_connected" | "pending" | "active" | "restricted" | "disconnected";
        provider: string | null;
        mode: "test" | "live" | null;
        manage_url: string | null;
      };
      account_url: string | null;
      business_url: string | null;
      billing_url: string | null;
    };

export type FirstOpen = {
  done: boolean;
  outlet: {
    id: number;
    name: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
  };
  registered_address: {
    address_line: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
};

export type FirstOpenInput = {
  name: string;
  same_as_registered: boolean;
  address?: { address_line: string; city: string; state: string; pincode: string };
};

const STATUS_KEY = ["daap", "status"] as const;
const FIRST_OPEN_KEY = ["daap", "first-open"] as const;

async function get<T>(path: string): Promise<T> {
  const r = await staffFetch(path);
  if (!r.ok) throw new Error(r.unauthorized ? "Not signed in." : r.error);
  return r.data as T;
}

/** Where DAAP's verification stands and which services the plan has on. The server enforces all of it; the portal only follows
 * (waiting screen, banners, hidden nav items). Re-read every minute, so a verification shows without a reload. */
export function useDaapStatus() {
  const session = useStaffSession();
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => get<DaapStatus>("/api/portal/daap/status"),
    enabled: !!session,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Whether a service is on. A restaurant DAAP doesn't know, or a status not loaded yet, counts as on (never hide while loading). */
export function serviceOn(status: DaapStatus | undefined, service: DaapService): boolean {
  if (!status || !status.linked) return true;
  return status.services.find((s) => s.service === service)?.on ?? false;
}

export function useFirstOpen(enabled: boolean) {
  return useQuery({
    queryKey: FIRST_OPEN_KEY,
    queryFn: () => get<FirstOpen>("/api/portal/daap/first-open"),
    enabled,
  });
}

export function useSaveFirstOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FirstOpenInput) => {
      const r = await staffFetch("/api/portal/daap/first-open", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error(r.unauthorized ? "Not signed in." : r.error);
      return r.data as FirstOpen;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["daap"] }),
  });
}
