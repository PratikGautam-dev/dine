"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Card } from "@/components/erp-ui/Card";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Switch } from "@/components/erp-ui/Switch";
import { useEmailTemplate, useSwitchEmailTemplate } from "@/hooks/useEmailTemplates";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** Settings > Notifications > one customer email: how it looks and where it comes from. Read-only (the wording is managed by the platform). */
export default function EmailTemplatePage() {
  const { key } = useParams<{ key: string }>();
  const { restaurant, ready } = usePortalGuard();
  const q = useEmailTemplate(key, ready);
  const canEdit = usePermission("settings", "write");
  const switcher = useSwitchEmailTemplate();
  if (!ready) return null;
  const d = q.data;

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-[880px]"
      icon={<Mail size={20} />}
      title={d?.label ?? "Customer notification"}
      description={d?.description ?? ""}
      actions={
          <Link
            href="/portal/settings/notifications"
            className="flex items-center gap-space-1 text-[13px] font-semibold text-brand-700"
          >
            <ArrowLeft size={14} /> Notifications
          </Link>
      }
    >
      <div className="space-y-space-3">
        {q.isPending ? (
          <Card className="p-space-5">
            <SkeletonLines rows={4} />
          </Card>
        ) : q.error ? (
          <Card className="p-space-5 text-[14px] text-error">
            {q.error.message}
          </Card>
        ) : d ? (
          <>
            <Card className="flex items-center justify-between gap-space-3 p-space-4">
              <span>
                <span className="block text-[14px] font-semibold text-ink-900">
                  {d.enabled ? "On" : "Off"}
                </span>
                <span className="block text-[12.5px] text-ink-600">
                  {d.enabled
                    ? "Guests get this email."
                    : "Guests don't get this email. You can still preview it."}
                </span>
              </span>
              <Switch
                checked={d.enabled}
                disabled={!canEdit || switcher.isPending}
                aria-label={`${d.label} email`}
                onChange={() =>
                  switcher.mutate(
                    { key, enabled: !d.enabled },
                    {
                      onSuccess: () => q.refetch(),
                      onError: (e) =>
                        toast.error("Couldn't change it", e.message),
                    },
                  )
                }
              />
            </Card>
            <Card className="p-space-5">
              <h2 className="mb-space-3 text-[15px] font-semibold text-ink-900">
                Preview
              </h2>
              <dl className="mb-space-4 grid gap-space-2 text-[13px] sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Subject</dt>
                  <dd className="font-semibold text-ink-900">{d.subject}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">From</dt>
                  <dd className="text-ink-900">
                    {d.from_name ?? "Your restaurant"}
                    {d.from_address
                      ? ` <${d.from_address}>`
                      : " (our verified address)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Replies go to</dt>
                  <dd className="text-ink-900">
                    {d.from_address
                      ? d.from_address
                      : (d.reply_to ??
                        "Nobody yet: confirm a sender email first")}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Attachment</dt>
                  <dd className="text-ink-900">
                    {d.attachment ?? "None"}{" "}
                    {d.attachment && (
                      <span className="text-ink-400">({d.note})</span>
                    )}
                  </dd>
                </div>
              </dl>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={d.html}
                className="h-[620px] w-full rounded-md border border-line bg-white"
              />
              <p className="mt-space-2 text-[12.5px] text-ink-400">
                {d.sample_is_real
                  ? "The items shown are examples taken from your menu."
                  : "The items shown are placeholders. Add dishes to see yours."}{" "}
                Real emails use the guest&apos;s own order.
              </p>
            </Card>
          </>
        ) : null}
      </div>
    </SettingsPageFrame>
  );
}
