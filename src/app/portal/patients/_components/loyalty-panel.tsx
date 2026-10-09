"use client";

import { useEffect } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatDate";
import { CustomerHeader } from "./customer-header";
import type { LoyaltyTransaction, PatientDetail } from "@/hooks/usePatients";

const TIERS = ["Silver", "Gold", "Platinum"] as const;

/** Customers page's Loyalty tab -- points balance, the staff tier-override control
 * (patients.loyalty_tier_override had no portal route until this session), and the real
 * earn/redeem ledger (loyalty_transactions, written by food_orders.py but never read back
 * per-customer until now). */
export function LoyaltyPanel({
  profile,
  profileLoading,
  savingTierOverride,
  onSetTierOverride,
  ledger,
  ledgerLoading,
  onLoadLedger,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  savingTierOverride: boolean;
  onSetTierOverride: (tier: string | null) => void;
  ledger: LoyaltyTransaction[] | null;
  ledgerLoading: boolean;
  onLoadLedger: () => void;
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

  return (
    <div className="space-y-space-4">
      <Card className="p-space-4">
        <CustomerHeader profile={profile} />

        <div className="mb-space-4 grid grid-cols-2 gap-space-3">
          <div className="rounded-lg bg-paper px-space-3 py-space-3">
            <p className="text-[11px] font-semibold text-ink-600">LOYALTY POINTS</p>
            <p className="text-[22px] font-bold tabular-nums text-ink-900">{profile.loyalty_points}</p>
          </div>
          <div className="rounded-lg bg-paper px-space-3 py-space-3">
            <p className="text-[11px] font-semibold text-ink-600">TOTAL ORDERS</p>
            <p className="text-[22px] font-bold tabular-nums text-ink-900">{profile.total_orders}</p>
          </div>
        </div>

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
                  <p className="font-semibold text-ink-900 capitalize">{t.kind}</p>
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
