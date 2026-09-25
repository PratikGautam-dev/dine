"use client";

import { useMemo } from "react";
import { MessageSquareText, Star, ThumbsUp, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/cn";
import { useFeedback } from "@/hooks/useFeedback";

const AVATAR_TONES = [
  "bg-brand-50 text-brand-700", "bg-info-tint text-info", "bg-success-tint text-success",
  "bg-warning-tint text-warning", "bg-accent-violet-tint text-accent-violet", "bg-clay-100 text-clay-700",
];
function avatarTone(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? "fill-warning text-warning" : "text-ink-300"} />
      ))}
    </span>
  );
}

export default function PortalFeedbackPage() {
  const { hospital, ready } = usePortalGuard();
  const { summary, entries, error } = useFeedback(ready);

  const stats = useMemo(() => {
    const all = entries ?? [];
    const now = new Date().getTime();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = all.filter((e) => new Date(e.created_at).getTime() >= weekAgo).length;
    const positive = all.filter((e) => e.rating >= 4).length;
    const positiveRate = all.length > 0 ? Math.round((positive / all.length) * 100) : null;
    return { thisWeek, positiveRate };
  }, [entries]);

  return (
    <PortalShell hospital={hospital} active="feedback">
        <PageHeader
          title="Feedback"
          icon={<MessageSquareText size={22} />}
          description="Guest ratings collected on WhatsApp after their visit."
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {summary && (
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={<Star size={22} />} label="Average rating" value={summary.average_rating ?? 0} deltaPct={null}
              hint={summary.average_rating === null ? "No ratings yet" : "Out of 5"} tone="warning" filled
            />
            <StatTile icon={<Users size={22} />} label="Total feedback" value={summary.total} deltaPct={null} hint="All time" tone="brand" filled />
            <StatTile icon={<MessageSquareText size={22} />} label="This week" value={stats.thisWeek} deltaPct={null} hint="New ratings" tone="info" filled />
            <StatTile
              icon={<ThumbsUp size={22} />} label="Positive rate" value={stats.positiveRate ?? 0} deltaPct={null}
              hint={stats.positiveRate === null ? "No ratings yet" : "4-5 star ratings"} tone="violet" filled
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Rating Breakdown</h3>
            {!summary || summary.total === 0 ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">No ratings yet.</p>
            ) : (
              <>
                <div className="mb-space-3 flex items-center gap-space-2">
                  <span className="text-[28px] leading-none font-bold text-ink-900">{summary.average_rating}</span>
                  <div>
                    <Stars rating={Math.round(summary.average_rating ?? 0)} />
                    <p className="text-[11.5px] text-ink-600">Based on {summary.total} rating{summary.total === 1 ? "" : "s"}</p>
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
                          <div className="h-full rounded-full bg-warning" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 shrink-0 text-right text-ink-600 tabular-nums">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          <Card className="p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">
              Recent Feedback{summary ? ` (${summary.total})` : ""}
            </h3>
            {!entries ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="py-space-6 text-center text-[13px] text-ink-400">
                No feedback yet — it appears here once a guest rates you from the WhatsApp menu.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {entries.map((e) => {
                  const label = e.patient_name || e.phone;
                  return (
                    <li key={e.id} className="flex items-start gap-space-3 py-space-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(label))}>
                        {(label.trim()[0] || "?").toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-space-2">
                          <span className="text-[13.5px] font-semibold text-ink-900">{e.patient_name || "Guest"}</span>
                          <Stars rating={e.rating} />
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
                            <WhatsAppIcon size={11} /> WhatsApp
                          </span>
                        </div>
                        {e.comment && <p className="mt-0.5 text-[13px] text-ink-600">&ldquo;{e.comment}&rdquo;</p>}
                      </div>
                      <span className="shrink-0 text-[11.5px] text-ink-400">{formatDate(e.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
    </PortalShell>
  );
}
