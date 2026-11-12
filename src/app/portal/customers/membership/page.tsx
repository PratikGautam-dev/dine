"use client";

import { MembershipTab } from "@/components/crm/membership/MembershipTab";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { hasPermission, hasTenantWide, useStaffSession } from "@/lib/erp/staffAuth";

/** Customers > Membership: plans, benefits, members, rules and loyalty points. */
export default function MembershipPage() {
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  if (!ready) return null;
  return (
    <PortalShell restaurant={tenant} active="customers-membership">
      <MembershipTab
        currency={"INR"}
        canEdit={hasPermission(session, "membership", "write")}
        canConfigure={hasTenantWide(session, "membership:manage")}
        onChanged={() => {}}
      />
    </PortalShell>
  );
}
