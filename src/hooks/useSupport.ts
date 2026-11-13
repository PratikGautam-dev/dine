"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend, erpSendForm, qs } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";
import type { SupportPriority, SupportStatus } from "@/lib/support";

export type SupportAttachment = {
  url: string;
  name: string;
  content_type: string;
  size: number;
};

export type SupportMessage = {
  id: string;
  kind: "message" | "status";
  author_type: "business" | "platform";
  author_name: string;
  body: string;
  created_at: string;
};

export type SupportTicket = {
  id: string;
  ticket_number: string;
  category_id: string | null;
  category_name: string | null;
  subject: string;
  question: string;
  problem_reference: string | null;
  priority: SupportPriority;
  status: SupportStatus;
  attachments: SupportAttachment[];
  message_count?: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type SupportTicketDetail = SupportTicket & { messages: SupportMessage[] };
export type SupportCategory = { id: string; name: string };

export function useSupportCategories() {
  return useQuery({
    queryKey: queryKeys.supportCategories,
    queryFn: () => erpGet<SupportCategory[]>("/api/v1/support/categories"),
  });
}

export function useSupportTickets(status: SupportStatus | "", q: string) {
  const params = { status: status || null, q: q || null };
  return useQuery({
    queryKey: queryKeys.supportTickets(params),
    queryFn: () =>
      erpGet<{
        items: SupportTicket[];
        counts: Record<SupportStatus, number>;
        /** The restaurant's Business ID, quoted when calling or e-mailing the platform team. */
        business_id: string | null;
      }>(`/api/v1/support/tickets${qs(params)}`),
  });
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: queryKeys.supportTicket(id),
    queryFn: () => erpGet<SupportTicketDetail>(`/api/v1/support/tickets/${id}`),
  });
}

export type RaiseTicketInput = {
  subject: string;
  question: string;
  priority: SupportPriority;
  category_id: string;
  problem_reference: string;
  files: File[];
};

/** Raises a ticket as one multipart request, images included. */
export function useRaiseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RaiseTicketInput) => {
      const form = new FormData();
      form.append("subject", input.subject);
      form.append("question", input.question);
      form.append("priority", input.priority);
      if (input.category_id) form.append("category_id", input.category_id);
      if (input.problem_reference.trim()) form.append("problem_reference", input.problem_reference.trim());
      input.files.forEach((f) => form.append("files", f));
      return erpSendForm<SupportTicket>("/api/v1/support/tickets", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.support }),
  });
}

export function useReplyToTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => erpSend<SupportMessage>(`/api/v1/support/tickets/${id}/messages`, "POST", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.support }),
  });
}
