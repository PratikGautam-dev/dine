"use client";

import {
  Clock01Icon,
  FlashIcon,
  PlayCircleIcon,
  Tag01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Bike, ShoppingBag, Utensils } from "lucide-react";
import { Panel } from "@/components/crm/campaignView";
import { StatCard } from "@/components/crm/membership/parts";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import type { Offer } from "@/hooks/useOffers";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";

/* The ERP Discounts page's view parts (ERP/shopconnect-tenant/src/components/discounts/discountView.tsx), fed by Dine's coupon offers. */

export type Stage = "active" | "paused" | "scheduled" | "expired";
export const stageOf = (o: Offer): Stage =>
  o.status === "disabled" ? "paused" : (o.status as Stage);

export const KIND_LABEL = { percentage: "Percentage off", flat: "Flat amount off" } as const;

const STAGE_META: Record<Stage, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success-tint text-success" },
  paused: { label: "Paused", className: "bg-warning-tint text-warning" },
  scheduled: { label: "Scheduled", className: "bg-info-tint text-info" },
  expired: { label: "Expired", className: "bg-ink-50 text-ink-700" },
};

export function StagePill({ stage }: { stage: Stage }) {
  const m = STAGE_META[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-space-2 py-0.5 text-[12px] font-semibold",
        m.className,
      )}
    >
      {m.label}
    </span>
  );
}

const CHANNEL = {
  all: { label: "All orders", icon: <WhatsAppIcon size={16} /> },
  pickup: { label: "Takeaway", icon: <ShoppingBag size={16} /> },
  dine_in: { label: "Dine in", icon: <Utensils size={16} /> },
  delivery: { label: "Delivery only", icon: <Bike size={16} /> },
} as const;
const channelOf = (o: Offer) => o.fulfillment_type ?? "all";

export function ChannelIcon({ offer }: { offer: Offer }) {
  const c = CHANNEL[channelOf(offer)];
  return (
    <span className="flex items-center text-brand-700" title={c.label} aria-label={c.label}>
      {c.icon}
    </span>
  );
}

export function UsageCell({ o }: { o: Offer }) {
  const pct = o.max_redemptions
    ? Math.min(100, Math.round((100 * o.usage_count) / o.max_redemptions))
    : null;
  return (
    <span className={cn("block", pct !== null && "min-w-[110px]")}>
      <span className="flex items-baseline justify-between gap-space-2 text-[12.5px]">
        <span className="font-medium text-ink-900">
          {o.usage_count.toLocaleString("en-IN")}
          {o.max_redemptions !== null && (
            <span className="text-ink-600"> / {o.max_redemptions.toLocaleString("en-IN")}</span>
          )}
        </span>
        {pct !== null && <span className="text-ink-600">{pct}%</span>}
      </span>
      {pct !== null && (
        <span className="mt-1 block h-1.5 rounded-full bg-ink-50">
          <span className="block h-1.5 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </span>
      )}
    </span>
  );
}

const nf = (v: number) => v.toLocaleString("en-IN");

export function OfferKpis({ list }: { list: Offer[] | undefined }) {
  const all = list ?? [];
  return (
    <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
      <StatCard
        label="Total Discounts"
        value={list ? nf(all.length) : "—"}
        icon={<HugeiconsIcon icon={Tag01Icon} size={20} />}
      />
      <StatCard
        label="Active Discounts"
        value={list ? nf(all.filter((o) => stageOf(o) === "active").length) : "—"}
        icon={<HugeiconsIcon icon={PlayCircleIcon} size={20} />}
      />
      <StatCard
        label="Total Redemptions (Usage)"
        value={list ? nf(all.reduce((s, o) => s + o.usage_count, 0)) : "—"}
        icon={<HugeiconsIcon icon={UserMultiple02Icon} size={20} />}
      />
      <StatCard
        label="Expiring Soon"
        value={list ? nf(all.filter((o) => o.status === "active" && isSoon(o)).length) : "—"}
        hint="active, ending within 7 days"
        icon={<HugeiconsIcon icon={Clock01Icon} size={20} />}
      />
    </div>
  );
}

/** valid_to is a date: the offer runs through the end of that day. */
const endsAt = (o: Offer) => Date.parse(`${o.valid_to.slice(0, 10)}T23:59:59`);
const isSoon = (o: Offer) => {
  const left = endsAt(o) - Date.now();
  return left >= 0 && left < 7 * 86_400_000;
};

