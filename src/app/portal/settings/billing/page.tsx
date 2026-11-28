"use client";

import { Wallet } from "lucide-react";
import { DaapPlan } from "@/components/portal/settings/DaapSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function BillingSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-3xl"
      icon={<Wallet size={20} />}
      title="Plan and billing"
      description="Your DAAP plan for Dine Connect."
    >
      <DaapPlan />
    </SettingsPageFrame>
  );
}
