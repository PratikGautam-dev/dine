"use client";

import { Globe, Plug, Store } from "lucide-react";
import Link from "next/link";
import { readinessStatus, useReadiness } from "@/components/portal/channels/ChannelPanels";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { Badge } from "@/components/erp-ui/Badge";
import { Card } from "@/components/erp-ui/Card";
import { CHANNELS, CHANNEL_ORDER, type Channel } from "@/lib/erp/erp";

const ICONS = { online: Globe, pos: Store, whatsapp: WhatsAppIcon } as const;

function ChannelCard({ channel }: { channel: Channel }) {
  const { data } = useReadiness(channel);
  const st = readinessStatus(data);
  const Icon = ICONS[channel];
  return (
    <Link href={`/portal/settings/channels/${channel}`}>
      <Card className="flex h-full items-start gap-space-3 p-space-4 transition-colors hover:border-brand-300">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-space-2">
            <span className="text-[15px] font-bold text-ink-900">{CHANNELS[channel].label}</span>
            {data && <Badge tone={data.ready ? "success" : st.tone}>{data.ready ? "Ready" : st.label}</Badge>}
          </span>
          <span className="mt-1 block text-[13px] text-ink-600">{CHANNELS[channel].blurb}</span>
        </span>
      </Card>
    </Link>
  );
}

/** Settings → Sales channels: where each channel (Website, POS, WhatsApp) is set up. */
export default function SalesChannelsSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <SettingsPageFrame restaurant={restaurant} title="Sales channels" icon={<Plug size={20} />} description="Connect and set up the channels you sell through.">
      <div className="grid max-w-4xl gap-space-3 md:grid-cols-3">
        {CHANNEL_ORDER.map((c) => (
          <ChannelCard key={c} channel={c} />
        ))}
      </div>
    </SettingsPageFrame>
  );
}