const PALETTE = ["#e21220", "#f0636d", "#f7a1a7", "#fbcfd2", "#9ca3a0"];

/** Redemptions by kind of discount, as a donut with the figures beside it. */
export function TypeDonut({ list }: { list: Offer[] }) {
  const by = new Map<string, number>();
  for (const o of list) by.set(o.discount_type, (by.get(o.discount_type) ?? 0) + o.usage_count);
  const rows = [...by].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const stops = rows.map(([, v], i) => {
    const before = rows.slice(0, i).reduce((sum, [, x]) => sum + x, 0);
    return `${PALETTE[i % PALETTE.length]} ${(100 * before) / total}% ${(100 * (before + v)) / total}%`;
  });
  return (
    <Panel title="Top Performing Discount Types" subtitle="By redemptions (usage)">
      {total === 0 ? (
        <p className="text-[13px] text-ink-600">No redemptions yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-space-4">
          <div
            className="relative h-32 w-32 shrink-0 rounded-full"
            style={{ background: `conic-gradient(${stops.join(", ")})` }}
          >
            <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-card text-center">
              <span className="text-[17px] leading-tight font-bold text-ink-900">{nf(total)}</span>
              <span className="text-[10.5px] text-ink-600">Total Redemptions</span>
            </div>
          </div>
          <ul className="min-w-[160px] flex-1 space-y-space-2 text-[13px]">
            {rows.map(([kind, v], i) => (
              <li key={kind} className="flex items-center gap-space-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-900">
                  {KIND_LABEL[kind as keyof typeof KIND_LABEL]}
                </span>
                <span className="text-ink-900">{nf(v)}</span>
                <span className="w-12 text-right text-ink-600">
                  {Math.round((1000 * v) / total) / 10}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Redemptions by the order channel a coupon applies to. */
export function ChannelUsage({ list }: { list: Offer[] }) {
  const by = new Map<keyof typeof CHANNEL, number>();
  for (const o of list) by.set(channelOf(o), (by.get(channelOf(o)) ?? 0) + o.usage_count);
  const rows = [...by].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const biggest = rows[0]?.[1] ?? 1;
  return (
    <Panel title="Most Used Channels" subtitle="By redemptions (usage)">
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-600">No redemptions yet.</p>
      ) : (
        <ul className="space-y-space-3">
          {rows.slice(0, 4).map(([k, v]) => (
            <li key={k}>
              <div className="mb-1 flex items-center justify-between gap-space-2 text-[13px]">
                <span className="flex items-center gap-space-2 font-medium text-ink-900">
                  <span className="text-brand-700">{CHANNEL[k].icon}</span>
                  {CHANNEL[k].label}
                </span>
                <span className="text-ink-900">
                  {nf(v)}{" "}
                  <span className="text-ink-600">· {Math.round((1000 * v) / total) / 10}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-ink-50">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{ width: `${(100 * v) / biggest}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** What happened to offers lately, from their validity dates. */
export function OfferActivity({
  list,
  all,
  onToggle,
}: {
  list: Offer[];
  all: boolean;
  onToggle: () => void;
}) {
  const events = list
    .flatMap((o) => {
      const s = stageOf(o);
      if (s === "expired") return [{ at: o.valid_to, text: `${o.name} expired` }];
      if (s === "scheduled") return [{ at: o.valid_from, text: `${o.name} is scheduled to start` }];
      if (s === "active") return [{ at: o.valid_from, text: `${o.name} went live` }];
      return [];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, all ? 50 : 5);
  return (
    <Panel
      title="Recent Discount Activity"
      icon={<HugeiconsIcon icon={FlashIcon} size={18} />}
      action={{ label: all ? "Show less" : "View all", onClick: onToggle }}
    >
      {events.length === 0 ? (
        <p className="text-[13px] text-ink-600">
          Nothing yet. Discounts with start or end dates show up here.
        </p>
      ) : (
        <ul className="space-y-space-3">
          {events.map((e, i) => (
            <li key={i} className="flex items-start gap-space-3 text-[13px]">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
              <span className="min-w-0 flex-1 text-ink-900">{e.text}</span>
              <span className="shrink-0 text-[12px] text-ink-600">{formatDate(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
