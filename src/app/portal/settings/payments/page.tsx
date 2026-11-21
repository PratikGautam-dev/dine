"use client";

import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/portal/settings/ComingSoon";
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
      description="How your customers pay you, and where the money goes."
    >
      <ComingSoon icon={<CreditCard size={22} />} title="Payments">
        You&apos;ll be able to connect a payment provider, choose the payment methods you accept, and see your payouts here.
      </ComingSoon>
    </SettingsPageFrame>
  );
}
