"use client";

import { Fragment, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useWaitlist } from "@/hooks/useWaitlist";
import { portalFetch } from "@/lib/portalAuth";

type FreeTable = { id: string; name: string; capacity: number; status: string };

function waitLabel(createdAtIso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAtIso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  return `${minutes} min`;
}

/** The walk-in/waitlist queue -- "Assign" seats a REAL table (Live Operations' own Seat action,
 * tables.status -> occupied), never creates a booking. Party-size party (guest name, phone, size)
 * only -- no invented wait-time promises, no fake position-in-line beyond the real created_at order. */
export function WaitlistQueueCard({ ready, canWrite }: { ready: boolean; canWrite: boolean }) {
  const { entries, actingId, adding, addEntry, assignEntry, cancelEntry } = useWaitlist(ready);
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [assigningEntryId, setAssigningEntryId] = useState<number | null>(null);
  const [freeTables, setFreeTables] = useState<FreeTable[] | null>(null);

  useEffect(() => {
    if (assigningEntryId === null || freeTables !== null) return;
    portalFetch("/api/portal/tables").then((result) => {
      if (result.ok) {
        const tables = (result.data as { tables: FreeTable[] }).tables;
        setFreeTables(tables.filter((t) => t.status === "free"));
      }
    });
  }, [assigningEntryId, freeTables]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ok = await addEntry(guestName.trim(), Number(partySize) || 1, phone.trim());
    if (ok) {
      setGuestName(""); setPhone(""); setPartySize("2"); setShowForm(false);
    }
  }

  return (
    <Card className="p-space-4">
      <div className="mb-space-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">Walk-in / Waitlist Queue</h3>
          <p className="text-hint">{entries?.length ?? 0} waiting</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1 rounded-md bg-brand-600 px-space-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-space-3 grid grid-cols-1 gap-space-2 rounded-md border border-line bg-paper p-space-3 sm:grid-cols-4">
          <input
            required value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name"
            className="h-9 rounded-md border border-line bg-card px-space-2 text-[13px] sm:col-span-2"
          />
          <input
            type="number" min={1} required value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="Party size"
            className="h-9 rounded-md border border-line bg-card px-space-2 text-[13px]"
          />
          <input
            value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
            className="h-9 rounded-md border border-line bg-card px-space-2 text-[13px]"
          />
          <button type="submit" disabled={adding} className="h-9 rounded-md bg-brand-600 px-space-3 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:col-span-4">
            {adding ? "Adding…" : "Add to waitlist"}
          </button>
        </form>
      )}

      {!entries || entries.length === 0 ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">No one is waiting right now.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
              <th className="py-space-2 pr-space-2">#</th>
              <th className="py-space-2 pr-space-2">Guest Name</th>
              <th className="py-space-2 pr-space-2">Party Size</th>
              <th className="py-space-2 pr-space-2">Wait Time</th>
              <th className="py-space-2 pr-space-2">Status</th>
              <th className="py-space-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <Fragment key={e.id}>
                <tr className="border-b border-line last:border-0">
                  <td className="py-space-2 pr-space-2 tabular-nums text-ink-600">{i + 1}</td>
                  <td className="py-space-2 pr-space-2 font-semibold text-ink-900">
                    {e.guest_name}
                    {e.phone && <div className="text-[11.5px] font-normal text-ink-400">{e.phone}</div>}
                  </td>
                  <td className="py-space-2 pr-space-2 tabular-nums text-ink-600">{e.party_size}</td>
                  <td className="py-space-2 pr-space-2 text-ink-600">{waitLabel(e.created_at)}</td>
                  <td className="py-space-2 pr-space-2">
                    <span className="rounded-full bg-warning-tint px-space-2 py-0.5 text-[11px] font-semibold text-warning">Waiting</span>
                  </td>
                  <td className="py-space-2 text-right">
                    {canWrite && (
                      <div className="flex items-center justify-end gap-space-2">
                        <button
                          type="button"
                          disabled={actingId === e.id}
                          onClick={() => { setAssigningEntryId(assigningEntryId === e.id ? null : e.id); setFreeTables(null); }}
                          className="rounded-md bg-brand-600 px-space-3 py-1 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          disabled={actingId === e.id}
                          onClick={() => cancelEntry(e.id)}
                          aria-label="Remove from waitlist"
                          className="text-ink-400 hover:text-destructive disabled:opacity-50"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {assigningEntryId === e.id && (
                  <tr className={cn("border-b border-line last:border-0")}>
                    <td colSpan={6} className="bg-paper p-space-2">
                      <div className="flex flex-wrap items-center gap-space-2">
                        {freeTables === null ? (
                          <span className="text-[12px] text-ink-400">Loading tables…</span>
                        ) : freeTables.length === 0 ? (
                          <span className="text-[12px] text-ink-400">No free tables right now.</span>
                        ) : (
                          freeTables.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={async () => { await assignEntry(e.id, t.id); setAssigningEntryId(null); }}
                              className="rounded-md border border-line bg-card px-space-2 py-1 text-[12px] font-semibold text-ink-900 hover:border-brand-300 hover:bg-brand-50"
                            >
                              {t.name} ({t.capacity})
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
