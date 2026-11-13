"use client";

import { PortalShell } from "@/components/portal/PortalShell";
import { RoleEditor } from "@/components/portal/RoleEditor";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function NewRolePage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="roles">
      <RoleEditor />
    </PortalShell>
  );
}
