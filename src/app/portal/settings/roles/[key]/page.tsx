"use client";

import { useParams } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { RoleEditor } from "@/components/portal/RoleEditor";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function EditRolePage() {
  const { restaurant, ready } = usePortalGuard();
  const { key } = useParams<{ key: string }>();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="roles">
      <RoleEditor key={key} roleKey={key} />
    </PortalShell>
  );
}
