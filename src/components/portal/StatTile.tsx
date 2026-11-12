import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Tone = "brand" | "success" | "clay" | "neutral" | "warning" | "info" | "violet";

type Props = {
  label: string;
  /** A plain number is comma-grouped; a string (e.g. fmtMinutes()'s "8h 20m") is shown as-is. */
  value: number | string;
  deltaPct: number | null;
  /** Shown before the number, e.g. "₹". */
  prefix?: string;
  /** A lucide icon element, e.g. <CalendarCheck size={20} />. */
  icon?: ReactNode;
  /** Kept so existing callers still compile. Every tile now uses the same brand look as the All
   * Customers cards, so the per-tile colour no longer changes anything. */
  tone?: Tone;
  /** Kept for existing callers; ignored (see `tone`). */
  filled?: boolean;
  /** No-shows: an increase is bad, so up/down colors invert relative to the
   * other tiles (dataviz skill: "delta color = direction x whether up is
   * good", not a flat green-up/red-down rule). */
  upIsGood?: boolean;
  /** "Upcoming appointments" is a live snapshot count, not a daily rate --
   * "vs last week" doesn't mean anything for it, so callers without a real
   * comparison can override the footer text (or hide it with ""). */
  hint?: string;
};

/** The portal's summary card, same look as the Campaigns cards: a round brand icon on the left, with the
 * label, bold value and small hint beside it, and an optional trend badge next to the value. */
export function StatTile({
  label,
  value,
  deltaPct,
  prefix,
  icon,
  upIsGood = true,
  hint = "vs last week",
}: Props) {
  const isUp = deltaPct !== null && deltaPct > 0;
  const isDown = deltaPct !== null && deltaPct < 0;
  const isGoodDirection = (isUp && upIsGood) || (isDown && !upIsGood);
  const isBadDirection = (isUp && !upIsGood) || (isDown && upIsGood);
  // "vs last week" only means something next to a real delta; a custom hint (e.g. "Currently booked") always shows.
  const showHint = Boolean(hint) && (deltaPct !== null || hint !== "vs last week");

  return (
    <Card className="flex min-h-[104px] min-w-0 items-center gap-space-3 p-space-3">
      {icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug break-words text-ink-600">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-space-2 gap-y-0.5">
          <span className="text-[20px] leading-tight font-bold break-words text-ink-900">
            {prefix}
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {/* No delta at all when there is nothing real to compare against (no dashes, no invented trend). */}
          {deltaPct !== null && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[12px] font-semibold",
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
        {showHint && <p className="text-[12px] leading-snug break-words text-ink-400">{hint}</p>}
      </div>
    </Card>
  );
}
