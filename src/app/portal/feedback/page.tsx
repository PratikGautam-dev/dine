"use client";

import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Crown,
  Mail,
  MapPin,
  MessageSquareText,
  Search,
  Star,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SectionDonut } from "@/components/portal/SectionDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { formatDate, formatShortDateTime } from "@/lib/formatDate";
import { useBranchFilter } from "@/lib/branchContext";
import { cn } from "@/lib/cn";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";
import { useFeedback, type FeedbackEntry, type FeedbackSummary } from "@/hooks/useFeedback";
import { parseOrderTime } from "@/lib/foodOrders";
import { FEEDBACK_PERIODS, inRange, usePagePeriod } from "@/lib/globalFilter";
import type { CustomerDetail } from "@/hooks/useCustomers";

const AVATAR_TONES = [
  "bg-brand-50 text-brand-700",
  "bg-info-tint text-info",
  "bg-success-tint text-success",
  "bg-warning-tint text-warning",
  "bg-accent-violet-tint text-accent-violet",
  "bg-clay-100 text-clay-700",
];
function avatarTone(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= rating ? "fill-warning text-warning" : "text-ink-300"}
        />
      ))}
    </span>
  );
}

// Real, derived straight from the 1-5 rating -- no separate sentiment-analysis system exists.
function sentimentOf(rating: number): "Positive" | "Neutral" | "Negative" {
  if (rating >= 4) return "Positive";
  if (rating === 3) return "Neutral";
  return "Negative";
}
const SENTIMENT_TONE: Record<string, string> = {
  Positive: "bg-success-tint text-success",
  Neutral: "bg-warning-tint text-warning",
  Negative: "bg-error/10 text-error",
};

// Feedback by Source: this app only ever collects feedback over WhatsApp today (no Swiggy/Zomato
// integration -- deliberately dropped). Dine-in/Takeaway/Delivery is a decorative, client-side-only
// illustrative split over the real total (not stored) until feedback is actually linked to which
// kind of visit/order prompted it -- same treatment as the Reports page's channel breakdown.
const SOURCE_SPLIT_RATIOS = [
  { label: "WhatsApp", pct: 0.42 },
  { label: "Dine-in", pct: 0.28 },
  { label: "Takeaway", pct: 0.18 },
  { label: "Delivery", pct: 0.12 },
];
// Top "complaint" categories: comments are free text with no real categorization system --
// fully decorative, anchored only to the real count of low (1-2 star) ratings.
const COMPLAINT_CATEGORY_RATIOS = [
  { label: "Food Quality", pct: 0.32 },
  { label: "Wait Time", pct: 0.24 },
  { label: "Service", pct: 0.18 },
  { label: "Order Accuracy", pct: 0.15 },
  { label: "Ambience", pct: 0.11 },
];

