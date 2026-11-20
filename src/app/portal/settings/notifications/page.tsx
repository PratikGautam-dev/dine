"use client";

import { Bell, ChevronRight, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Switch } from "@/components/erp-ui/Switch";
import { useEmailTemplates, useSwitchEmailTemplate } from "@/hooks/useEmailTemplates";
import { useRemoveShopEmail, useShopEmail, useStartShopEmail, useTestShopEmail, useVerifyShopEmail } from "@/hooks/useShopEmail";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** Settings > Notifications: the one email address the business uses with its customers, like Shopify's "Sender email". */
export default function NotificationsSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const canEdit = usePermission("settings", "write");
  const info = useShopEmail({ enabled: ready });
  const start = useStartShopEmail();
  const verify = useVerifyShopEmail();
  const remove = useRemoveShopEmail();
  const test = useTestShopEmail();
  const templates = useEmailTemplates({ enabled: ready });
  const switcher = useSwitchEmailTemplate();
  const [draft, setDraft] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [removing, setRemoving] = useState(false);
  if (!ready) return null;
  const data = info.data;
  const email = draft ?? data?.email ?? "";
  const changed = !!data && email.trim().toLowerCase() !== (data.email ?? "");
  // A code is waiting only for the address it was sent to
  const waiting = challenge !== null && !changed && !data?.verified;

  const sendCode = () =>
    start.mutate(email.trim(), {
      onSuccess: (r) => {
        setChallenge(r.challenge);
        setCode("");
        setDraft(null);
        toast.success(`We emailed a code to ${email.trim()}`);
      },
      onError: (e) => toast.error("Couldn't send the code", e.message),
    });

  const confirm = () =>
    verify.mutate(
      { code: code.trim(), challenge: challenge ?? "" },
      {
        onSuccess: () => {
          setChallenge(null);
          setCode("");
          toast.success("Email confirmed");
        },
        onError: (e) => toast.error("Couldn't confirm", e.message),
      },
    );

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-[880px]"
      icon={<Bell size={20} />}
      title="Notifications"
      description="How your restaurant's emails reach your guests."
    >
      <div className="space-y-space-3">
        <Card className="p-space-5">
          <div className="mb-space-1 flex items-center justify-between gap-space-3">
            <h2 className="text-[15px] font-semibold text-ink-900">
              Sender email
            </h2>
            {data?.email && (
              <Badge tone={data.verified ? "success" : "warning"}>
                {data.verified ? "Confirmed" : "Unconfirmed"}
              </Badge>
            )}
          </div>
          <p className="mb-space-4 text-[13px] text-ink-600">
            The email address customers can reply to. Order emails arrive as <b>{data?.shop_name || "your restaurant"}</b>
            {data?.sending_from ? ` <${data.sending_from}>` : ""}, and when a
            customer replies it comes to this address.
          </p>
          {info.isPending ? (
            <SkeletonLines rows={2} />
          ) : info.error ? (
            <p className="text-[14px] text-error">{info.error.message}</p>
          ) : (
            <>
              {!data?.configured && (
                <p className="mb-space-3 rounded-md bg-warning-tint p-space-3 text-[13px] text-warning">
                  Email isn&apos;t switched on for this platform yet, so codes
                  and guest emails can&apos;t be sent.
                </p>
              )}
              <Field label="Email address" htmlFor="sender-email">
                <Input
                  id="sender-email"
                  type="email"
                  value={email}
                  disabled={!canEdit}
                  placeholder="orders@yourrestaurant.com"
                  onChange={(e) => setDraft(e.target.value)}
                />
              </Field>
              {canEdit && (changed || (data?.email && !data.verified)) && (
                <div className="flex flex-wrap items-center gap-space-2">
                  <Button
                    onClick={sendCode}
                    disabled={
                      start.isPending || !email.trim() || !data?.configured
                    }
                  >
                    <Mail size={15} />
                    {data?.email && !changed ? "Send a new code" : "Send code"}
                  </Button>
                </div>
              )}
              {waiting && canEdit && (
                <div className="mt-space-4 border-t border-line pt-space-4">
                  <Field
                    label="Confirmation code"
                    htmlFor="sender-code"
                    hint={`Enter the 6-digit code we sent to ${data?.email}. It works for 10 minutes.`}
                  >
                    <Input
                      id="sender-code"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </Field>
                  <Button
                    onClick={confirm}
                    disabled={verify.isPending || code.length !== 6}
                  >
                    Confirm
                  </Button>
                </div>
              )}
              {data?.email && !data.verified && !waiting && !changed && (
                <p className="mt-space-3 text-[13px] text-ink-600">
                  Confirm that you own this address. Until then guests
                  can&apos;t reply to your restaurant by email.
                </p>
              )}
              {data?.verified && canEdit && !changed && (
                <div className="flex flex-wrap gap-space-2">
                  <Button
                    variant="secondary"
                    disabled={test.isPending}
                    onClick={() =>
                      test.mutate(undefined, {
                        onSuccess: (r) =>
                          r.sent
                            ? toast.success(`Test email sent to ${data.email}`)
                            : toast.error("The test email wasn't sent"),
                        onError: (e) =>
                          toast.error("Couldn't send the test", e.message),
                      })
                    }
                  >
                    Send test email
                  </Button>
                  <Button variant="secondary" onClick={() => setRemoving(true)}>
                    Remove
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
        <div>
          <h2 className="mt-space-4 mb-space-1 text-[18px] font-semibold text-ink-900">
            Customer notifications
          </h2>
          <p className="mb-space-3 text-[13px] text-ink-600">
            The emails your guests get about their orders. Open
            one to see how it looks, and switch off the ones you don&apos;t want
            to send.
          </p>
          {templates.data?.groups.map((group) => (
            <Card key={group} className="mb-space-3 overflow-hidden p-0">
              <p className="border-b border-line px-space-4 py-2 text-[13px] font-semibold text-ink-900">
                {group}
              </p>
              {templates.data.templates
                .filter((t) => t.group === group)
                .map((t) => (
                  <div
                    key={t.key}
                    className="flex items-center gap-space-3 border-b border-line px-space-4 py-3 last:border-b-0 hover:bg-black/[0.02]"
                  >
                    <Link
                      href={`/portal/settings/notifications/${t.key}`}
                      className="flex-1"
                    >
                      <span className="block text-[14px] font-medium text-ink-900">
                        {t.label}
                        {!t.enabled && (
                          <span className="ml-space-2 text-[12px] font-normal text-ink-400">
                            Off
                          </span>
                        )}
                      </span>
                      <span className="block text-[12.5px] text-ink-600">
                        {t.description}
                      </span>
                    </Link>
                    <Switch
                      checked={t.enabled}
                      disabled={!canEdit || switcher.isPending}
                      aria-label={`${t.label} email`}
                      onChange={() =>
                        switcher.mutate(
                          { key: t.key, enabled: !t.enabled },
                          {
                            onSuccess: () =>
                              toast.success(
                                `${t.label} ${t.enabled ? "switched off" : "switched on"}`,
                              ),
                            onError: (e) =>
                              toast.error("Couldn't change it", e.message),
                          },
                        )
                      }
                    />
                    <Link href={`/portal/settings/notifications/${t.key}`}>
                      <ChevronRight size={16} className="text-ink-400" />
                    </Link>
                  </div>
                ))}
            </Card>
          ))}
        </div>
        <Card className="p-space-5 text-[13px] text-ink-600">
          <p className="mb-space-2 font-semibold text-ink-900">
            Why replies work this way
          </p>
          Emails are sent from our verified address with your restaurant&apos;s name,
          so they reach inboxes reliably, including when your address is a Gmail
          or Yahoo one. Your confirmed address is set as the reply-to.
        </Card>
      </div>
      <ConfirmDialog
        open={removing}
        title="Remove sender email?"
        message="Guest emails will still be sent with your restaurant's name, but replies won't reach you."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onCancel={() => setRemoving(false)}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              setRemoving(false);
              setChallenge(null);
              setDraft(null);
              toast.success("Sender email removed");
            },
            onError: (e) => toast.error("Couldn't remove it", e.message),
          });
        }}
      />
    </SettingsPageFrame>
  );
}
