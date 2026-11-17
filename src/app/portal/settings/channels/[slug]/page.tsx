"use client";

import { Globe, Store } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import {
  ChannelReadiness,
  OnlineChannelPanel,
  PosChannelPanel,
  WhatsAppChannelPanel,
} from "@/components/portal/channels/ChannelPanels";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { CHANNELS, CHANNEL_ORDER, type Channel } from "@/lib/erp/erp";

const ICONS = { online: Globe, pos: Store, whatsapp: WhatsAppIcon } as const;
const PANELS = { online: OnlineChannelPanel, pos: PosChannelPanel, whatsapp: WhatsAppChannelPanel } as const;
const WORKING_PAGE: Record<Channel, string> = { online: "/portal/channels/online", pos: "/portal/channels/pos", whatsapp: "/portal/channels/whatsapp" };

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
      restaurant={restaurant}
      title={CHANNELS[channel].label}
      icon={<Icon size={20} />}
      description={CHANNELS[channel].blurb}
      actions={
        <Link href={WORKING_PAGE[channel]} className="text-[13px] font-semibold text-brand-700 hover:underline">
          Open the {CHANNELS[channel].label} page →
        </Link>
      }
    >
      <div className="max-w-3xl">
        <ChannelReadiness channel={channel} />
        <Panel />
      </div>
    </SettingsPageFrame>
  );
}