export default function PortalFeedbackPage() {
  const { restaurant, ready } = usePortalGuard();
  const {
    summary: serverSummary,
    entries: allEntries,
    error,
  } = useFeedback(ready, useBranchFilter().selectedBranchId);
  // the period comes from the header's global filter
  const { period, range } = usePagePeriod(FEEDBACK_PERIODS);
  const entries = useMemo(
    () => allEntries?.filter((e) => inRange(parseOrderTime(e.created_at), range)) ?? null,
    [allEntries, range],
  );
  // "All time" is the server's own summary (it counts every rating); a narrower period is worked out from the
  // ratings in range. The list the server sends is its 200 most recent, so a very old range may show fewer.
  const summary = useMemo<FeedbackSummary | null>(() => {
    if (!serverSummary || !entries) return null;
    if (period === "all") return serverSummary;
    const breakdown: Record<string, number> = {};
    let sum = 0;
    for (const e of entries) {
      breakdown[String(e.rating)] = (breakdown[String(e.rating)] ?? 0) + 1;
      sum += e.rating;
    }
    return {
      total: entries.length,
      average_rating: entries.length ? Math.round((sum / entries.length) * 10) / 10 : null,
      breakdown,
    };
  }, [serverSummary, entries, period]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [guest, setGuest] = useState<CustomerDetail | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const stats = useMemo(() => {
    const all = entries ?? [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const newToday = all.filter((e) => e.created_at.slice(0, 10) === todayStr).length;
    const needsAttention = all.filter((e) => e.rating <= 2).length;
    const promoters = all.filter((e) => e.rating === 5).length;
    const detractors = all.filter((e) => e.rating <= 2).length;
    const nps = all.length > 0 ? Math.round(((promoters - detractors) / all.length) * 100) : null;
    const positive = all.filter((e) => e.rating >= 4).length;
    const positiveRate = all.length > 0 ? Math.round((positive / all.length) * 100) : null;
    return { newToday, needsAttention, nps, positiveRate };
  }, [entries]);

  const sourceSplit = useMemo(() => {
    if (!summary) return [];
    return SOURCE_SPLIT_RATIOS.map((r) => ({
      department_name: r.label,
      count: Math.round(summary.total * r.pct),
    })).filter((s) => s.count > 0);
  }, [summary]);

  const complaintCategories = useMemo(() => {
    if (!stats.needsAttention) return [];
    return COMPLAINT_CATEGORY_RATIOS.map((r) => ({
      label: r.label,
      count: Math.max(1, Math.round(stats.needsAttention * r.pct)),
    }));
  }, [stats.needsAttention]);

  const sentimentTrend = useMemo(() => {
    const all = entries ?? [];
    const byDay = new Map<string, { positive: number; neutral: number; negative: number }>();
    for (const e of all) {
      const day = e.created_at.slice(0, 10);
      const bucket = byDay.get(day) ?? { positive: 0, neutral: 0, negative: 0 };
      const s = sentimentOf(e.rating);
      if (s === "Positive") bucket.positive += 1;
      else if (s === "Neutral") bucket.neutral += 1;
      else bucket.negative += 1;
      byDay.set(day, bucket);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, v]) => ({ label: formatDate(day), ...v }));
  }, [entries]);

  const sentimentTotals = sentimentTrend.reduce(
    (totals, day) => ({
      positive: totals.positive + day.positive,
      neutral: totals.neutral + day.neutral,
      negative: totals.negative + day.negative,
    }),
    { positive: 0, neutral: 0, negative: 0 },
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries ?? [];
    return (entries ?? []).filter((e) =>
      [e.patient_name ?? "", e.phone, e.comment ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  async function openEntry(entry: FeedbackEntry) {
    setSelected(entry);
    setGuest(null);
    setNoteDraft("");
    if (!entry.patient_id) return;
    setGuestLoading(true);
    const result = await portalFetch(`/api/portal/customers/id/${entry.patient_id}`);
    setGuestLoading(false);
    if (result.ok) setGuest((result.data as { patient: CustomerDetail }).patient);
  }

  async function saveNote() {
    if (!guest || !noteDraft.trim()) return;
    setSavingNote(true);
    const result = await portalFetch(`/api/portal/customers/${guest.id}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: noteDraft.trim() }),
    });
    setSavingNote(false);
    if (!result.ok) {
      toast.error("Couldn't save note", result.unauthorized ? "Session expired" : result.error);
      return;
    }
    setGuest((result.data as { patient: CustomerDetail }).patient);
    setNoteDraft("");
    toast.success("Note saved");
  }

  return (
    <PortalShell restaurant={restaurant} active="feedback">
      <PageHeader
        title="Feedback"
        icon={<MessageSquareText size={22} />}
        description="Guest ratings collected on WhatsApp after their visit."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {
        <div className="mb-space-4 grid grid-cols-2 gap-space-3 lg:grid-cols-5">
          <StatTile
            icon={<Star size={22} />}
            label="Average rating"
            value={summary ? (summary.average_rating ?? 0) : "—"}
            deltaPct={null}
            hint={summary?.average_rating === null ? "No ratings yet" : "Out of 5"}
            tone="warning"
            filled
          />
          <StatTile
            icon={<MessageSquareText size={22} />}
            label="New reviews today"
            value={summary ? stats.newToday : "—"}
            deltaPct={null}
            hint="Since midnight"
            tone="info"
            filled
          />
          <StatTile
            icon={<TriangleAlert size={22} />}
            label="Needs attention"
            value={summary ? stats.needsAttention : "—"}
            deltaPct={null}
            hint="1-2 star ratings"
            tone="clay"
            filled
            upIsGood={false}
          />
          <StatTile
            icon={<ThumbsUp size={22} />}
            label="Positive rate"
            value={summary ? (stats.positiveRate ?? 0) : "—"}
            deltaPct={null}
            hint="4-5 star ratings"
            tone="brand"
            filled
          />
          <StatTile
            icon={<TrendingUp size={22} />}
            label="NPS score"
            value={summary ? (stats.nps ?? 0) : "—"}
            deltaPct={null}
            hint={summary && stats.nps === null ? "No ratings yet" : "5★ minus 1-2★, of total"}
            tone="violet"
            filled
          />
        </div>
      }

      <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
        <Card className="p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Rating Breakdown</h3>
          {!summary || summary.total === 0 ? (
            <p className="py-space-4 text-center text-[13px] text-ink-400">No ratings yet.</p>
          ) : (
            <>
              <div className="mb-space-3 flex items-center gap-space-2">
                <span className="text-[28px] leading-none font-bold text-ink-900">
                  {summary.average_rating}
                </span>
                <div>
                  <Stars rating={Math.round(summary.average_rating ?? 0)} />
                  <p className="text-[11.5px] text-ink-600">
                    Based on {summary.total} rating{summary.total === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="space-y-space-2">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = summary.breakdown[String(n)] ?? 0;
                  const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                  return (
                    <div key={n} className="flex items-center gap-space-2 text-[12px]">
                      <span className="w-3 shrink-0 text-ink-600">{n}</span>
                      <Star size={11} className="shrink-0 fill-warning text-warning" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/4">
                        <div
                          className="h-full rounded-full bg-warning"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-ink-600 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <SectionDonut
          data={sourceSplit}
          title="Feedback by Source"
          subtitle="Illustrative -- not linked to a visit type yet"
          unit="reviews"
          emptyText="No feedback yet."
        />

        <Card className="flex h-full flex-col p-space-4">
          <div className="mb-space-3 flex items-start justify-between gap-space-3">
            <div>
              <h3 className="text-[15px] font-bold text-ink-900">Sentiment Trend</h3>
              <p className="mt-0.5 text-[12px] text-ink-600">Daily review counts</p>
            </div>
            <span className="shrink-0 rounded-full bg-paper px-space-2 py-0.5 text-[11px] font-medium text-ink-600">
              By day
            </span>
          </div>
          <div className="mb-space-2 grid grid-cols-3 gap-space-2">
            {(
              [
                ["Positive", sentimentTotals.positive, "bg-success", "bg-success-tint"],
                ["Neutral", sentimentTotals.neutral, "bg-warning", "bg-warning-tint"],
                ["Negative", sentimentTotals.negative, "bg-error", "bg-error-tint"],
              ] as const
            ).map(([label, count, dot, tint]) => (
              <div
                key={label}
                className={`flex min-w-0 items-center gap-space-2 rounded-md ${tint} px-space-2 py-space-1.5`}
              >
                <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                <span className="truncate text-[11px] text-ink-700">{label}</span>
                <span className="ml-auto text-[12px] font-bold tabular-nums text-ink-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
          {sentimentTrend.length === 0 ? (
            <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-md bg-paper text-[13px] text-ink-400">
              Not enough data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={sentimentTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#ebe0d6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#ebe0d6" }}
                  tick={{ fontSize: 10, fill: "#6b5f56" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#6b5f56" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--line)" }}
                />
                <Line
                  type="monotone"
                  dataKey="positive"
                  name="Positive"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="neutral"
                  name="Neutral"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="negative"
                  name="Negative"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-space-4 lg:col-span-3">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">
            Top Complaint Categories
          </h3>
          {complaintCategories.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-[13px] text-ink-400">
              No low ratings yet.
            </div>
          ) : (
            <div className="space-y-space-3">
              {complaintCategories.map((c) => {
                const max = Math.max(...complaintCategories.map((x) => x.count));
                return (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-ink-900">{c.label}</span>
                      <span className="text-ink-600">{c.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/4">
                      <div
                        className="h-full rounded-full bg-clay-500"
                        style={{ width: `${(c.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-hint pt-space-1">
                Illustrative -- comments aren&apos;t auto-categorized yet.
              </p>
            </div>
          )}
        </Card>
      </div>

      <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">
        Customer Reviews &amp; Feedback{summary ? ` (${summary.total})` : ""}
      </h3>
      <Card className="mb-space-3 flex flex-wrap items-center gap-space-3 p-space-3">
        <span className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by customer or review…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </span>
      </Card>

      <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Card className="p-space-2">
            {!entries ? (
              <ListSkeleton rows={5} />
            ) : filtered.length === 0 ? (
              <p className="p-space-4 text-center text-[13px] text-ink-400">
                {search
                  ? "No feedback matches that search."
                  : "No feedback yet — it appears here once a guest rates you from the WhatsApp menu."}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((e) => {
                  const label = e.patient_name || e.phone;
                  const sentiment = sentimentOf(e.rating);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => openEntry(e)}
                        className={cn(
                          "flex w-full items-start gap-space-3 px-space-2 py-space-3 text-left hover:bg-paper",
                          selected?.id === e.id && "bg-brand-50/60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                            avatarTone(label),
                          )}
                        >
                          {(label.trim()[0] || "?").toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-space-2">
                            <span className="text-[13.5px] font-semibold text-ink-900">
                              {e.patient_name || "Guest"}
                            </span>
                            <Stars rating={e.rating} />
                            <span
                              className={cn(
                                "rounded-full px-space-2 py-0.5 text-[10.5px] font-bold",
                                SENTIMENT_TONE[sentiment],
                              )}
                            >
                              {sentiment}
                            </span>
                          </div>
                          {e.comment && (
                            <p className="mt-0.5 truncate text-[13px] text-ink-600">{e.comment}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-ink-400">
                          {formatShortDateTime(e.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          {!selected ? (
            <Card className="flex h-full min-h-[240px] flex-col items-center justify-center p-space-4 text-center">
              <MessageSquareText size={26} className="mb-space-2 text-ink-300" />
              <p className="text-[13px] text-ink-400">Select a review to see its details.</p>
            </Card>
          ) : (
            <Card className="p-space-4">
              <div className="mb-space-4 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-ink-900">Feedback Details</h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 text-ink-400 hover:bg-black/4 hover:text-ink-900"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-space-3 flex items-center gap-space-3">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold",
                    avatarTone(selected.patient_name || selected.phone),
                  )}
                >
                  {(selected.patient_name || selected.phone).trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-space-1">
                    <p className="truncate text-[15px] font-bold text-ink-900">
                      {selected.patient_name || "Guest"}
                    </p>
                    {guest?.loyalty_tier === "Platinum" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-tint px-space-2 py-0.5 text-[10.5px] font-bold text-warning">
                        <Crown size={11} /> Platinum
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-[12px] text-ink-600">
                    <WhatsAppIcon size={12} /> WhatsApp
                  </p>
                </div>
              </div>

              <div className="mb-space-3 space-y-space-1.5 text-[13px]">
                <p className="flex items-center gap-space-2 text-ink-700">
                  <WhatsAppIcon size={13} /> {selected.phone}
                </p>
                {guest?.email && (
                  <p className="flex items-center gap-space-2 text-ink-700">
                    <Mail size={13} className="text-ink-400" /> {guest.email}
                  </p>
                )}
                {guest?.address && (
                  <p className="flex items-center gap-space-2 text-ink-700">
                    <MapPin size={13} className="text-ink-400" /> {guest.address}
                  </p>
                )}
              </div>

              {guest &&
                (guest.loyalty_tier || guest.dietary_preference || guest.visit_count >= 2) && (
                  <div className="mb-space-3 flex flex-wrap gap-space-1">
                    {guest.loyalty_tier && (
                      <span className="rounded-full bg-warning-tint px-space-2 py-0.5 text-[11px] font-bold text-warning">
                        {guest.loyalty_tier}
                      </span>
                    )}
                    {guest.visit_count >= 2 && (
                      <span className="rounded-full bg-success-tint px-space-2 py-0.5 text-[11px] font-bold text-success">
                        Regular Customer
                      </span>
                    )}
                    {guest.dietary_preference && (
                      <span className="rounded-full bg-info-tint px-space-2 py-0.5 text-[11px] font-bold text-info">
                        {guest.dietary_preference}
                      </span>
                    )}
                  </div>
                )}

              <div className="mb-space-4 rounded-lg bg-paper p-space-3">
                <p className="mb-space-1 text-[11px] font-semibold text-ink-600">CUSTOMER REVIEW</p>
                <Stars rating={selected.rating} size={14} />
                {selected.comment && (
                  <p className="mt-space-2 text-[13px] text-ink-700">
                    &ldquo;{selected.comment}&rdquo;
                  </p>
                )}
              </div>

              <div className="mb-space-4 grid grid-cols-2 gap-space-2 text-[12.5px]">
                <div className="rounded-md border border-line px-space-2 py-space-2">
                  <p className="text-[11px] text-ink-600">Source</p>
                  <p className="flex items-center gap-1 font-semibold text-ink-900">
                    <WhatsAppIcon size={12} /> WhatsApp
                  </p>
                </div>
                <div className="rounded-md border border-line px-space-2 py-space-2">
                  <p className="text-[11px] text-ink-600">Sentiment</p>
                  <p className="font-semibold text-ink-900">{sentimentOf(selected.rating)}</p>
                </div>
              </div>

              {guest ? (
                <div className="mb-space-4">
                  <div className="mb-space-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-ink-600">INTERNAL NOTES</p>
                    <a
                      href={`/portal/customers/${guest.public_id}`}
                      className="text-[12px] font-semibold text-brand-700 hover:underline"
                    >
                      View guest profile
                    </a>
                  </div>
                  {guest.notes && (
                    <p className="mb-space-2 rounded-md bg-paper p-space-2 text-[12.5px] text-ink-700">
                      {guest.notes}
                    </p>
                  )}
                  <div className="flex gap-space-2">
                    <Input
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add a note…"
                      className="text-[12.5px]"
                    />
                    <button
                      type="button"
                      onClick={saveNote}
                      disabled={savingNote || !noteDraft.trim()}
                      className="shrink-0 rounded-md border border-line bg-card px-space-3 text-[12.5px] font-semibold text-ink-700 hover:bg-paper disabled:opacity-50"
                    >
                      {savingNote ? "…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : guestLoading ? (
                <p className="mb-space-4 text-[12.5px] text-ink-400">Loading guest…</p>
              ) : (
                <p className="mb-space-4 text-[12.5px] text-ink-400">
                  No linked guest profile for this review.
                </p>
              )}

              <a
                href={`https://wa.me/${selected.phone.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-space-2 rounded-md bg-success px-space-3 py-space-2 text-[13px] font-semibold text-white hover:opacity-90"
              >
                <Users size={14} /> Message on WhatsApp
              </a>
            </Card>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
