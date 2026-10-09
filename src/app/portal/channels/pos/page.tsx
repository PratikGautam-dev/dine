"use client";

import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

/** Point of Sale isn't built yet -- there's no in-person/staff-entered order flow anywhere in
 * this app today (only the WhatsApp bot and the web storefront create orders, both guest-
 * initiated). This page exists so the Sales Channels nav group matches what staff were shown
 * (Online/POS/WhatsApp) instead of silently dropping the third entry, same "visually present,
 * honestly non-functional" precedent the storefront port's Book-a-Table page already set. */
export default function PortalPosChannelPage() {
  const { hospital } = usePortalGuard();

  return (
    <PortalShell hospital={hospital} active="sales-pos">
      <PageHeader
        title="Point of Sale"
        icon={<CreditCard size={22} />}
        description="Take orders and payments in person, at the counter or table-side."
      />
      <Card className="flex min-h-[320px] flex-col items-center justify-center gap-space-3 p-space-6 text-center">
        <CreditCard size={32} className="text-ink-300" />
        <div>
          <p className="text-[15px] font-bold text-ink-900">POS billing is coming soon</p>
          <p className="mx-auto mt-space-1 max-w-[420px] text-[13px] text-ink-600">
            In-person order entry and payment collection isn&apos;t built yet — today, orders come
            in through WhatsApp or your online storefront. This page will let staff take walk-in
            orders directly once it&apos;s ready.
          </p>
        </div>
      </Card>
    </PortalShell>
  );
}
