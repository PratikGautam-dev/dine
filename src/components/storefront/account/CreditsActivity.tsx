import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/account";
import type { LoyaltyTransaction } from "@/lib/useAccountLoyalty";

const KIND_STYLE: Record<string, { icon: string; wrap: string; amount: string; label: string }> = {
  earn: { icon: "add", wrap: "bg-sf-success-soft text-sf-veg-green", amount: "text-sf-veg-green", label: "Points earned" },
  redeem: { icon: "remove", wrap: "bg-sf-surface-container text-sf-text-body", amount: "text-sf-on-surface", label: "Points redeemed" },
};

interface CreditsActivityProps {
  transactions: LoyaltyTransaction[] | null;
  /** Show only the most recent entries, with a link to the full ledger */
  limit?: number;
  onViewAll?: () => void;
}

export function CreditsActivity({ transactions, limit, onViewAll }: CreditsActivityProps) {
  const all = transactions ?? [];
  const rows = limit ? all.slice(0, limit) : all;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="font-sf-body text-[11px] uppercase tracking-wider font-semibold text-sf-text-muted block">
            Transaction History
          </span>
          <h3 className="font-sf-body text-lg font-bold text-sf-on-surface">Credits Activity</h3>
        </div>
        {onViewAll && limit && all.length > limit && (
          <button
            type="button"
            onClick={onViewAll}
            className="font-sf-body text-xs text-sf-primary font-semibold hover:underline cursor-pointer"
          >
            View All
          </button>
        )}
      </div>

      {transactions === null ? (
        <p className="font-sf-body text-sm text-sf-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="font-sf-body text-sm text-sf-text-muted">No point activity yet — points are earned automatically on paid orders.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((tx) => {
            const style = KIND_STYLE[tx.kind] ?? KIND_STYLE.earn;
            return (
              <li key={tx.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", style.wrap)}>
                    <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-sf-body text-sm font-semibold text-sf-on-surface truncate">{style.label}</h4>
                    <span className="font-sf-body text-[11px] text-sf-text-muted block">
                      {formatShortDate(tx.created_at)}
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
      )}
    </div>
  );
}
