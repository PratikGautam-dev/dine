"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

export type EmailTemplateRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  /** false = the restaurant switched this email off: guests don't get it. */
  enabled: boolean;
};

/** One customer email as this restaurant sends it, drawn with a sample order. Read-only. */
export type EmailTemplatePreview = EmailTemplateRow & {
  subject: string;
  html: string;
  from_name: string | null;
  from_address: string | null;
  reply_to: string | null;
  attachment: string | null;
  note: string;
  /** true = the sample uses the restaurant's own dishes. */
  sample_is_real: boolean;
};

const BASE = "/api/v1/store-admin/email-templates";

export function useEmailTemplates(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.emailTemplates,
    queryFn: () => erpGet<{ groups: string[]; templates: EmailTemplateRow[] }>(BASE),
    enabled: options.enabled ?? true,
  });
}

export function useEmailTemplate(key: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.emailTemplate(key),
    queryFn: () => erpGet<EmailTemplatePreview>(`${BASE}/${key}`),
    enabled,
  });
}

/** Switch one customer email on or off for this restaurant. */
export function useSwitchEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) =>
      erpSend<{ key: string; enabled: boolean }>(`${BASE}/${v.key}`, "PUT", { enabled: v.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.emailTemplates }),
  });
}
