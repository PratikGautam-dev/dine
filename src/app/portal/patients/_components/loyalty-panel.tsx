"use client";

import { useEffect } from "react";
import { History, Receipt, Star, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/portal/StatTile";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { CustomerHeader } from "./customer-header";
import type { LoyaltyTransaction, PatientDetail } from "@/hooks/usePatients";
import type { LoyaltyProgram } from "@/hooks/useLoyaltyProgram";

const TIERS = ["Silver", "Gold", "Platinum"] as const;
const TIER_TONE: Record<(typeof TIERS)[number], "neutral" | "warning" | "brand"> = {
  Silver: "neutral",
  Gold: "warning",
  Platinum: "brand",
};

const TIER_THRESHOLD: Record<(typeof TIERS)[number], keyof LoyaltyProgram> = {
  Silver: "silver_spend_threshold_paise",
  Gold: "gold_spend_threshold_paise",
  Platinum: "platinum_spend_threshold_paise",
};

/** This customer's current tier (resolved server-side into profile.loyalty_tier) plus, when
 * there's a next tier to reach, how much more spend closes the gap -- null once already
 * Platinum (or when the program has no tiers configured at all). */
function nextTierProgress(profile: PatientDetail, program: LoyaltyProgram) {
  const spend = profile.total_spend_paise;
  const currentIndex = profile.loyalty_tier ? TIERS.indexOf(profile.loyalty_tier as (typeof TIERS)[number]) : -1;
  const nextTier = TIERS[currentIndex + 1];
  if (!nextTier) return null;
  const floorPaise = currentIndex >= 0 ? (program[TIER_THRESHOLD[TIERS[currentIndex]]] as number) : 0;
  const ceilingPaise = program[TIER_THRESHOLD[nextTier]] as number;
  const span = Math.max(1, ceilingPaise - floorPaise);
  const pct = Math.max(0, Math.min(100, Math.round(((spend - floorPaise) / span) * 100)));
  return { nextTier, remainingPaise: Math.max(0, ceilingPaise - spend), pct };
}

/** Customers page's Loyalty tab -- points balance, spend-to-next-tier progress, this
 * restaurant's own program rules, the staff tier-override control, and the real earn/redeem
 * ledger (loyalty_transactions). Program editing lives alongside this tab's customer details. */
export function LoyaltyPanel({
  profile,
  profileLoading,
  savingTierOverride,
  onSetTierOverride,
  ledger,
  ledgerLoading,
  onLoadLedger,
  program,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  savingTierOverride: boolean;
  onSetTierOverride: (tier: string | null) => void;
  ledger: LoyaltyTransaction[] | null;
  ledgerLoading: boolean;
  onLoadLedger: () => void;
  program: LoyaltyProgram | null;
}) {
  useEffect(() => {
    if (profile) onLoadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (profileLoading || !profile) {
    return (
      <Card className="min-h-100 p-space-4">
        <FormSkeleton fields={3} />
      </Card>
    );
  }

  const progress = program ? nextTierProgress(profile, program) : null;

  return (
    <div className="space-y-space-4">
      <Card className="p-space-4">
        <CustomerHeader profile={profile} />

        <div className="mb-space-4 grid grid-cols-3 gap-space-3">
          <StatTile
            label="Loyalty points"
            value={profile.loyalty_points}
            deltaPct={null}
            icon={<Star size={20} />}
            tone="warning"
            hint={profile.loyalty_tier || "Not enrolled"}
          />
          <StatTile
            label="Total orders"
            value={profile.total_orders}
            deltaPct={null}
            icon={<Receipt size={20} />}
            tone="info"
            hint=""
          />
          <StatTile
            label="Total spend"
            value={rupees(profile.total_spend_paise)}
            deltaPct={null}
            icon={<Wallet size={20} />}
            tone="success"
            hint=""
          />
        </div>

        {progress && (
          <div className="mb-space-4 rounded-lg bg-paper p-space-3">
            <div className="mb-space-1 flex items-center justify-between text-[12px] font-semibold text-ink-600">
              <span>Progress to {progress.nextTier}</span>
              <span>{rupees(progress.remainingPaise)} to go</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width]"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}

        <PermissionGate page="patients" action="write">
          <div className="border-t border-line pt-space-3">
            <p className="mb-space-2 text-[11px] font-semibold text-ink-600">
              TIER OVERRIDE{" "}
              {profile.loyalty_tier_override && (
                <span className="font-normal text-ink-400">
                  (currently overridden to {profile.loyalty_tier_override})
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-space-2">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={savingTierOverride}
                  onClick={() => onSetTierOverride(tier)}
                  className={cn(
                    "rounded-md border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors disabled:opacity-50",
                    profile.loyalty_tier_override === tier
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-card text-ink-700 hover:border-brand-300 hover:bg-brand-50",
                  )}
                >
                  {tier}
                </button>
              ))}
              {profile.loyalty_tier_override && (
                <button
                  type="button"
                  disabled={savingTierOverride}
                  onClick={() => onSetTierOverride(null)}
                  className="rounded-md border border-line bg-card px-space-3 py-space-1 text-[12.5px] font-semibold text-ink-600 hover:bg-paper disabled:opacity-50"
                >
                  Back to automatic
                </button>
              )}
            </div>
          </div>
        </PermissionGate>
      </Card>

      {program && (
        <Card className="p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Program rules</h3>
          <p className="mb-space-3 text-[12.5px] text-ink-600">
            Every ₹{program.paise_per_point / 100} spent earns 1 point · {program.redeem_points} points redeem for{" "}
            {rupees(program.redeem_value_paise)}
          </p>
          <div className="space-y-space-2">
            {TIERS.map((tier) => {
              const key = tier.toLowerCase() as "silver" | "gold" | "platinum";
              const threshold = program[`${key}_spend_threshold_paise`];
              const benefit = program[`${key}_benefit`];
              return (
                <div key={tier} className="flex items-start justify-between gap-space-3 text-[12.5px]">
                  <div className="flex items-center gap-space-2">
                    <Badge tone={TIER_TONE[tier]}>{tier}</Badge>
                    <span className="text-ink-600">{rupees(threshold)}+ spend</span>
                  </div>
                  {benefit && <span className="text-right text-ink-700">{benefit}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-space-4">
        <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Points history</h3>
        {ledgerLoading || !ledger ? (
          <TableSkeleton rows={4} columns={1} />
        ) : ledger.length === 0 ? (
          <div className="flex flex-col items-center gap-space-2 rounded-lg bg-paper py-space-6 text-center">
            <History size={22} className="text-ink-300" />
            <p className="text-[12.5px] text-ink-400">
              No point activity yet — points are earned automatically on paid orders.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {ledger.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-space-2 text-[13px]">
                <div>
                  <p className="font-semibold text-ink-900 capitalize">
                    {t.kind}
                    {t.order_id && <span className="ml-space-2 font-normal text-ink-400">Order #{t.order_id}</span>}
                  </p>
                  <p className="text-[11.5px] text-ink-600">{formatDateTime(t.created_at)}</p>
                </div>
                <span
                  className={cn("font-semibold tabular-nums", t.points < 0 ? "text-destructive" : "text-success")}
                >
                  {t.points > 0 ? "+" : ""}
                  {t.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
