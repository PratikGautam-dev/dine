import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { CreditsActivity } from "./CreditsActivity";
import { rupees } from "@/lib/foodOrders";
import type { LoyaltyInfo, LoyaltyTransaction } from "@/lib/useAccountLoyalty";

interface AccountSidebarProps {
  loyalty: LoyaltyInfo;
  transactions: LoyaltyTransaction[] | null;
  onViewLedger: () => void;
}

export function AccountSidebar({ loyalty, transactions, onViewLedger }: AccountSidebarProps) {
  if (loyalty.tiers.length === 0) {
    return (
      <Card className="p-6">
        <CreditsActivity transactions={transactions} limit={4} onViewAll={onViewLedger} />
      </Card>
    );
  }

  const currentIndex = loyalty.tiers.findIndex((t) => t.name === loyalty.current_tier);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-sf-body text-[11px] uppercase tracking-wider font-semibold text-sf-text-muted block">
              Tier Progression
            </span>
            <h3 className="font-sf-body text-lg font-bold text-sf-on-surface">Club Milestones</h3>
          </div>
          {currentIndex >= 0 && (
            <span className="px-2.5 py-1 rounded-full bg-sf-primary-light text-sf-primary font-sf-body text-xs font-bold">
              {loyalty.tiers[currentIndex].name} Active
            </span>
          )}
        </div>

        <ol className="relative pl-6 space-y-6">
          <div className="absolute left-2.5 top-2 bottom-3 w-0.5 bg-sf-surface-container-high" aria-hidden="true" />
          {loyalty.tiers.map((tier, index) => {
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex;
            return (
              <li key={tier.id} className={cn("relative", index > currentIndex && "opacity-80")}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold",
                    isDone && "bg-sf-veg-green text-sf-on-primary",
                    isCurrent && "bg-sf-primary text-sf-on-primary ring-4 ring-sf-primary-light",
                    !isDone && !isCurrent && "bg-sf-surface-container-high text-sf-text-muted",
                  )}
                >
                  {isDone ? "✓" : isCurrent ? "★" : index + 1}
                </span>
                {isCurrent ? (
                  <div className="bg-sf-primary-light/40 p-2 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sf-body text-sm font-bold text-sf-primary">{tier.name} (Current)</span>
                      <span className="font-sf-body text-xs text-sf-primary font-semibold">Active</span>
                    </div>
                    {tier.benefit && <p className="font-sf-body text-xs text-sf-on-surface-variant mt-1">{tier.benefit}</p>}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "font-sf-body text-sm",
                          isDone ? "font-bold text-sf-on-surface" : "font-semibold text-sf-on-surface",
                        )}
                      >
                        {tier.name}
                      </span>
                      {index === currentIndex + 1 && loyalty.amount_to_next_tier_paise != null && (
                        <span className="font-sf-body text-xs text-sf-rating-amber font-semibold">
                          {rupees(loyalty.amount_to_next_tier_paise)} to unlock
                        </span>
                      )}
                    </div>
                    {tier.benefit && <p className="font-sf-body text-xs text-sf-text-muted">{tier.benefit}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-6">
        <CreditsActivity transactions={transactions} limit={4} onViewAll={onViewLedger} />
      </Card>
    </div>
  );
}
