"use client";

import Link from "next/link";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { useWhatsAppAccount, useWhatsAppTemplates } from "@/hooks/useWhatsApp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";

/** The business's WhatsApp message templates, read from Meta. The connection itself is managed in Settings → Sales channels. */
export function WhatsAppTemplates() {
  const session = useStaffSession();
  const allowed = hasPermission(session, "settings", "view");
  const account = useWhatsAppAccount(allowed);
  const list = useWhatsAppTemplates(); // read from Meta only when asked for
  const templates = list.data ?? null;
  const a = account.data;
  if (!allowed) return null;
  if (account.error)
    return (
      <Card className="p-space-4 text-[13.5px] text-error">
        Couldn&apos;t load WhatsApp: {account.error.message}
      </Card>
    );
  if (!a) return null;

  async function load() {
    const res = await list.refetch();
    if (res.error) toast.error("Couldn't load templates", res.error.message);
  }

  return (
    <Card className="p-space-4">
      <div className="mb-space-2 flex flex-wrap items-center justify-between gap-space-2">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Message templates</h2>
          <p className="text-[13px] text-ink-600">
            Anything you send outside the 24-hour customer window must be an approved template.
            Create them in Meta&apos;s WhatsApp Manager.
          </p>
        </div>
        {a.connected && (
          <Badge tone={a.approved_templates ? "success" : "warning"}>
            {a.approved_templates} approved
          </Badge>
        )}
      </div>
      {!a.connected ? (
        <p className="text-[13.5px] text-ink-600">
          Connect your number first, in{" "}
          <Link
            href="/portal/settings/channels/whatsapp"
            className="font-semibold text-brand-600 hover:underline"
          >
            Settings → Sales channels → WhatsApp
          </Link>
          .
        </p>
      ) : templates === null ? (
        <Button className="mobile-page-action" variant="secondary" onClick={load}>
          Show templates
        </Button>
      ) : templates.length === 0 ? (
        <p className="text-[13.5px] text-ink-400">No templates yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li
              key={`${t.name}-${t.language}`}
              className="flex items-center justify-between gap-space-3 py-space-2 text-[13.5px]"
            >
              <span>
                <span className="font-medium text-ink-900">{t.name}</span>{" "}
                <span className="text-[12px] text-ink-400">
                  {[t.category, t.language].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Badge
                tone={
                  t.status === "APPROVED"
                    ? "success"
                    : t.status === "REJECTED"
                      ? "warning"
                      : "neutral"
                }
              >
                {t.status.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
