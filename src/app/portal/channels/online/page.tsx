"use client";

import { Globe } from "lucide-react";
import { ChannelStatusStrip } from "@/components/portal/channels/ChannelStatusStrip";
import { StorefrontSettings } from "@/components/portal/channels/StorefrontSettings";
import { OnlineStoreThemes } from "@/components/portal/channels/OnlineStoreThemes";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { PageHeader } from "@/components/ui/PageHeader";

/** Website: how the website looks and reads. Orders from it are in Food Orders (channel filter: Website). */
export default function OnlineChannelPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="channel-online">
      <PageHeader
        icon={<Globe size={20} />}
        title="Website"
        description="Customize your restaurant's website and publish it."
      />
      <ChannelStatusStrip channel="online" />
      <OnlineStoreThemes />
      <h2
        id="online-storefront"
        className="mb-space-3 mt-space-6 scroll-mt-24 text-[17px] font-semibold text-ink-900"
      >
        Online storefront
      </h2>
      <p className="mb-space-3 text-[13.5px] text-ink-600">
        Turn website ordering on or off and choose your store link.
      </p>
      <StorefrontSettings />
    </PortalShell>
  );
}
