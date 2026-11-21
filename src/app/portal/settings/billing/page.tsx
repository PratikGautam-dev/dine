"use client";

import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/portal/settings/ComingSoon";
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
      description="Your plan, invoices and payment method for Dine Connect."
    >
      <ComingSoon icon={<Wallet size={22} />} title="Plan and billing">
        You&apos;ll be able to see your plan, change it, and download invoices here.
      </ComingSoon>
    </SettingsPageFrame>
  );
}
