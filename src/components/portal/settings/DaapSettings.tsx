"use client";

import { ExternalLink } from "lucide-react";
import { Card } from "@/components/erp-ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDaapStatus, type DaapStatus } from "@/hooks/useDaapStatus";

type Linked = Extract<DaapStatus, { linked: true }>;

const SERVICE_NAMES = {
  pos: "POS",
  website: "Online ordering",
  whatsapp: "WhatsApp ordering",
} as const;

const PAYMENT_STATUS: Record<
  Linked["payments"]["status"],
  { label: string; tone: "success" | "warning" | "neutral"; text: string }
> = {
  active: {
    label: "Active",
    tone: "success",
    text: "Guests can pay online on your website and through WhatsApp payment links.",
  },
  pending: {
    label: "Being set up",
    tone: "warning",
    text: "Razorpay is still checking your account. Online payments work in test mode until it's done.",
  },
  restricted: {
    label: "Restricted",
    tone: "warning",
    text: "Razorpay has limited your account. Open DAAP Account to see what it needs.",
  },
  disconnected: {
    label: "Disconnected",
    tone: "neutral",
    text: "Your Razorpay account was disconnected. Guests can only pay at the restaurant until you connect it again.",
  },
  not_connected: {
    label: "Not connected",
    tone: "neutral",
    text: "Connect your Razorpay account in DAAP Account to take online payments. Until then guests pay at the restaurant.",
  },
};

function NotLinked({ what }: { what: string }) {
  return (
    <Card className="p-space-5 text-[13.5px] text-ink-600">
      {what} comes from DAAP. This restaurant isn&apos;t connected to a DAAP account.
    </Card>
  );
}

/** Settings > Payments: where the money goes (the business's own Razorpay account, connected in DAAP Account; never a key here). */
export function DaapPayments() {
  const { data, isLoading } = useDaapStatus();
  if (isLoading || !data) return null;
  if (!data.linked) return <NotLinked what="Online payment" />;
  const p = data.payments;
  const info = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.not_connected;
  return (
    <Card className="p-space-5">
      <div className="flex flex-wrap items-center gap-space-3">
        <h2 className="text-[15px] font-bold text-ink-900">Online payments</h2>
        <Badge tone={info.tone}>{info.label}</Badge>
        {p.mode === "test" && <Badge tone="warning">Test mode</Badge>}
      </div>
      <p className="mt-space-2 text-[13.5px] text-ink-600">{info.text}</p>
      <p className="mt-space-2 text-[12.5px] text-ink-400">
        Payments go straight to your own Razorpay account, for every branch. DAAP never holds your
        money.
      </p>
      {p.manage_url && (
        <Button
          href={p.manage_url}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="mt-space-4"
        >
          Manage in DAAP Account <ExternalLink size={15} />
        </Button>
      )}
    </Card>
  );
}

/** Settings > Plan and billing: what the DAAP plan includes now; plans, invoices and payment are in DAAP Account. */
export function DaapPlan() {
  const { data, isLoading } = useDaapStatus();
  if (isLoading || !data) return null;
  if (!data.linked) return <NotLinked what="Your plan" />;
  return (
    <Card className="p-space-5">
      <h2 className="text-[15px] font-bold text-ink-900">Your DAAP plan</h2>
      <ul className="mt-space-3 divide-y divide-line">
        {data.services.map((s) => (
          <li key={s.service} className="flex flex-wrap items-center gap-space-3 py-space-3">
            <span className="min-w-[150px] text-[14px] font-semibold text-ink-900">
              {SERVICE_NAMES[s.service]}
            </span>
            <span className="text-[13px] text-ink-600">{s.plan_name ?? "Not in your plan"}</span>
            <span className="ml-auto">
              {s.on ? (
                <Badge tone={s.status === "past_due" ? "warning" : "success"}>
                  {s.status === "trialing"
                    ? "Trial"
                    : s.status === "past_due"
                      ? "Payment due"
                      : "On"}
                </Badge>
              ) : (
                <Badge tone="neutral">Off</Badge>
              )}
            </span>
            {s.status === "trialing" && s.trial_ends_at && (
              <span className="w-full text-[12px] text-ink-400">
                Trial ends {new Date(s.trial_ends_at).toLocaleDateString()}
              </span>
            )}
          </li>
        ))}
      </ul>
      {data.billing_url && (
        <Button
          href={data.billing_url}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="mt-space-4"
        >
          Plans, invoices and payment in DAAP Account <ExternalLink size={15} />
        </Button>
      )}
    </Card>
  );
}
