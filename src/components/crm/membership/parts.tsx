"use client";

import { ArrowUpRight01Icon, CrownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card } from "@/components/erp-ui/Card";
import { cn } from "@/lib/cn";
import {
  STATUS_META,
  TIER_LABEL,
  TIER_STYLE,
  pctText,
  type HistoryEntry,
  type MemberStatus,
  type Tier,
} from "@/lib/erp/membership";
import { formatDateTime } from "@/lib/erp/erp";

/** The header of a membership view: crown tile, title, one line, and the view's main action. */
export function ViewHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Defaults to the crown. */
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-3">
      <div className="flex min-w-0 items-center gap-space-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon ?? <HugeiconsIcon icon={CrownIcon} size={22} />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold leading-tight text-ink-900">
            {title}
          </h2>
          <p className="text-[13px] text-ink-600">{description}</p>
        </div>
      </div>
      {/* a phone gives the main action the whole row, like the other pages' Add buttons */}
      {action && (
        <div className="w-full max-md:[&>*]:w-full md:w-auto">{action}</div>
      )}
    </div>
  );
}

/** A figure with its icon, and how it moved against last month when that is known. */
export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Percent change against last month; null = nothing to compare with. */
  delta?: number | null;
  hint?: string;
}) {
  const text = delta === undefined ? null : pctText(delta);
  return (
    <Card className="flex min-w-0 flex-col items-start gap-space-2 p-space-3 md:flex-row md:items-center md:gap-space-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 md:h-11 md:w-11">
        {icon}
      </span>
      {/* on a phone the icon sits above, so the label has the tile's full width and wraps instead of being cut off */}
      <div className="w-full min-w-0 md:w-auto">
        <p className="text-[12px] break-words text-ink-600 max-md:min-h-9 md:truncate md:break-normal">
          {label}
        </p>
        <p className="text-[21px] font-bold leading-tight text-ink-900">
          {value}
        </p>
        {text && (
          <p
            className={cn(
              "flex items-center gap-1 text-[12px] font-semibold max-md:whitespace-nowrap max-md:text-[11px]",
              (delta ?? 0) >= 0 ? "text-success" : "text-error",
            )}
          >
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={12}
              className={(delta ?? 0) >= 0 ? "" : "rotate-90"}
            />
            {text}
            <span className="font-normal text-ink-600">vs last month</span>
          </p>
        )}
        {hint && (
          <p className="text-[12px] break-words text-ink-600 md:truncate md:break-normal">
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}

export function TierCrown({ tier, size = 32 }: { tier: Tier; size?: number }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        TIER_STYLE[tier],
      )}
      style={{ width: size, height: size }}
    >
      <HugeiconsIcon icon={CrownIcon} size={Math.round(size * 0.55)} />
    </span>
  );
}

export function TierPill({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-space-1 rounded-full px-space-3 py-1 text-[12.5px] font-semibold",
        TIER_STYLE[tier],
      )}
    >
      <HugeiconsIcon icon={CrownIcon} size={13} />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: MemberStatus | "draft" | "inactive_plan";
  label?: string;
  className?: string;
}) {
  const meta =
    status === "draft"
      ? {
          label: "Draft",
          pill: "bg-warning-tint text-warning",
          dot: "bg-warning",
        }
      : status === "inactive_plan"
        ? {
            label: "Inactive",
            pill: "bg-error-tint text-error",
            dot: "bg-error",
          }
        : STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-space-1 rounded-full px-space-3 py-1 text-[12.5px] font-semibold",
        meta.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {label ?? meta.label}
    </span>
  );
}

/** A circle-check bullet list line, as in the tier summary cards. */
export function CheckLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-space-2 text-[13px] text-ink-600">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[10px] leading-none text-white">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

const ACTION_LABEL: Record<string, string> = {
  assigned: "Membership assigned",
  renewed: "Membership renewed",
  paused: "Membership paused",
  resumed: "Membership resumed",
  tier_updated: "Plan updated",
  benefit_saved: "Benefit saved",
  benefit_deleted: "Benefit deleted",
  rule_saved: "Rule saved",
  rule_updated: "Qualification rule updated",
  rule_deleted: "Rule deleted",
};

/** What a history entry is about, in a few words. */
function describe(e: HistoryEntry) {
  const d = e.detail as Record<string, unknown>;
  return [d.customer, d.name, d.tier, d.rule, d.source]
    .filter((x) => typeof x === "string" && x)
    .join(" · ");
}

/** Recent membership changes whose action starts with one of `prefixes` (all of them when none are given). */
export function HistoryList({
  entries,
  prefixes,
  loading,
}: {
  entries: HistoryEntry[];
  prefixes?: string[];
  loading?: boolean;
}) {
  const shown = prefixes
    ? entries.filter((e) => prefixes.some((p) => e.action.startsWith(p)))
    : entries;
  if (!shown.length)
    return (
      <p className="px-space-3 py-space-6 text-center text-[13px] text-ink-600">
        {loading ? "Loading…" : "Nothing has changed yet."}
      </p>
    );
  return (
    <ul className="divide-y divide-line">
      {shown.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-center justify-between gap-space-2 px-space-3 py-space-3 text-[13px]"
        >
          <span className="min-w-0">
            <span className="font-semibold text-ink-900">
              {ACTION_LABEL[e.action] ?? e.action}
            </span>
            {describe(e) && (
              <span className="text-ink-600"> — {describe(e)}</span>
            )}
          </span>
          <span className="text-ink-400">
            {e.actor} · {formatDateTime(e.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
