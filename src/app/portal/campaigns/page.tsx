"use client";

import { CampaignsTab } from "@/components/crm/CampaignsTab";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";

/** Campaigns: marketing campaigns (with an existing or new discount), sent by hand or launched automatically by a trigger. */
export default function CampaignsPage() {
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  if (!ready) return null;
  const canEdit = hasPermission(session, "campaigns", "write");
  return (
    <PortalShell restaurant={tenant} active="campaigns">
      <CampaignsTab canEdit={canEdit} onChanged={() => {}} />
    </PortalShell>
  );
}
