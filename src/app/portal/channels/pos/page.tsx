"use client";

import { Store } from "lucide-react";
import { ChannelStatusStrip } from "@/components/portal/channels/ChannelStatusStrip";
import { PosScreenEditor } from "@/components/portal/channels/PosScreenEditor";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { PageHeader } from "@/components/ui/PageHeader";

/** POS: how the till screen looks and what it says. The same screen as the ERP's, but a preview only: POS is not connected to a till or a backend yet. */
export default function PosChannelPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="channel-pos">
      <PageHeader icon={<Store size={20} />} title="POS" description="Choose how the till screen looks and what it says." />
      <ChannelStatusStrip channel="pos" />
      <PosScreenEditor />
    </PortalShell>
  );
}
