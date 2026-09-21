"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, CircleCheck, Clock, MessageCircle, Send, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { FILTERS, useMessages } from "@/hooks/useMessages";
import { useGuestSummary, useHandoffOverview } from "@/hooks/useMessagesInsight";
import { cn } from "@/lib/cn";
import { formatOrderTime, isSameLocalDay, parseOrderTime } from "@/lib/foodOrders";
import { formatDate } from "@/lib/formatDate";
import { usePermission } from "@/lib/staffAuth";

/** "12m", "3h 20m", "2d" -- how long ago something was, compact enough for the "waiting longest" tile. */
function ageOf(iso: string): string {
  const minutes = Math.max(0, Math.floor((new Date().getTime() - parseOrderTime(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

function Avatar({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700", className)}>
      {(label.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

export default function PortalMessagesPage() {
  const { hospital, ready } = usePortalGuard();
  const {
    filter, setFilter, handoffs, error, dateFilter, setDateFilter,
    selectedId, setSelectedId, selected,
    replyText, setReplyText, sending, handleSend,
    thread, threadError,
    resolvingId, handleResolve,
    deletingId, handleDelete,
    selectedIds, toggleSelected, toggleSelectAll,
    bulkActing, bulkError, handleBulkResolve, handleBulkDelete,
  } = useMessages(ready);

  // Summary tiles and tab counts cover the whole queue, whatever tab or date is showing.
  const overview = useHandoffOverview(ready, handoffs?.length);
  const canSeeGuests = usePermission("patients", "view");
  const { guest, loading: guestLoading } = useGuestSummary(selected?.phone ?? null, canSeeGuests);
  const [pendingDelete, setPendingDelete] = useState<"one" | "bulk" | null>(null);

  const counts = useMemo(() => {
    const all = overview || [];
    const open = all.filter((h) => h.status === "open");
    const now = new Date();
    return {
      tabs: {
        open: open.length,
        resolved: all.filter((h) => h.status === "resolved").length,
        errored: all.filter((h) => h.reason === "system_error").length,
        all: all.length,
      } as Record<string, number>,
      openAsked: open.filter((h) => h.reason === "patient_requested").length,
      openErrors: open.filter((h) => h.reason === "system_error").length,
      resolvedToday: all.filter((h) => h.status === "resolved" && h.resolved_at && isSameLocalDay(parseOrderTime(h.resolved_at), now)).length,
      oldestOpen: open.length ? open.reduce((a, b) => (parseOrderTime(a.created_at) <= parseOrderTime(b.created_at) ? a : b)).created_at : null,
    };
  }, [overview]);

  const displayName = (h: { patient_name: string | null; phone: string }) => h.patient_name || h.phone;

  return (
    <PortalShell hospital={hospital} active="messages">
        <PageHeader
          title="Messages"
          icon={<MessageCircle size={22} />}
          description="Guests who asked for a host, and bot errors worth a follow-up. Replies you send here go out on WhatsApp."
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {overview && (
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile icon={<BellRing size={22} />} label="Open requests" value={counts.tabs.open} deltaPct={null} hint="Waiting for a reply" />
            <StatTile icon={<MessageCircle size={22} />} label="Asked for a host" value={counts.openAsked} deltaPct={null} hint="Open, from guests" />
            <StatTile icon={<TriangleAlert size={22} />} label="Bot errors" value={counts.openErrors} deltaPct={null} hint="Open, need a look" />
            <StatTile icon={<CircleCheck size={22} />} label="Resolved today" value={counts.resolvedToday} deltaPct={null} hint="Closed since midnight" />
            <Card className="flex items-start gap-space-3 p-space-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600"><Clock size={22} /></span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug font-semibold text-ink-600">Waiting longest</p>
                <p className="mt-1 text-[24px] leading-none font-bold text-ink-900">{counts.oldestOpen ? ageOf(counts.oldestOpen) : "—"}</p>
                <p className="text-hint mt-1">{counts.oldestOpen ? "Oldest open request" : "Nothing is waiting"}</p>
              </div>
            </Card>
          </div>
        )}

        <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
                filter === f.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              {f.label}
              {overview && <span className={cn("ml-space-1 tabular-nums", filter === f.key ? "text-white/80" : "text-ink-400")}>{counts.tabs[f.key]}</span>}
            </button>
          ))}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
            className="h-9 rounded-md border border-line bg-card px-space-3 text-[12.5px] text-ink-900"
          />
          {dateFilter && (
            <button type="button" onClick={() => setDateFilter("")} className="text-[12px] font-semibold text-ink-600 hover:text-ink-900">
              Clear date
            </button>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-space-3 flex flex-wrap items-center gap-space-3 rounded-md border border-line bg-card px-space-3 py-space-2">
            <span className="text-[12.5px] font-semibold text-ink-900">{selectedIds.size} selected</span>
            <Button variant="secondary" size="md" onClick={handleBulkResolve} disabled={bulkActing}>
              <Check size={14} /> Resolve selected
            </Button>
            <PermissionGate page="messages" action="delete">
              <Button variant="destructive" size="md" onClick={() => setPendingDelete("bulk")} disabled={bulkActing}>
                <Trash2 size={14} /> Delete selected
              </Button>
            </PermissionGate>
            <button type="button" onClick={() => toggleSelectAll(false)} className="ml-auto text-[12px] font-semibold text-ink-600 hover:text-ink-900">
              Clear selection
            </button>
          </div>
        )}
        {bulkError && <p className="mb-space-4 text-[13px] text-error">{bulkError}</p>}

        {!handoffs ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : handoffs.length === 0 ? (
          <Card className="p-space-6 text-center">
            <MessageCircle size={28} className="mx-auto mb-space-2 text-ink-300" />
            <p className="text-[13px] text-ink-400">
              {filter === "open" ? "No open requests — guests needing a host are queued here." : "Nothing here."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 items-start gap-space-4 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_300px]">
            <Card className="max-h-[calc(100vh-220px)] overflow-y-auto p-space-2">
              <div className="flex items-center gap-space-2 border-b border-line px-space-2 pb-space-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={handoffs.length > 0 && selectedIds.size === handoffs.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-brand-600"
                />
                <span className="text-[11px] font-semibold text-ink-600">Select all</span>
                <span className="ml-auto text-[11px] text-ink-400">{handoffs.length} {handoffs.length === 1 ? "conversation" : "conversations"}</span>
              </div>
              <ul className="space-y-space-1 pt-space-1">
                {handoffs.map((h) => {
                  const isSelected = h.id === selectedId;
                  return (
                    <li key={h.id} className="flex items-start gap-space-2">
                      <input
                        type="checkbox"
                        aria-label={`Select conversation with ${displayName(h)}`}
                        checked={selectedIds.has(h.id)}
                        onChange={(e) => toggleSelected(h.id, e.target.checked)}
                        className="mt-space-3 h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedId(h.id)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "flex w-full min-w-0 items-start gap-space-3 rounded-md px-space-3 py-space-3 text-left transition-colors duration-150",
                          isSelected ? "bg-brand-50" : "hover:bg-black/[0.03]",
                        )}
                      >
                        <Avatar label={displayName(h)} className="h-9 w-9 text-[13px]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex w-full items-center justify-between gap-space-2">
                            <span className="truncate text-[13.5px] font-semibold text-ink-900">{displayName(h)}</span>
                            <span className="shrink-0 text-[11px] text-ink-400">{formatOrderTime(h.created_at)}</span>
                          </div>
                          <p className="line-clamp-2 text-[12px] text-ink-600">
                            {h.message_text || (h.reason === "patient_requested" ? "Asked to talk to a host." : "System error.")}
                          </p>
                          <div className="mt-space-1 flex flex-wrap items-center gap-space-2">
                            <Badge tone={h.status === "open" ? "clay" : "success"}>{h.status === "open" ? "Open" : "Resolved"}</Badge>
                            {h.reason === "system_error" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-600">
                                <AlertTriangle size={12} /> Bot error
                              </span>
                            )}
                            {h.status === "resolved" && (
                              <span className="text-[10.5px] font-semibold text-ink-400">
                                {h.resolved_by === "auto" ? "Auto-resolved" : h.resolved_by ? "Resolved by staff" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="flex min-h-[420px] flex-col p-space-5">
              {!selected ? (
                <p className="m-auto text-[13px] text-ink-400">Select a conversation to view details and reply.</p>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="mb-space-4 flex flex-wrap items-start justify-between gap-space-3 border-b border-line pb-space-4">
                    <div className="flex items-center gap-space-3">
                      <Avatar label={displayName(selected)} className="h-11 w-11 text-[15px]" />
                      <div>
                        <p className="text-[15px] font-bold text-ink-900">{displayName(selected)}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-space-2">
                          {selected.patient_name && <span className="text-[12px] text-ink-600">{selected.phone}</span>}
                          <Badge tone={selected.reason === "system_error" ? "clay" : "brand"}>
                            {selected.reason === "system_error" ? "System error" : "Guest requested"}
                          </Badge>
                          <span className="text-[12px] text-ink-600">{formatOrderTime(selected.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-2">
                      {selected.status === "open" ? (
                        <Button variant="secondary" size="md" onClick={() => handleResolve(selected.id)} disabled={resolvingId === selected.id}>
                          <Check size={14} /> Mark resolved
                        </Button>
                      ) : (
                        <Badge tone="success">
                          {selected.resolved_by === "auto" ? "Auto-resolved" : "Resolved"}
                          {selected.resolved_at ? ` ${formatOrderTime(selected.resolved_at)}` : ""}
                        </Badge>
                      )}
                      <PermissionGate page="messages" action="delete">
                        <Button variant="destructive" size="md" onClick={() => setPendingDelete("one")} disabled={deletingId === selected.id}>
                          <Trash2 size={14} /> {deletingId === selected.id ? "Deleting…" : "Delete"}
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>

                  {threadError && <p className="mb-space-3 text-[12.5px] text-error">{threadError}</p>}

                  <div className="mb-space-4 max-h-[420px] min-h-[160px] flex-1 space-y-space-3 overflow-y-auto">
                    {thread === null ? (
                      <p className="py-space-4 text-center text-[13px] text-ink-400">Loading conversation…</p>
                    ) : thread.length === 0 ? (
                      <p className="py-space-4 text-center text-[13px] text-ink-400">No messages yet.</p>
                    ) : (
                      thread.map((m) => (
                        <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[75%] rounded-lg border px-space-3 py-space-2 text-[13.5px] text-ink-900",
                              m.direction === "outbound" ? "border-brand-100 bg-brand-50" : "border-line bg-card",
                            )}
                          >
                            <p className="whitespace-pre-wrap">{m.message_text}</p>
                            <p className="mt-space-1 text-[10.5px] text-ink-600">
                              {m.direction === "outbound" ? "You · " : ""}{formatOrderTime(m.created_at)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <PermissionGate page="messages" action="write">
                    <div className="mt-auto flex items-end gap-space-2 border-t border-line pt-space-4">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Reply on WhatsApp…"
                        rows={2}
                        className="h-20 flex-1 resize-none rounded-md border border-line bg-card px-space-3 py-space-2 text-[13.5px] text-ink-900 outline-none focus:border-brand-400"
                      />
                      <Button onClick={handleSend} disabled={sending || !replyText.trim()}>
                        <Send size={14} /> {sending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </PermissionGate>
                </div>
              )}
            </Card>

            {selected && (
              <Card className="p-space-4 lg:col-span-2 xl:col-span-1">
                <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Guest</h3>
                <div className="mb-space-3 flex items-center gap-space-3">
                  <Avatar label={displayName(selected)} className="h-11 w-11 text-[15px]" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink-900">{selected.patient_name || "Not registered yet"}</p>
                    <p className="text-[12.5px] text-ink-600">{selected.phone}</p>
                  </div>
                </div>
                {canSeeGuests && (
                  guestLoading ? (
                    <p className="text-[12.5px] text-ink-400">Loading…</p>
                  ) : guest ? (
                    <>
                      <dl className="mb-space-3 grid grid-cols-3 gap-space-2 text-center">
                        {[["Booked", guest.visit_count], ["Visited", guest.visited_count]].map(([label, value]) => (
                          <div key={label as string} className="rounded-md bg-paper px-space-2 py-space-2">
                            <dd className="text-[18px] font-bold tabular-nums text-ink-900">{value}</dd>
                            <dt className="text-[11px] text-ink-600">{label}</dt>
                          </div>
                        ))}
                        <div className="rounded-md bg-paper px-space-2 py-space-2">
                          <dd className="text-[12px] font-bold text-ink-900">{formatDate(guest.last_visit)}</dd>
                          <dt className="text-[11px] text-ink-600">Last visit</dt>
                        </div>
                      </dl>
                      <p className="mb-space-3 font-mono text-[11.5px] text-ink-400">{guest.patient_display_id}</p>
                      <Link
                        href={`/portal/patients/${guest.id}`}
                        className="inline-flex text-[13px] font-semibold text-brand-700 hover:underline"
                      >
                        Open guest →
                      </Link>
                    </>
                  ) : (
                    <p className="text-[12.5px] text-ink-600">No guest profile yet. One is created after their first booking.</p>
                  )
                )}
                <div className="mt-space-4 border-t border-line pt-space-3 text-[12.5px] text-ink-600">
                  <p className="mb-space-1 font-semibold text-ink-900">This request</p>
                  <p>{selected.reason === "system_error" ? "A bot error was flagged for follow-up." : "The guest asked to talk to a host."}</p>
                  <p className="mt-space-1">Received {formatOrderTime(selected.created_at)}.</p>
                  {selected.status === "resolved" && selected.resolved_at && (
                    <p className="mt-space-1">
                      {selected.resolved_by === "auto" ? "Auto-resolved" : "Resolved by staff"} {formatOrderTime(selected.resolved_at)}.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title={pendingDelete === "bulk" ? `Delete ${selectedIds.size} conversation${selectedIds.size === 1 ? "" : "s"}?` : "Delete this conversation?"}
          message="The conversation is removed from your list. This can't be undone from the portal."
          confirmLabel="Delete"
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete === "bulk") handleBulkDelete();
            else if (selected) handleDelete(selected.id);
            setPendingDelete(null);
          }}
        />
    </PortalShell>
  );
}
