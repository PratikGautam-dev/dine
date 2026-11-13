"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoyaltyTab } from "@/components/crm/LoyaltyTab";
import { BenefitsView } from "@/components/crm/membership/BenefitsView";
import { MembersView } from "@/components/crm/membership/MembersView";
import { MembershipsView } from "@/components/crm/membership/MembershipsView";
import { RulesView } from "@/components/crm/membership/RulesView";
import { Tabs } from "@/components/erp-ui/Tabs";

type View = "memberships" | "benefits" | "members" | "rules" | "points";
const VIEWS: { key: View; label: string }[] = [
  { key: "memberships", label: "All Memberships" },
  { key: "benefits", label: "Benefits" },
  { key: "members", label: "Members" },
  { key: "rules", label: "Rules" },
  { key: "points", label: "Loyalty points" },
];

/** Customers > Membership: the plans, their benefits, the members, the rules and the loyalty points that drive the tiers. */
export function MembershipTab({
  currency,
  canEdit,
  canConfigure,
  onChanged,
}: {
  currency: string;
  canEdit: boolean;
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("memberships");
  const [tier, setTier] = useState("");
  return (
    <div>
      <Tabs tabs={VIEWS} value={view} onChange={setView} />
      {view === "memberships" && (
        <MembershipsView
          currency={currency}
          canConfigure={canConfigure}
          onChanged={onChanged}
          onOpenSegment={(t) => {
            setTier(t);
            setView("members");
          }}
        />
      )}
      {view === "benefits" && (
        <BenefitsView canConfigure={canConfigure} onChanged={onChanged} />
      )}
      {view === "members" && (
        <MembersView
          currency={currency}
          canEdit={canEdit}
          tierFilter={tier}
          onTierFilter={setTier}
          onChanged={onChanged}
        />
      )}
      {view === "points" && (
        <LoyaltyTab
          canConfigure={canConfigure}
          onOpenCustomer={(id) => router.push(`/portal/customers/${id}`)}
          onChanged={onChanged}
        />
      )}
      {view === "rules" && (
        <RulesView
          currency={currency}
          canConfigure={canConfigure}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
