"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CustomerProfile } from "@/components/crm/CustomerProfile";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Card } from "@/components/erp-ui/Card";
import { useErpQuery, type Interaction } from "@/lib/erp/erp";
import { ChannelBadge } from "@/components/erp/StatusBadges";
import { formatDateTime, humanize } from "@/lib/erp/erp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const timeline = useErpQuery<{ interactions: Interaction[] }>(
    `/api/v1/customers/${id}`,
  );
  if (!ready) return null;
  const canEdit = hasPermission(session, "customers", "write");
  const interactions = timeline.data?.interactions ?? [];

  return (
    <PortalShell restaurant={tenant} active="customers">
      <Link
        href="/portal/customers"
        className="mb-space-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft size={14} /> All customers
      </Link>
      <div className="grid grid-cols-1 items-start gap-space-4 lg:grid-cols-3">
        <Card className="p-space-4 lg:col-span-2">
          <CustomerProfile
            customerId={id}
            currency={"INR"}
            canEdit={canEdit}
          />
        </Card>
        <Card className="h-fit p-space-4">
          <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
            Activity
          </h2>
          {interactions.length === 0 && (
            <p className="text-[13px] text-ink-400">Nothing yet.</p>
          )}
          <ol className="space-y-space-3 border-l border-line pl-space-4">
            {interactions.map((i) => (
              <li key={i.id} className="relative text-[13.5px]">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
                <p className="font-medium text-ink-900">
                  {i.summary ?? humanize(i.kind)}
                </p>
                <p className="flex items-center gap-space-2 text-[12px] text-ink-400">
                  <ChannelBadge channel={i.channel} />{" "}
                  {formatDateTime(i.occurred_at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </PortalShell>
  );
}
