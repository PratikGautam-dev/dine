"use client";

import { ChannelStatusStrip } from "@/components/portal/channels/ChannelStatusStrip";
import { WhatsAppConversation } from "@/components/portal/channels/WhatsAppConversation";
import { WhatsAppBot } from "@/components/portal/channels/WhatsAppBot";
import { WhatsAppTemplates } from "@/components/portal/channels/WhatsAppTemplates";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { CHANNELS } from "@/lib/erp/erp";

/** WhatsApp: day-to-day use (the ordering bot and templates; the guest inbox is Messages). The connection is managed in Settings → Sales channels. */
export default function WhatsAppChannelPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="channel-whatsapp">
      <PageHeader icon={<WhatsAppIcon size={20} />} title={CHANNELS.whatsapp.label} description="Orders and customer chats over WhatsApp." />
      <ChannelStatusStrip channel="whatsapp" />
      <div className="flex flex-col gap-space-4">
        <WhatsAppBot />
        <WhatsAppConversation ready={ready} />
        <WhatsAppTemplates />
      </div>
    </PortalShell>
  );
}
