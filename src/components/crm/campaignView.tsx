"use client";

import {
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  ChartIncreaseIcon,
  Globe02Icon,
  Mail01Icon,
  Megaphone01Icon,
  Message01Icon,
  PlayCircleIcon,
  Store01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { StatCard } from "@/components/crm/membership/parts";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { Card } from "@/components/erp-ui/Card";
import { cn } from "@/lib/cn";
import type { Campaign, CampaignChannel } from "@/lib/erp/crm";
import { formatDateTime } from "@/lib/erp/erp";

/** Where a campaign is in its life: a draft (maybe with a future start date), going out or running now, or finished. */
export type Stage = "draft" | "scheduled" | "active" | "completed";

export function stageOf(k: Campaign, now = Date.now()): Stage {
  const starts = k.starts_at ? Date.parse(k.starts_at) : null;
  const ends = k.ends_at ? Date.parse(k.ends_at) : null;
  if (k.status === "draft")
    return starts && starts > now ? "scheduled" : "draft";
  if (k.status === "sending") return "active";
  return ends && ends >= now ? "active" : "completed"; // sent: running while its offer period lasts
}

export const STAGE_META: Record<Stage, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-ink-50 text-ink-700" },
  scheduled: { label: "Scheduled", className: "bg-info-tint text-info" },
  active: { label: "Active", className: "bg-success-tint text-success" },
  completed: { label: "Completed", className: "bg-ink-50 text-ink-700" },
};

export function StagePill({
  stage,
  sending,
}: {
  stage: Stage;
  sending?: boolean;
}) {
  const m = STAGE_META[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-space-2 py-0.5 text-[12px] font-semibold",
        m.className,
      )}
    >
      {sending ? "Sending…" : m.label}
    </span>
  );
}

const CHANNEL_ICON: Record<
  CampaignChannel,
  { label: string; icon: ReactNode }
> = {
  whatsapp: { label: "WhatsApp", icon: <WhatsAppIcon size={16} /> },
  email: {
    label: "Email",
    icon: <HugeiconsIcon icon={Mail01Icon} size={16} />,
  },
  sms: { label: "SMS", icon: <HugeiconsIcon icon={Message01Icon} size={16} /> },
  pos: { label: "POS", icon: <HugeiconsIcon icon={Store01Icon} size={16} /> },
  website: {
    label: "Website",
    icon: <HugeiconsIcon icon={Globe02Icon} size={16} />,
  },
};
export const channelsOf = (k: Campaign): CampaignChannel[] =>
  k.channels?.length ? k.channels : [k.channel];

export function ChannelIcons({ k }: { k: Campaign }) {
  return (
    <span className="flex items-center gap-space-2 text-brand-700">
      {channelsOf(k).map((c) => (
        <span
          key={c}
          title={CHANNEL_ICON[c].label}
          aria-label={CHANNEL_ICON[c].label}
        >
          {CHANNEL_ICON[c].icon}
        </span>
      ))}
    </span>
  );
}

const n = (v: number) => v.toLocaleString("en-IN");

/** The four counts above the list. */
export function CampaignKpis({ list }: { list: Campaign[] | undefined }) {
  const all = list ?? [];
  const stages = all.map((k) => stageOf(k));
  const delivered = all.reduce((sum, k) => sum + k.delivered_count, 0);
  return (
    <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
      <StatCard
        label="Total Campaigns"
        value={list ? n(all.length) : "—"}
        icon={<HugeiconsIcon icon={Megaphone01Icon} size={20} />}
      />
      <StatCard
        label="Active Campaigns"
        value={list ? n(stages.filter((s) => s === "active").length) : "—"}
        icon={<HugeiconsIcon icon={PlayCircleIcon} size={20} />}
      />
      <StatCard
        label="Scheduled Campaigns"
        value={list ? n(stages.filter((s) => s === "scheduled").length) : "—"}
        icon={<HugeiconsIcon icon={Calendar03Icon} size={20} />}
      />
      <StatCard
        label="Messages Delivered"
        value={list ? n(delivered) : "—"}
        hint="across all campaigns"
        icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  icon,
  highlight,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-space-3",
        // the Top Channel tile takes a whole row on a phone, so the channel's name has room
        highlight
          ? "col-span-2 border-brand-200 bg-brand-50 md:col-span-1"
          : "border-line bg-paper",
      )}
    >
      <p className="mb-space-2 flex items-center gap-space-2 text-[12.5px] font-semibold text-ink-700">
        <span className="shrink-0 text-brand-700">{icon}</span>
        <span className="min-w-0 break-words md:truncate">{label}</span>
      </p>
      <p className="flex min-w-0 items-center gap-space-2 text-[24px] leading-tight font-bold text-ink-900">
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] text-ink-600">
        {hint ?? "\u00a0"}
      </p>
    </div>
  );
}

