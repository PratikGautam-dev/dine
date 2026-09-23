"use client";

import { useState } from "react";
import { Plus, StickyNote, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useChefNotes } from "@/hooks/useChefNotes";

function minutesAgoLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/** A real, shared notes board for kitchen staff -- each note attributed to whoever actually
 * posted it (the logged-in staff member's own name), not an invented persona. */
export function ChefNotesCard({ ready, canWrite }: { ready: boolean; canWrite: boolean }) {
  const { notes, posting, addNote, deleteNote } = useChefNotes(ready);
  const [draft, setDraft] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (await addNote(text)) setDraft("");
  }

  return (
    <Card className="p-space-4">
      <div className="mb-space-3 flex items-center gap-space-2">
        <StickyNote size={16} className="text-brand-600" />
        <h3 className="text-[15px] font-bold text-ink-900">Chef Notes</h3>
      </div>

      {canWrite && (
        <form onSubmit={handleAdd} className="mb-space-3 flex gap-space-2">
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note for the kitchen…"
            className="h-9 flex-1 rounded-md border border-line bg-card px-space-2 text-[13px]"
          />
          <button type="submit" disabled={posting || !draft.trim()} className="flex items-center gap-1 rounded-md bg-brand-600 px-space-3 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </form>
      )}

      {!notes || notes.length === 0 ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">No notes yet.</p>
      ) : (
        <div className="max-h-[280px] space-y-space-2 overflow-y-auto">
          {notes.map((n) => (
            <div key={n.id} className="group rounded-md bg-paper p-space-2 text-[12.5px]">
              <div className="flex items-start justify-between gap-space-2">
                <p className="text-ink-900">{n.text}</p>
                {canWrite && (
                  <button type="button" onClick={() => deleteNote(n.id)} aria-label="Remove note" className="shrink-0 text-ink-300 opacity-0 hover:text-destructive group-hover:opacity-100">
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-400">{minutesAgoLabel(n.created_at)} · {n.created_by_name}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
