"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

export type TaxRule = { id: string; code: string; name: string; rate_bps: number };

/** A tax code's rate bands: the rate for a unit price up to `up_to_minor` (null = no upper bound). */
export type TaxBands = Record<string, { up_to_minor: number | null; rate_bps: number }[]>;

export function useTaxRules() {
  return useQuery({
    queryKey: queryKeys.taxRules,
    queryFn: () => erpGet<TaxRule[]>("/api/v1/tax-rules"),
  });
}

export function useTaxBands() {
  return useQuery({
    queryKey: queryKeys.taxBands,
    queryFn: () => erpGet<TaxBands>("/api/v1/tax-rule-bands"),
  });
}

export type GstRegistration = {
  id: string;
  gstin: string;
  state_code: string;
  state_name: string | null;
  pan: string;
  legal_name: string;
  trade_name: string | null;
  registration_type: "regular" | "composition";
  registered_address: string | null;
  is_default: boolean;
  is_active: boolean;
  branch_count: number;
};

/** The business's GST registrations (one per state), and the branches not linked to any. */
export type GstListing = {
  registrations: GstRegistration[];
  unlinked_branches: {
    id: string;
    branch_code: string;
    branch_name: string;
    state: string | null;
  }[];
};

/** `enabled: false` (e.g. without permission to see them) fetches nothing. */
export function useGstRegistrations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.gstRegistrations,
    queryFn: () => erpGet<GstListing>("/api/v1/tenant/gst-registrations"),
    enabled,
  });
}

function useRefreshGst() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.gstRegistrations });
}

export type GstRegistrationInput = {
  gstin: string;
  legal_name: string;
  trade_name: string | null;
  registration_type: string;
  registered_address: string | null;
  is_default: boolean;
};

/** Add a GST registration (no id) or edit one (`is_active` can then be changed too). */
export function useSaveGstRegistration() {
  const refresh = useRefreshGst();
  return useMutation({
    mutationFn: (input: { id?: string; body: GstRegistrationInput; is_active?: boolean }) =>
      input.id
        ? erpSend(`/api/v1/tenant/gst-registrations/${input.id}`, "PATCH", {
            ...input.body,
            is_active: input.is_active,
          })
        : erpSend("/api/v1/tenant/gst-registrations", "POST", input.body),
    onSuccess: refresh,
  });
}

export function useDeleteGstRegistration() {
  const refresh = useRefreshGst();
  return useMutation({
    mutationFn: (id: string) => erpSend(`/api/v1/tenant/gst-registrations/${id}`, "DELETE"),
    onSuccess: refresh,
  });
}

/** Link a branch to a GST registration (null = none). The caller reloads its own branch list. */
export function useLinkBranchGst() {
  const refresh = useRefreshGst();
  return useMutation({
    mutationFn: (input: { branchId: string; gstRegistrationId: string | null }) =>
      erpSend(`/api/v1/branches/${input.branchId}/gst-registration`, "PUT", {
        gst_registration_id: input.gstRegistrationId,
      }),
    onSuccess: refresh,
  });
}

/** Replace the price bands of a tax code (a rate that depends on the unit price). */
export function useSaveTaxBands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      code: string;
      bands: { up_to_minor: number | null; rate_bps: number }[];
    }) =>
      erpSend(`/api/v1/tax-rules/${encodeURIComponent(input.code)}/bands`, "PUT", {
        bands: input.bands,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.taxes }),
  });
}
