import { MEMBERSHIP, TIERS, formatFullDate, formatShortDate } from "@/lib/account";

export function MembershipCard() {
  const currentIndex = TIERS.findIndex((t) => t.id === MEMBERSHIP.currentTierId);
  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1];

  // Matches the "₹spent / ₹threshold" label: lifetime spend against the next tier's threshold
  const progress = next ? Math.min(100, (MEMBERSHIP.lifetimeSpend / next.threshold) * 100) : 100;
  const remaining = next ? Math.max(0, next.threshold - MEMBERSHIP.lifetimeSpend) : 0;

  const perks = [
    { icon: "bolt", tone: "text-sf-primary-container", label: "Free Priority Delivery" },
    { icon: "percent", tone: "text-sf-rating-amber", label: "10% Extra Cashback" },
    { icon: "cake", tone: "text-sf-secondary-fixed-dim", label: "Chef's Complimentary Dessert" },
  ];

  return (
    <div className="lg:col-span-5 bg-gradient-to-br from-sf-ink via-sf-ink-wine to-sf-ink text-sf-on-primary rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-sf-primary/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sf-rating-amber/20 text-sf-rating-amber font-sf-body text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">stars</span>
            DAAP GOURMET CLUB
          </div>
          <span className="font-sf-body text-xs text-sf-on-primary/70">Renews {formatFullDate(MEMBERSHIP.renewsOn)}</span>
        </div>
        <h2 className="font-sf-headline text-2xl font-bold tracking-tight mt-1">{current.name.split(" ")[0]} Tier Member</h2>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {perks.map((perk) => (
            <span
              key={perk.label}
              className="px-2.5 py-1 rounded-full bg-sf-surface/10 text-sf-on-primary/90 font-sf-body text-xs font-semibold flex items-center gap-1"
            >
              <span className={`material-symbols-outlined text-[14px] ${perk.tone}`}>{perk.icon}</span>
              {perk.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-4 pt-2">
        {next ? (
          <>
            <div className="flex justify-between items-center text-sf-on-primary/80 font-sf-body text-xs font-semibold mb-1.5">
              <span>Progress to {next.name}</span>
              <span className="text-sf-on-primary">
                ₹{MEMBERSHIP.lifetimeSpend.toLocaleString("en-IN")} / ₹{next.threshold.toLocaleString("en-IN")}
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
            <p className="font-sf-body text-[11px] text-sf-on-primary/70 mt-1.5">
              Spend ₹{remaining.toLocaleString("en-IN")} more before {formatShortDate(MEMBERSHIP.upgradeDeadline)} to
              unlock concierge reservations &amp; 20% cashback.
            </p>
          </>
        ) : (
          <p className="font-sf-body text-xs text-sf-on-primary/80">You&apos;ve reached our highest tier. Enjoy every perk.</p>
        )}
      </div>
    </div>
  );
}
