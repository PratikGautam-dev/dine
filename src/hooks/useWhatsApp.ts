"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** The restaurant's own WhatsApp number as connected through Meta's Cloud API. */
export type WhatsAppAccount =
  | { connected: false; webhook_url: string; verify_token: string | null }
  | {
      connected: true;
      waba_id: string;
      phone_number_id: string;
      display_phone: string;
      verified_name: string | null;
      quality_rating: string | null;
      access_token_hint: string;
      has_app_secret: boolean;
      approved_templates: number;
      last_checked_at: string | null;
      last_error: string | null;
      webhook_url: string;
      verify_token: string | null;
      webhook_verified_at: string | null;
      last_message_at: string | null;
      connected_at: string;
    };

export type WhatsAppForm = {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  app_secret: string;
};
export type WhatsAppTemplate = {
  id?: string | null;
  name: string;
  status: string;
  category?: string;
  language?: string;
  /** The body text, with {{1}}, {{2}} … where values go. */
  body?: string | null;
};

/** `enabled: false` (no permission) fetches nothing. */
export function useWhatsAppAccount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.whatsappAccount,
    queryFn: () => erpGet<WhatsAppAccount>("/api/v1/whatsapp/account"),
    enabled,
  });
}

/** Connecting or disconnecting changes the WhatsApp channel's checklist and its templates. */
function useRefreshWhatsApp() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.whatsapp }),
      qc.invalidateQueries({ queryKey: queryKeys.channels }),
    ]);
}

/** Save the connection (Meta checks the details first). */
export function useSaveWhatsAppAccount() {
  const refresh = useRefreshWhatsApp();
  return useMutation({
    mutationFn: (form: Partial<WhatsAppForm>) => erpSend("/api/v1/whatsapp/account", "PUT", form),
    onSuccess: refresh,
  });
}

/** Ask Meta whether the saved details still work. */
export function useCheckWhatsAppAccount() {
  const refresh = useRefreshWhatsApp();
  return useMutation({
    mutationFn: () => erpSend<WhatsAppAccount>("/api/v1/whatsapp/account/check", "POST"),
    onSuccess: refresh,
  });
}

export function useDisconnectWhatsApp() {
  const refresh = useRefreshWhatsApp();
  return useMutation({
    mutationFn: () => erpSend("/api/v1/whatsapp/account", "DELETE"),
    onSuccess: refresh,
  });
}

/** The message templates, read from Meta. Not fetched on its own: call `refetch()` when the person asks to see them. */
export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: queryKeys.whatsappTemplates,
    queryFn: () => erpGet<WhatsAppTemplate[]>("/api/v1/whatsapp/templates"),
    enabled: false,
  });
}

/** The ordering bot's settings (stored on the restaurant). */
export type WhatsAppBotSettings = {
  whatsapp_bot_enabled: boolean;
  whatsapp_bot_timeout_minutes: number | null;
  whatsapp_welcome_message: string;
  whatsapp_order_update_template: string;
  whatsapp_order_update_template_language: string;
  timeout_range: [number, number];
};

const BOT = "/api/v1/whatsapp/bot";

export function useWhatsAppBot(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.whatsapp, "bot"] as const,
    queryFn: () => erpGet<WhatsAppBotSettings>(BOT),
    enabled,
  });
}

export function useSaveWhatsAppBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<WhatsAppBotSettings, "timeout_range">>) => erpSend<WhatsAppBotSettings>(BOT, "PUT", body),
    onSuccess: (d) => qc.setQueryData([...queryKeys.whatsapp, "bot"], d),
  });
}
