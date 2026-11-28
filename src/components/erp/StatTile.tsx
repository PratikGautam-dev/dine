import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/erp-ui/Card";
import { Skeleton } from "@/components/erp-ui/Skeleton";
import { cn } from "@/lib/cn";

type Tone = "brand" | "success" | "clay" | "neutral" | "warning" | "info" | "violet";

// Icon-square background/text per tone -- brand (the default, used everywhere else) plus the app's existing
// success/clay/warning/neutral tokens, reused here rather than one-off hex values, so a page that wants
// per-tile color variety (status-coded tiles, e.g.) still draws from the same palette as every badge/switch.
// "warning" (amber), not "destructive" (also red) -- a status tile sitting next to a brand-red tile needs a
// hue that's actually distinguishable at a glance, not two reds that only differ up close.
// "info" (blue) / "violet" -- two more distinct status hues, defined as shared tokens in globals.css (not one-off hex
// here) since both are reusable across pages.
const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-tint text-success",
  clay: "bg-clay-100 text-clay-700",
  neutral: "bg-black/[0.04] text-ink-600",
  warning: "bg-warning-tint text-warning",
  info: "bg-info-tint text-info",
  violet: "bg-accent-violet-tint text-accent-violet",
};

// Solid-fill variant (white icon on a solid tone background) -- an opt-in look (the `filled` prop
// below) for a page that wants bolder tiles, e.g. a KPI row; every other page keeps the default
// tinted-square look above unless it explicitly asks for this one too.
const TONE_CLASSES_FILLED: Record<Tone, string> = {
  brand: "bg-brand-600 text-white",
  success: "bg-success text-white",
  clay: "bg-clay-500 text-white",
  neutral: "bg-ink-600 text-white",
  warning: "bg-warning text-white",
  info: "bg-info text-white",
  violet: "bg-accent-violet text-white",
};

type Props = {
  label: string;
  /** A plain number is comma-grouped; a string (e.g. fmtMinutes()'s "8h 20m") is shown as-is. */
  value: number | string;
  deltaPct: number | null;
  /** Shown before the number, e.g. "₹". */
  prefix?: string;
  /** A lucide icon element for the tinted square, e.g. <CalendarCheck size={22} />. */
  icon?: ReactNode;
  /** Icon-square color. Defaults to brand (the site-wide default) -- pass another tone only where a page
   * deliberately wants per-tile color variety instead of the single-brand-color convention. */
  tone?: Tone;
  /** Solid-fill icon square (white icon) instead of the default tinted square. */
  filled?: boolean;
  /** No-shows: an increase is bad, so up/down colors invert relative to the
   * other tiles (dataviz skill: "delta color = direction x whether up is
   * good", not a flat green-up/red-down rule). */
  upIsGood?: boolean;
  /** An open-orders count is a live snapshot, not a daily rate --
   * "vs last week" doesn't mean anything for it, so callers without a real
   * comparison can override the footer text (or hide it with ""). */
  hint?: string;
  /** While the numbers are still loading from the backend: shows a skeleton instead of a misleading 0. */
  loading?: boolean;
  /** Optional explanation shown from an info icon next to the label. */
  info?: ReactNode;
  /** Stack the icon above readable, full-width content in mobile summary grids. */
  stackOnMobile?: boolean;
  /** Tighter padding and a smaller icon square, for a dense summary row. */
  compact?: boolean;
};

export function StatTile({
  label,
  value,
  deltaPct,
  prefix,
  icon,
  tone = "brand",
  filled = false,
  upIsGood = true,
  hint = "vs last week",
  loading = false,
  info,
  stackOnMobile = false,
  compact = false,
}: Props) {
  const isUp = deltaPct !== null && deltaPct > 0;
  const isDown = deltaPct !== null && deltaPct < 0;
  const isGoodDirection = (isUp && upIsGood) || (isDown && !upIsGood);
  const isBadDirection = (isUp && !upIsGood) || (isDown && upIsGood);
  // "vs last week" only means something next to a real delta; a custom hint (e.g. "Currently booked") always shows.
  const showHint = Boolean(hint) && (deltaPct !== null || hint !== "vs last week");

  return (
    <Card
      className={cn(
        "flex items-start",
        stackOnMobile
          ? "min-w-0 flex-col gap-space-2 p-space-3 md:flex-row md:gap-space-3 md:p-space-4"
          : compact
            ? "gap-space-3 p-space-3"
            : "gap-space-3 p-space-4",
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md",
            compact ? "h-10 w-10" : "h-12 w-12",
            (filled ? TONE_CLASSES_FILLED : TONE_CLASSES)[tone],
          )}
        >
          {icon}
        </span>
      )}
      <div className={cn("min-w-0", stackOnMobile && "w-full md:w-auto")}>
        <p
          className={cn(
            "text-[13px] leading-snug font-semibold text-ink-600",
            stackOnMobile &&
              "min-h-9 [overflow-wrap:anywhere] md:min-h-0 md:[overflow-wrap:normal]",
          )}
        >
          {label}
          {info}
        </p>
        <div
          className={cn(
            "mt-1 flex items-baseline gap-space-2",
            stackOnMobile && "flex-wrap md:flex-nowrap",
          )}
        >
          {loading ? (
            <Skeleton className={cn("h-[30px] w-24", stackOnMobile && "max-w-full")} />
          ) : (
            <span
              className={cn(
                "leading-none font-bold text-ink-900",
                typeof value === "string" && value.length + (prefix?.length ?? 0) > 9
                  ? "text-[24px]"
                  : "text-[30px]",
                stackOnMobile &&
                  "max-md:min-w-0 max-md:max-w-full max-md:text-[24px] max-md:leading-tight max-md:[overflow-wrap:anywhere]",
              )}
            >
              {prefix}
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
          )}
          {/* No delta at all when there is nothing real to compare against (no dashes, no invented trend). */}
          {!loading && deltaPct !== null && (
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
        {showHint && !loading && (
          <p
            className={cn(
              "text-hint mt-1",
              stackOnMobile && "[overflow-wrap:anywhere] md:[overflow-wrap:normal]",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
