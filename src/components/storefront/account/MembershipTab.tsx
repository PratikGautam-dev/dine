import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { rupees } from "@/lib/foodOrders";
import type { LoyaltyInfo } from "@/lib/useAccountLoyalty";

export function MembershipTab({ loyalty }: { loyalty: LoyaltyInfo }) {
  if (loyalty.tiers.length === 0) {
    return (
      <Card className="p-10 text-center">
        <span className="material-symbols-outlined text-sf-text-muted text-4xl">military_tech</span>
        <h3 className="font-sf-headline text-lg font-bold mt-2">No loyalty program yet</h3>
        <p className="font-sf-body text-sm text-sf-text-muted mt-1">
          Place an order to see this restaurant&apos;s membership tiers.
        </p>
      </Card>
    );
  }

  const currentIndex = loyalty.tiers.findIndex((t) => t.name === loyalty.current_tier);

  return (
    <div className="space-y-4">
      {loyalty.tiers.map((tier, index) => {
        const isCurrent = index === currentIndex;
        const isLocked = currentIndex === -1 ? true : index > currentIndex;
        return (
          <Card key={tier.id} className={cn("p-6", isCurrent && "ring-2 ring-sf-primary")}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sf-headline text-xl font-semibold text-sf-on-surface">{tier.name}</h3>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full bg-sf-primary-light text-sf-primary font-sf-body text-xs font-bold">
                      Current tier
                    </span>
                  )}
                  {!isLocked && !isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full bg-sf-success-soft text-sf-veg-green font-sf-body text-xs font-bold">
                      Achieved
                    </span>
                  )}
                </div>
                <p className="font-sf-body text-xs text-sf-text-muted mt-0.5">
                  {tier.threshold_paise === 0
                    ? "Starting tier"
                    : `Unlocks at ${rupees(tier.threshold_paise)} lifetime spend`}
                </p>
              </div>
              {isLocked && (
                <span className="material-symbols-outlined text-sf-text-muted" title="Locked">
                  lock
                </span>
              )}
            </div>
            {tier.benefit ? (
              <div
                className={cn(
                  "flex items-center gap-2 font-sf-body text-sm rounded-lg bg-sf-surface-container-low px-3 py-2",
                  isLocked ? "text-sf-text-muted" : "text-sf-on-surface",
                )}
              >
                <span
                  className={cn("material-symbols-outlined text-[18px]", isLocked ? "text-sf-text-muted" : "text-sf-veg-green")}
                >
                  {isLocked ? "lock" : "check_circle"}
                </span>
                {tier.benefit}
              </div>
            ) : (
              <p className="font-sf-body text-xs text-sf-text-muted">No benefit text set for this tier yet.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
