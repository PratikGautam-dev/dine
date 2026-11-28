"use client";

import { ChevronRight, Globe, Plug, Store } from "lucide-react";
import Link from "next/link";
import { readinessStatus, useReadiness } from "@/components/portal/channels/ChannelPanels";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { Badge } from "@/components/erp-ui/Badge";
import { Card } from "@/components/erp-ui/Card";
import { CHANNELS, CHANNEL_ORDER, type Channel } from "@/lib/erp/erp";

const ICONS = { online: Globe, pos: Store, whatsapp: WhatsAppIcon } as const;

function ChannelRow({ channel }: { channel: Channel }) {
  const { data } = useReadiness(channel);
  const st = readinessStatus(data);
  const Icon = ICONS[channel];
  return (
    <Link
      href={`/portal/settings/channels/${channel}`}
      className="flex items-center gap-space-3 p-space-4 hover:bg-paper"
    >
      <Icon size={22} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink-900">
          {CHANNELS[channel].label}
        </span>
        <span className="block text-[12.5px] text-ink-600">{CHANNELS[channel].blurb}</span>
      </span>
      {data && (
        <Badge tone={data.ready ? "success" : st.tone}>{data.ready ? "Ready" : st.label}</Badge>
      )}
      <ChevronRight size={16} className="text-ink-400" />
    </Link>
  );
}

/** Settings → Sales channels: where each channel (Website, POS, WhatsApp) is set up. */
export default function SalesChannelsSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <SettingsPageFrame
      maxWidthClass="max-w-[880px]"
      restaurant={restaurant}
      title="Sales channels"
      icon={<Plug size={20} />}
      description="Where your orders come from. Pick a channel to set up how it connects."
    >
      <Card className="divide-y divide-line">
        {CHANNEL_ORDER.map((c) => (
          <ChannelRow key={c} channel={c} />
        ))}
      </Card>
    </SettingsPageFrame>
  );
}
