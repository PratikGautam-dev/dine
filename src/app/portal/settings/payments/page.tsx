"use client";

import { CreditCard } from "lucide-react";
import { DaapPayments } from "@/components/portal/settings/DaapSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function PaymentsSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  if (!ready) return null;
  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-3xl"
      icon={<CreditCard size={20} />}
      title="Payments"
      description="How your customers pay you online, and where the money goes."
    >
      <DaapPayments />
    </SettingsPageFrame>
  );
}
