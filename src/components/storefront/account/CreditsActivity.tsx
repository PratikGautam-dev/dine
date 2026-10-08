import { cn } from "@/lib/cn";
import { CREDIT_TRANSACTIONS, MEMBERSHIP, formatFullDate, formatShortDate, type CreditTransaction } from "@/lib/account";

const KIND_STYLE: Record<CreditTransaction["kind"], { icon: string; wrap: string; amount: string }> = {
  cashback: { icon: "add", wrap: "bg-sf-success-soft text-sf-veg-green", amount: "text-sf-veg-green" },
  bonus: { icon: "cake", wrap: "bg-sf-primary-light text-sf-primary", amount: "text-sf-primary" },
  redeemed: { icon: "remove", wrap: "bg-sf-surface-container text-sf-text-body", amount: "text-sf-on-surface" },
};

interface CreditsActivityProps {
  /** Show only the most recent entries, with a link to the full ledger */
  limit?: number;
  onViewAll?: () => void;
}

export function CreditsActivity({ limit, onViewAll }: CreditsActivityProps) {
  const rows = limit ? CREDIT_TRANSACTIONS.slice(0, limit) : CREDIT_TRANSACTIONS;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-sf-body text-[11px] uppercase tracking-wider font-semibold text-sf-text-muted block">
            Transaction History
          </span>
          <h3 className="font-sf-body text-lg font-bold text-sf-on-surface">Credits Activity</h3>
        </div>
        {onViewAll && limit && CREDIT_TRANSACTIONS.length > limit && (
          <button
            type="button"
            onClick={onViewAll}
            className="font-sf-body text-xs text-sf-primary font-semibold hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      <ul className="space-y-4">
        {rows.map((tx) => {
          const style = KIND_STYLE[tx.kind];
          return (
            <li key={tx.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", style.wrap)}>
                  <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="font-sf-body text-sm font-semibold text-sf-on-surface truncate">{tx.title}</h4>
                  <span className="font-sf-body text-[11px] text-sf-text-muted block">
                    {formatShortDate(tx.date)} • {tx.detail}
                  </span>
                </div>
              </div>
              <span className={cn("font-sf-body text-sm font-bold shrink-0", style.amount)}>
                {tx.points > 0 ? "+" : "-"}
                {Math.abs(tx.points)} Pts
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 bg-sf-surface-container-low rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-sf-text-body">
          <span className="material-symbols-outlined text-sf-rating-amber text-[18px]">redeem</span>
          <span className="font-sf-body text-xs">Credits expiry date</span>
        </div>
        <span className="font-sf-body text-xs font-semibold text-sf-on-surface">
          {formatFullDate(MEMBERSHIP.creditsExpireOn)}
        </span>
      </div>
    </div>
  );
}
