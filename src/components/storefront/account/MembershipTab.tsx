import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { MEMBERSHIP, TIERS } from "@/lib/account";

export function MembershipTab() {
  const currentIndex = TIERS.findIndex((t) => t.id === MEMBERSHIP.currentTierId);

  return (
    <div className="space-y-4">
      {TIERS.map((tier, index) => {
        const isCurrent = index === currentIndex;
        const isLocked = index > currentIndex;
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
                  {tier.threshold === 0
                    ? "Starting tier"
                    : `Unlocks at ₹${tier.threshold.toLocaleString("en-IN")} lifetime spend`}
                </p>
              </div>
              {isLocked && (
                <span className="material-symbols-outlined text-sf-text-muted" title="Locked">
                  lock
                </span>
              )}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tier.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className={cn(
                    "flex items-center gap-2 font-sf-body text-sm rounded-lg bg-sf-surface-container-low px-3 py-2",
                    isLocked ? "text-sf-text-muted" : "text-sf-on-surface",
                  )}
                >
                  <span
                    className={cn(
                      "material-symbols-outlined text-[18px]",
                      isLocked ? "text-sf-text-muted" : "text-sf-veg-green",
                    )}
                  >
                    {isLocked ? "lock" : "check_circle"}
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
