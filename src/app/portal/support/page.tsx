"use client";

import { Check, Copy, LifeBuoy, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { PriorityBadge, StatusBadge } from "@/components/portal/support/Badges";
import { RaiseTicketModal } from "@/components/portal/support/RaiseTicketModal";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSupportTickets } from "@/hooks/useSupport";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";
import { STATUS_LABEL, STATUSES, type SupportStatus } from "@/lib/support";

/** Waits `ms` after the last change before the value is used (so a search isn't sent on every keystroke). */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function BusinessId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <p className="mb-space-4 flex flex-wrap items-center gap-x-space-2 gap-y-1 rounded-lg bg-brand-50 px-space-3 py-space-2 text-[13.5px] text-brand-700">
      Your Business ID is <span className="font-mono text-[14px] font-bold tracking-wide text-ink-900">{id}</span>
      <button
        type="button"
        aria-label="Copy Business ID"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="rounded p-1 text-ink-600 hover:bg-brand-100"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      — mention it if you call or email us, so we find your business straight away.
    </p>
  );
}

/** The restaurant's support tickets: raise one, see where each stands. */
export default function SupportPage() {
  const { restaurant, ready } = usePortalGuard();
  const canRaise = usePermission("support", "write");
  const [status, setStatus] = useState<"" | SupportStatus>("");
  const [query, setQuery] = useState("");
  const [raising, setRaising] = useState(false);
  const q = useDebounced(query, 300);
  const list = useSupportTickets(status, q);
  if (!ready) return null;

  const counts = list.data?.counts;
  const total = counts ? STATUSES.reduce((n, s) => n + counts[s], 0) : 0;
  const chip = (active: boolean) =>
    cn(
      "rounded-full px-space-3 py-1.5 text-[13px] font-semibold",
      active ? "bg-brand-600 text-white" : "border border-line text-ink-600 hover:bg-brand-50",
    );

  return (
    <PortalShell restaurant={restaurant} active="support">
      <PageHeader
        icon={<LifeBuoy size={20} />}
        title="Support"
        description="Raise a ticket to the DAAP team and follow it until it's solved."
        actions={
          canRaise && (
            <Button onClick={() => setRaising(true)}>
              <Plus size={16} /> Raise a ticket
            </Button>
          )
        }
      />
      {list.data?.business_id && <BusinessId id={list.data.business_id} />}
      {list.error && <p className="mb-space-3 text-[13px] font-medium text-error">{list.error.message}</p>}

      <Card className="p-space-4">
        <label className="flex h-11 items-center gap-space-2 rounded-md border border-line bg-card px-space-3 text-ink-400 focus-within:border-brand-400">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject or ticket number…"
            className="w-full bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-400"
          />
        </label>
        <div className="mt-space-3 flex flex-wrap gap-space-2">
          <button onClick={() => setStatus("")} className={chip(status === "")}>
            All ({total})
          </button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={chip(status === s)}>
              {STATUS_LABEL[s]} ({counts?.[s] ?? 0})
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-space-4 p-space-4">
        {!list.data ? (
          <ListSkeleton rows={4} />
        ) : list.data.items.length === 0 ? (
          <p className="py-space-4 text-center text-[13.5px] text-ink-400">
            {query || status ? "No tickets match." : "No tickets yet. If something isn't working, raise one and we'll help."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wide text-ink-400">
                  <th className="py-space-2 pr-space-3">Ticket</th>
                  <th className="py-space-2 pr-space-3">Subject</th>
                  <th className="py-space-2 pr-space-3">Category</th>
                  <th className="py-space-2 pr-space-3">Priority</th>
                  <th className="py-space-2 pr-space-3">Status</th>
                  <th className="py-space-2 pr-space-3 text-right">Replies</th>
                  <th className="py-space-2">Last update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.items.map((t) => (
                  <tr key={t.id} className="hover:bg-black/[0.02]">
                    <td className="py-space-2 pr-space-3 font-semibold">
                      <Link href={`/portal/support/${t.id}`} className="text-brand-700 hover:underline">
                        {t.ticket_number}
                      </Link>
                    </td>
                    <td className="max-w-[280px] truncate py-space-2 pr-space-3 text-ink-900">{t.subject}</td>
                    <td className="py-space-2 pr-space-3 text-ink-600">{t.category_name ?? "—"}</td>
                    <td className="py-space-2 pr-space-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="py-space-2 pr-space-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-space-2 pr-space-3 text-right tabular-nums">{t.message_count ?? 0}</td>
                    <td className="py-space-2 text-ink-600">{formatDateTime(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {raising && <RaiseTicketModal onClose={() => setRaising(false)} />}
    </PortalShell>
  );
}
