"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Switch } from "@/components/erp-ui/Switch";
import { useSaveWhatsAppBot, useWhatsAppAccount, useWhatsAppBot, type WhatsAppBotSettings } from "@/hooks/useWhatsApp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";

/** The WhatsApp ordering bot: customers browse the menu, order and pay in the chat. On by default; switched off, messages are still recorded but
 * the bot doesn't reply. It needs a connected number. */
export function WhatsAppBot() {
  const session = useStaffSession();
  const canView = hasPermission(session, "settings", "view");
  const canEdit = hasPermission(session, "settings", "write");
  const bot = useWhatsAppBot(canView);
  const account = useWhatsAppAccount(canView);
  if (!canView) return null;
  if (bot.error)
    return (
      <Card className="p-space-4 text-[13.5px] text-error">
        Couldn&apos;t load the ordering bot settings: {bot.error.message}. If this says &quot;Not found (404)&quot;, the backend is running an older build without the
        Sales channels API — restart it from <code>erp-dine-backend</code>.
      </Card>
    );
  if (!bot.data) return <Card className="p-space-4 text-[13.5px] text-ink-400">Loading…</Card>;
  return (
    <BotCard
      key={JSON.stringify(bot.data)}
      settings={bot.data}
      connected={account.data?.connected ?? false}
      canEdit={canEdit}
    />
  );
}

function BotCard({ settings, connected, canEdit }: { settings: WhatsAppBotSettings; connected: boolean; canEdit: boolean }) {
  const enabled = settings.whatsapp_bot_enabled;
  const [min, max] = settings.timeout_range;
  const [timeout, setTimeoutValue] = useState(settings.whatsapp_bot_timeout_minutes ? String(settings.whatsapp_bot_timeout_minutes) : "");
  const [welcome, setWelcome] = useState(settings.whatsapp_welcome_message);
  const [template, setTemplate] = useState(settings.whatsapp_order_update_template);
  const [language, setLanguage] = useState(settings.whatsapp_order_update_template_language);
  const save = useSaveWhatsAppBot();
  const busy = save.isPending;

  const run = (body: Parameters<typeof save.mutate>[0], ok: string, detail?: string) =>
    save.mutate(body, {
      onSuccess: () => toast.success(ok, detail),
      onError: (e) => toast.error("Couldn't save", e.message),
    });

  const saveWelcome = () => run({ whatsapp_welcome_message: welcome.trim() }, "Welcome message saved");
  const saveTemplate = () =>
    run({ whatsapp_order_update_template: template.trim(), whatsapp_order_update_template_language: language.trim() || "en" }, "Settings saved");
  const toggle = () =>
    run(
      { whatsapp_bot_enabled: !enabled },
      enabled ? "Ordering bot switched off" : "Ordering bot switched on",
      enabled ? "Customer messages are still recorded, but the bot won't reply." : "Customers who message your number can now order in the chat.",
    );
  function saveTimeout() {
    const minutes = parseInt(timeout, 10);
    if (!minutes || minutes < min || minutes > max)
      return toast.error("Check the value", `Enter a whole number of minutes between ${min} and ${max}.`);
    run({ whatsapp_bot_timeout_minutes: minutes }, "Settings saved");
  }

  return (
    <Card className="min-w-0 p-space-3 sm:p-space-4">
      <div className="mb-space-3 flex flex-wrap items-start justify-between gap-space-3">
        <div className="min-w-0 max-w-[60ch]">
          <h2 className="text-[15px] font-bold text-ink-900">Ordering bot</h2>
          <p className="text-[13px] text-ink-600">
            Customers who message your WhatsApp number can browse your menu, build
            an order and book a table without leaving the chat. Switch it off and
            messages are still recorded, but nobody replies automatically.
          </p>
        </div>
        <div className="flex items-center gap-space-2">
          <Badge tone={enabled ? "success" : "neutral"}>
            {enabled ? "On" : "Off"}
          </Badge>
          <Switch
            checked={enabled}
            onChange={toggle}
            disabled={!canEdit || busy || (!connected && !enabled)}
            tone="success"
            aria-label="WhatsApp ordering bot"
          />
        </div>
      </div>

      {!connected && (
        <p className="mb-space-3 text-[13.5px] text-ink-600">
          Connect your number first, in{" "}
          <Link
            href="/portal/settings/channels/whatsapp"
            className="font-semibold text-brand-600 hover:underline"
          >
            Settings → Sales channels → WhatsApp
          </Link>
          .
        </p>
      )}

      <Field
        label="Welcome message"
        htmlFor="wa_bot_welcome"
        hint="Shown when a customer starts a chat, after “Hi <name>! 👋”. Leave it empty to use the standard greeting. Up to 1000 characters."
      >
        <div className="flex flex-col gap-space-2">
          <Textarea
            id="wa_bot_welcome"
            rows={3}
            maxLength={1000}
            disabled={!canEdit}
            placeholder="e.g. Welcome to Spice Garden! Today's special is the butter chicken."
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
          />
          {canEdit && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={saveWelcome}
              className="self-start"
            >
              Save
            </Button>
          )}
        </div>
      </Field>

      <Field
        label="Start over after (minutes)"
        htmlFor="wa_bot_timeout"
        hint={`A customer who goes quiet this long goes back to the main menu on their next message. ${min}–${max}.`}
      >
        <div className="flex flex-col gap-space-2 sm:flex-row">
          <Input
            id="wa_bot_timeout"
            inputMode="numeric"
            disabled={!canEdit}
            value={timeout}
            onChange={(e) => setTimeoutValue(e.target.value)}
            className="sm:max-w-[140px]"
          />
          {canEdit && (
            <Button variant="secondary" disabled={busy} onClick={saveTimeout}>
              Save
            </Button>
          )}
        </div>
      </Field>

      <div className="border-t border-line pt-space-3">
        <h3 className="text-[14px] font-semibold text-ink-900">
          Order updates
        </h3>
        <p className="mb-space-3 text-[13px] text-ink-600">
          Customers get a message when their order is accepted, being prepared,
          ready or out for delivery, and complete. If they haven&apos;t messaged you
          in the last 24 hours, WhatsApp only allows an approved template.
          Create one in WhatsApp Manager whose text uses{" "}
          <code className="text-[12px]">{"{{1}}"}</code> for the order number
          and <code className="text-[12px]">{"{{2}}"}</code> for the status, for
          example: &ldquo;Your order {"{{1}}"} is {"{{2}}"}.&rdquo; Without
          a template, updates outside that window are skipped.
        </p>
        <div className="flex flex-wrap items-end gap-space-2">
          <Field
            label="Template name"
            htmlFor="wa_tpl_name"
            className="mb-0 w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:flex-1"
          >
            <Input
              id="wa_tpl_name"
              placeholder="order_update"
              disabled={!canEdit}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </Field>
          <Field
            label="Language"
            htmlFor="wa_tpl_lang"
            className="mb-0 w-full min-w-0 sm:w-[110px]"
          >
            <Input
              id="wa_tpl_lang"
              placeholder="en"
              disabled={!canEdit}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </Field>
          {canEdit && (
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              disabled={busy}
              onClick={saveTemplate}
            >
              Save
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
