"use client";

import { Monitor } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

/** Placeholder for the Daap App sales channel -- nothing is built behind it yet, so the page
 * says so plainly (same precedent as the POS channel page). */
export default function PortalDaapWebsiteChannelPage() {
  const { restaurant } = usePortalGuard();

  return (
    <PortalShell restaurant={restaurant} active="sales-daap-website">
      <PageHeader
        title="Daap App"
        icon={<Monitor size={22} />}
        description="Your restaurant's own Daap app."
      />
      <Card className="flex min-h-[320px] flex-col items-center justify-center gap-space-3 p-space-6 text-center">
        <Monitor size={32} className="text-ink-300" />
        <div>
          <p className="text-[15px] font-bold text-ink-900">Daap App is coming soon</p>
          <p className="mx-auto mt-space-1 max-w-[420px] text-[13px] text-ink-600">
            This channel isn&apos;t set up yet. Orders today come in through WhatsApp or your
            Website storefront.
          </p>
        </div>
      </Card>
    </PortalShell>
  );
}
