"use client";

import { Plug } from "lucide-react";
import Link from "next/link";
import { useReadiness } from "@/components/portal/channels/ChannelPanels";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { CHANNELS, type Channel } from "@/lib/erp/erp";

const SETUP: Record<Channel, { href: string; doc: string }> = {
  online: {
    href: "/portal/settings/channels/online",
    doc: "/portal/help/online-store",
  },
  pos: { href: "/portal/settings/channels/pos", doc: "/portal/help/pos" },
  whatsapp: {
    href: "/portal/settings/channels/whatsapp",
    doc: "/portal/help/whatsapp",
  },
};

/** Shown at the point of use when a channel can't work yet: says what is missing and links straight to it. Renders nothing once the
 * channel is ready, while loading, and for people without the channels permission (the readiness request is skipped for them). */
export function SetupRequired({ channel, what }: { channel: Channel; what: string }) {
  const { data } = useReadiness(channel);
  if (!data || data.ready) return null;
  const label = CHANNELS[channel].label;
  const missing = data.items.filter((i) => i.required && !i.done && i.available).slice(0, 3);
  return (
    <Card className="mb-space-4 flex flex-wrap items-start gap-space-3 border-brand-200 bg-brand-50 p-space-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-brand-600">
        <Plug size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink-900">
          Set up {label} to {what}
        </p>
        {data.in_plan ? (
          <ul className="mt-1 list-disc pl-space-4 text-[13px] text-ink-600">
            {missing.map((i) => (
              <li key={i.key}>{i.hint}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-ink-600">
            {data.ended
              ? "Your plan for this channel has ended."
              : "You haven't bought this channel yet."}
          </p>
        )}
      </div>
      <div className="mobile-page-actions flex items-center gap-space-3">
        <Link
          href={SETUP[channel].doc}
          className="text-[13px] font-semibold text-ink-600 hover:underline"
        >
          How to
        </Link>
        <Button href={data.in_plan ? SETUP[channel].href : `/portal/settings/billing#${channel}`}>
          {data.in_plan ? "Set up" : data.ended ? "Renew" : "Buy a plan"}
        </Button>
      </div>
    </Card>
  );
}