/** What the sent campaigns reached, from the delivery reports (no sales are attributed to campaigns). */
export function CampaignPerformance({ list }: { list: Campaign[] }) {
  const sent = list.filter((k) => k.status !== "draft");
  const reached = sent.reduce((s, k) => s + k.recipient_count, 0);
  const delivered = sent.reduce((s, k) => s + k.delivered_count, 0);
  const waDelivered = sent.reduce((s, k) => s + k.delivered_n, 0);
  const waRead = sent.reduce((s, k) => s + k.read_n, 0);
  const failed = sent.reduce((s, k) => s + k.failed_n, 0);
  const byChannel = new Map<CampaignChannel, number>();
  for (const k of sent)
    byChannel.set(
      k.channel,
      (byChannel.get(k.channel) ?? 0) + k.delivered_count,
    );
  const top = [...byChannel].sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="grid grid-cols-2 gap-space-3 md:grid-cols-3 2xl:grid-cols-5">
      <Tile
        label="Audience Reached"
        value={n(reached)}
        hint="messages sent"
        icon={<HugeiconsIcon icon={Megaphone01Icon} size={18} />}
      />
      <Tile
        label="Delivery Rate"
        value={
          reached ? `${Math.round((1000 * delivered) / reached) / 10}%` : "—"
        }
        hint={`${n(delivered)} delivered`}
        icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />}
      />
      <Tile
        label="Read Rate"
        value={
          waDelivered
            ? `${Math.round((1000 * waRead) / waDelivered) / 10}%`
            : "—"
        }
        hint="WhatsApp"
        icon={<HugeiconsIcon icon={ChartIncreaseIcon} size={18} />}
      />
      <Tile
        label="Failed Messages"
        value={n(failed)}
        hint="WhatsApp"
        icon={<HugeiconsIcon icon={Message01Icon} size={18} />}
      />
      <Tile
        highlight
        label="Top Channel"
        value={
          top ? (
            <>
              <span className="shrink-0 text-brand-700">
                {CHANNEL_ICON[top[0]].icon}
              </span>
              <span className="min-w-0 truncate text-[18px]">
                {CHANNEL_ICON[top[0]].label}
              </span>
            </>
          ) : (
            "—"
          )
        }
        hint={top ? `${n(top[1])} delivered` : undefined}
        icon={<HugeiconsIcon icon={TrophyIcon} size={18} />}
      />
    </div>
  );
}

/** The latest things that happened to campaigns: created, and sent. */
export function RecentActivity({
  list,
  limit = 6,
}: {
  list: Campaign[];
  limit?: number;
}) {
  const events = list
    .flatMap((k) => [
      { at: k.created_at, text: `${k.name} was created as a draft` },
      ...(k.sent_at
        ? [
            {
              at: k.sent_at,
              text: `${k.name} was sent to ${n(k.recipient_count)} customers`,
            },
          ]
        : []),
    ])
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
  return events.length === 0 ? (
    <p className="text-[13px] text-ink-600">Nothing yet.</p>
  ) : (
    <ul className="space-y-space-3">
      {events.map((e, i) => (
        <li key={i} className="flex items-start gap-space-3 text-[13px]">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
          <span className="min-w-0 flex-1 text-ink-900">{e.text}</span>
          <span className="shrink-0 text-[12px] text-ink-600">
            {formatDateTime(e.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** A link-style button at the right of the title, e.g. "View all". */
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-space-4", className)}>
      <div className="flex items-start justify-between gap-space-3">
        <h2 className="flex items-center gap-space-2 text-[16px] font-bold text-ink-900">
          {icon && <span className="text-brand-700">{icon}</span>}
          {title}
        </h2>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
          >
            {action.label}
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </button>
        )}
      </div>
      {subtitle ? (
        <p className="mb-space-3 text-[12.5px] text-ink-600">{subtitle}</p>
      ) : (
        <div className="mb-space-3" />
      )}
      {children}
    </Card>
  );
}

/** Messages delivered per channel, for the Analytics tab. */
export function ChannelBreakdown({ list }: { list: Campaign[] }) {
  const rows = new Map<
    CampaignChannel,
    { campaigns: number; delivered: number; sent: number }
  >();
  for (const k of list.filter((x) => x.status !== "draft"))
    for (const c of channelsOf(k)) {
      const r = rows.get(c) ?? { campaigns: 0, delivered: 0, sent: 0 };
      r.campaigns += 1;
      if (c === k.channel) {
        r.delivered += k.delivered_count;
        r.sent += k.recipient_count;
      }
      rows.set(c, r);
    }
  const biggest = Math.max(1, ...[...rows.values()].map((r) => r.delivered));
  return rows.size === 0 ? (
    <p className="text-[13px] text-ink-600">
      Send a campaign to see how each channel does.
    </p>
  ) : (
    <ul className="space-y-space-3">
      {[...rows].map(([c, r]) => (
        <li key={c}>
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="flex items-center gap-space-2 font-medium text-ink-900">
              <span className="text-brand-700">{CHANNEL_ICON[c].icon}</span>
              {CHANNEL_ICON[c].label}
              <span className="font-normal text-ink-600">
                · {r.campaigns} campaigns
              </span>
            </span>
            <span className="text-ink-600">
              {n(r.delivered)} delivered of {n(r.sent)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-50">
            <div
              className="h-2 rounded-full bg-brand-600"
              style={{ width: `${(100 * r.delivered) / biggest}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
