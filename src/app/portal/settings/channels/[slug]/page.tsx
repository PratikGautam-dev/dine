"use client";

import { Globe, Store } from "lucide-react";
import { Button } from "@/components/erp-ui/Button";
import { notFound } from "next/navigation";
import { use } from "react";
import {
  ChannelBranches,
  OnlineChannelPanel,
  PosChannelPanel,
  WhatsAppChannelPanel,
} from "@/components/portal/channels/ChannelPanels";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { CHANNELS, CHANNEL_ORDER, type Channel } from "@/lib/erp/erp";

const ICONS = { online: Globe, pos: Store, whatsapp: WhatsAppIcon } as const;
const PANELS = {
  online: OnlineChannelPanel,
  pos: PosChannelPanel,
  whatsapp: WhatsAppChannelPanel,
} as const;
const WORKING_PAGE: Record<Channel, string> = {
  online: "/portal/channels/online",
  pos: "/portal/channels/pos",
  whatsapp: "/portal/channels/whatsapp",
};

export default function ChannelSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const channel = CHANNEL_ORDER.find((c) => CHANNELS[c].slug === slug);
  const { restaurant, ready } = usePortalGuard();
  if (!channel) notFound();
  if (!ready) return null;
  const Icon = ICONS[channel];
  const Panel = PANELS[channel];
  return (
    <SettingsPageFrame
      maxWidthClass="max-w-[880px]"
      restaurant={restaurant}
      title={CHANNELS[channel].label}
      icon={<Icon size={20} />}
      description={CHANNELS[channel].blurb}
      actions={
        <Button variant="secondary" href={WORKING_PAGE[channel]}>
          Open {CHANNELS[channel].label}
        </Button>
      }
    >
      <Panel />
      <ChannelBranches channel={channel} />
    </SettingsPageFrame>
  );
}
