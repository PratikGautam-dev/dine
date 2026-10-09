import { rupees } from "@/lib/foodOrders";
import type { LoyaltyInfo } from "@/lib/useAccountLoyalty";

export function MembershipCard({ loyalty }: { loyalty: LoyaltyInfo }) {
  const current = loyalty.tiers.find((t) => t.name === loyalty.current_tier);
  const next = loyalty.next_tier;
  const progress =
    next && next.threshold_paise > 0 ? Math.min(100, (loyalty.total_spend_paise / next.threshold_paise) * 100) : 100;

  return (
    <div className="lg:col-span-5 bg-gradient-to-br from-sf-ink via-sf-ink-wine to-sf-ink text-sf-on-primary rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-sf-primary/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sf-rating-amber/20 text-sf-rating-amber font-sf-body text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">stars</span>
            DAAP GOURMET CLUB
          </div>
        </div>
        <h2 className="font-sf-headline text-2xl font-bold tracking-tight mt-1">
          {current ? `${current.name} Tier Member` : "New Member"}
        </h2>
        {current?.benefit && (
          <p className="font-sf-body text-sm text-sf-on-primary/85 mt-2">{current.benefit}</p>
        )}
      </div>

      <div className="relative mt-4 pt-2">
        {next ? (
          <>
            <div className="flex justify-between items-center text-sf-on-primary/80 font-sf-body text-xs font-semibold mb-1.5">
              <span>Progress to {next.name}</span>
              <span className="text-sf-on-primary">
                {rupees(loyalty.total_spend_paise)} / {rupees(next.threshold_paise)}
              </span>
            </div>
            <div
              className="w-full bg-sf-surface/20 h-2 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label={`Progress to ${next.name}`}
            >
              <div
                className="bg-gradient-to-r from-sf-primary to-sf-rating-amber h-full rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            {loyalty.amount_to_next_tier_paise != null && (
              <p className="font-sf-body text-[11px] text-sf-on-primary/70 mt-1.5">
                Spend {rupees(loyalty.amount_to_next_tier_paise)} more to reach {next.name}
                {next.benefit ? `: ${next.benefit}` : "."}
              </p>
            )}
          </>
        ) : loyalty.tiers.length > 0 ? (
          <p className="font-sf-body text-xs text-sf-on-primary/80">You&apos;ve reached our highest tier. Enjoy every perk.</p>
        ) : (
          <p className="font-sf-body text-xs text-sf-on-primary/80">Place an order to start earning rewards.</p>
        )}
      </div>
    </div>
  );
}
