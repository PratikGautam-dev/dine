import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend, erpSendForm } from "@/lib/erp/erp";
import type { PosBranding, PosBrandingInput } from "@/lib/posBranding";
import { queryKeys } from "@/lib/erp/queryKeys";

const URL = "/api/v1/channels/pos/branding";

export function usePosBranding() {
  return useQuery({ queryKey: queryKeys.posBranding, queryFn: () => erpGet<PosBranding>(URL) });
}

export function useSavePosBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PosBrandingInput) => erpSend<PosBranding>(URL, "PUT", body),
    onSuccess: (b) => qc.setQueryData(queryKeys.posBranding, b),
  });
}

/** Upload the tills' logo (JPEG, PNG or WebP up to 1 MB); resolves to its public address, which Save then stores. */
export function useUploadPosLogo() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return erpSendForm<{ image_url: string }>(`${URL}/logo`, form);
    },
  });
}
