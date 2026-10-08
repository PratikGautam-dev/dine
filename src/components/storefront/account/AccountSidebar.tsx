import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { CreditsActivity } from "./CreditsActivity";
import { MEMBERSHIP, TIERS } from "@/lib/account";

interface AccountSidebarProps {
  onViewLedger: () => void;
}

export function AccountSidebar({ onViewLedger }: AccountSidebarProps) {
  const currentIndex = TIERS.findIndex((t) => t.id === MEMBERSHIP.currentTierId);
  const nextTier = TIERS[currentIndex + 1];
  const remaining = nextTier ? Math.max(0, nextTier.threshold - MEMBERSHIP.lifetimeSpend) : 0;

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
          <span className="px-2.5 py-1 rounded-full bg-sf-primary-light text-sf-primary font-sf-body text-xs font-bold">
            {TIERS[currentIndex].name.split(" ")[0]} Active
          </span>
        </div>

        <ol className="relative pl-6 space-y-6">
          <div className="absolute left-2.5 top-2 bottom-3 w-0.5 bg-sf-surface-container-high" aria-hidden="true" />
          {TIERS.map((tier, index) => {
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
                    <p className="font-sf-body text-xs text-sf-on-surface-variant mt-1">{tier.summary}</p>
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
                      {index === currentIndex + 1 && remaining > 0 && (
                        <span className="font-sf-body text-xs text-sf-rating-amber font-semibold">
                          ₹{remaining.toLocaleString("en-IN")} to unlock
                        </span>
                      )}
                    </div>
                    <p className="font-sf-body text-xs text-sf-text-muted">{tier.summary}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-6">
        <CreditsActivity limit={4} onViewAll={onViewLedger} />
      </Card>

      <div className="bg-gradient-to-r from-sf-primary-light to-sf-surface rounded-2xl p-4 shadow-sm border border-sf-border-divider/70 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-sf-primary text-sf-on-primary flex items-center justify-center shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-[24px]">savings</span>
        </div>
        <div className="min-w-0">
          <span className="font-sf-body text-xs font-bold text-sf-primary block">TOTAL SAVINGS THIS YEAR</span>
          <span className="font-sf-headline text-xl font-bold text-sf-on-surface">
            ₹{MEMBERSHIP.yearlySavings.toLocaleString("en-IN")} Saved
          </span>
          <p className="font-sf-body text-[11px] text-sf-text-muted">
            Via Gold priority free deliveries and bill cashbacks.
          </p>
        </div>
      </div>
    </div>
  );
}
