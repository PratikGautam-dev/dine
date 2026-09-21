import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: number;
  deltaPct: number | null;
  /** A lucide icon element for the tinted square, e.g. <CalendarCheck size={22} />. */
  icon?: ReactNode;
  /** No-shows: an increase is bad, so up/down colors invert relative to the
   * other tiles (dataviz skill: "delta color = direction x whether up is
   * good", not a flat green-up/red-down rule). */
  upIsGood?: boolean;
  /** "Upcoming appointments" is a live snapshot count, not a daily rate --
   * "vs last week" doesn't mean anything for it, so callers without a real
   * comparison can override the footer text (or hide it with ""). */
  hint?: string;
};

export function StatTile({ label, value, deltaPct, icon, upIsGood = true, hint = "vs last week" }: Props) {
  const isUp = deltaPct !== null && deltaPct > 0;
  const isDown = deltaPct !== null && deltaPct < 0;
  const isGoodDirection = (isUp && upIsGood) || (isDown && !upIsGood);
  const isBadDirection = (isUp && !upIsGood) || (isDown && upIsGood);
  // "vs last week" only means something next to a real delta; a custom hint (e.g. "Currently booked") always shows.
  const showHint = Boolean(hint) && (deltaPct !== null || hint !== "vs last week");

  return (
    <Card className="flex items-start gap-space-3 p-space-4">
      {icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[13px] leading-snug font-semibold text-ink-600">{label}</p>
        <div className="mt-1 flex items-baseline gap-space-2">
          <span className="text-[30px] leading-none font-bold text-ink-900">{value.toLocaleString()}</span>
          {/* No delta at all when there is nothing real to compare against (no dashes, no invented trend). */}
          {deltaPct !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[12.5px] font-semibold",
                isGoodDirection && "text-success",
                isBadDirection && "text-error",
                deltaPct === 0 && "text-ink-400",
              )}
            >
              {isUp && <TrendingUp size={13} />}
              {isDown && <TrendingDown size={13} />}
              {deltaPct === 0 && <Minus size={13} />}
              {Math.abs(deltaPct)}%
            </span>
          )}
        </div>
        {showHint && <p className="text-hint mt-1">{hint}</p>}
      </div>
    </Card>
  );
}
