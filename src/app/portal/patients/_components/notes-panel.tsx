"use client";

import { useState } from "react";
import { Check, RotateCcw, StickyNote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { CustomerHeader } from "./customer-header";
import type { CustomerNote } from "@/hooks/useCustomerNotes";
import type { PatientDetail } from "@/hooks/usePatients";

function dueBadge(followUpAt: string) {
  const due = new Date(followUpAt).getTime();
  const overdue = due < Date.now();
  return (
    <Badge tone={overdue ? "clay" : "warning"}>
      {overdue ? "Overdue" : "Due"} {formatDate(followUpAt)}
    </Badge>
  );
}

/** Customers page's Notes tab -- staff-written notes against one customer, optionally with a
 * follow-up date. A plain free-text note (no date) just never shows a due badge; the Follow-ups
 * tab lists every customer's open ones together. */
export function NotesPanel({
  profile,
  profileLoading,
  notes,
  notesLoading,
  saving,
  onAddNote,
  onSetNoteDone,
  onDeleteNote,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  notes: CustomerNote[] | null;
  notesLoading: boolean;
  saving: boolean;
  onAddNote: (body: string, followUpAt: string | null) => Promise<boolean>;
  onSetNoteDone: (noteId: number, done: boolean) => void;
  onDeleteNote: (noteId: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  if (profileLoading || !profile) {
    return (
      <Card className="min-h-100 p-space-4">
        <FormSkeleton fields={3} />
      </Card>
    );
  }

  async function handleAdd() {
    if (!draft.trim()) return;
    const ok = await onAddNote(draft.trim(), followUpAt || null);
    if (ok) {
      setDraft("");
      setFollowUpAt("");
    }
  }

  return (
    <Card className="min-h-100 p-space-4">
      <CustomerHeader profile={profile} />

      <PermissionGate page="patients" action="write">
        <div className="mb-space-4 border-b border-line pb-space-4">
          <Field label="Add a note" htmlFor="note-draft">
            <Textarea
              id="note-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Write a note about this guest…"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-space-2">
            <Field label="Follow-up on (optional)" htmlFor="note-follow-up" className="mb-0 flex-1">
              <Input
                id="note-follow-up"
                type="date"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
              />
            </Field>
            <Button size="md" onClick={handleAdd} disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      </PermissionGate>

      {notesLoading || !notes ? (
        <TableSkeleton rows={4} columns={1} />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-space-2 rounded-lg bg-paper py-space-8 text-center">
          <StickyNote size={22} className="text-ink-300" />
          <p className="text-[13px] font-semibold text-ink-700">No notes yet</p>
        </div>
      ) : (
        <ul className="space-y-space-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-lg border border-line p-space-3",
                n.done_at ? "bg-paper opacity-70" : "bg-card",
              )}
            >
              <p className="whitespace-pre-wrap text-[13px] text-ink-900">{n.body}</p>
              <div className="mt-space-2 flex flex-wrap items-center justify-between gap-space-2">
                <div className="flex flex-wrap items-center gap-space-2 text-[11.5px] text-ink-400">
                  <span>
                    {n.created_by ? `${n.created_by} · ` : ""}
                    {formatDateTime(n.created_at)}
                  </span>
                  {n.follow_up_at && !n.done_at && dueBadge(n.follow_up_at)}
                  {n.done_at && <Badge tone="neutral">Done {formatDate(n.done_at)}</Badge>}
                </div>
                <PermissionGate page="patients" action="write">
                  <div className="flex items-center gap-space-1">
                    <button
                      type="button"
                      onClick={() => onSetNoteDone(n.id, !n.done_at)}
                      aria-label={n.done_at ? "Reopen note" : "Mark done"}
                      className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
                    >
                      {n.done_at ? <RotateCcw size={14} /> : <Check size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(n.id)}
                      aria-label="Delete note"
                      className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </PermissionGate>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
