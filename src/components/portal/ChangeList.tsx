"use client";

import { useState } from "react";
import { Modal } from "@/components/erp-ui/Modal";
import type { AuditChange, AuditItem } from "@/lib/audit";

/** The entry's one-line summary (at most three lines when long) and "View all changes". That calls `onMore` (to show the whole entry) or, without it, opens the changes on their own in a dialog. */
export function ChangeList({
  summary,
  changes,
  onMore,
}: {
  summary: string;
  changes: AuditChange[];
  onMore?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-md">
      <p className="line-clamp-3 text-[12.5px] leading-5 wrap-break-word text-ink-900">{summary}</p>
      {changes.length > 0 && (
        <button
          type="button"
          onClick={() => (onMore ? onMore() : setOpen(true))}
          className="mt-0.5 text-[12px] font-semibold text-brand-600 hover:underline"
        >
          View all changes
        </button>
      )}
      {!onMore && (
        <Modal
          open={open}
          title="Changes"
          description={summary}
          onClose={() => setOpen(false)}
          width="lg"
        >
          <ChangeDetails changes={changes} />
        </Modal>
      )}
    </div>
  );
}

/** Every change of an entry as its own block: the field, then what it was and what it became. Lists show as chips of names, split into added and removed. */
export function ChangeDetails({ changes }: { changes: AuditChange[] }) {
  if (changes.length === 0)
    return <p className="text-[13px] text-ink-400">No field changes recorded.</p>;
  return (
    <ul className="space-y-space-3">
      {changes.map((c, i) => (
        <li key={i} className="rounded-md border border-line p-space-3">
          <p className="mb-space-2 text-[13px] font-semibold text-ink-900">{c.label}</p>
          <ChangeBody change={c} />
        </li>
      ))}
    </ul>
  );
}

function ChangeBody({ change: c }: { change: AuditChange }) {
  if (c.kind === "touched")
    return <p className="text-[12.5px] text-ink-600">Changed (the values are not recorded).</p>;
  if (c.kind === "list") {
    if (!c.known) return <Chips label={`Items (${c.added.length})`} items={c.added} />;
    return (
      <div className="space-y-space-2">
        {c.added.length > 0 && <Chips label={`Added (${c.added.length})`} items={c.added} added />}
        {c.removed.length > 0 && (
          <Chips label={`Removed (${c.removed.length})`} items={c.removed} />
        )}
      </div>
    );
  }
  if (!c.known) return <Value label="Value" text={c.to} added />;
  return (
    <div className="grid gap-space-2 sm:grid-cols-2">
      <Value label="Before" text={c.from ?? "—"} />
      <Value label="After" text={c.to} added />
    </div>
  );
}

const heading = (added?: boolean) =>
  `mb-1 text-[11px] font-semibold tracking-wide uppercase ${added ? "text-success" : "text-ink-400"}`;

function Value({ label, text, added }: { label: string; text: string; added?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={heading(added)}>{label}</p>
      <p
        className={`rounded bg-black/3 px-2 py-1.5 text-[12.5px] wrap-break-word whitespace-pre-wrap ${added ? "text-ink-900" : "text-ink-600"}`}
      >
        {text}
      </p>
    </div>
  );
}

function Chips({ label, items, added }: { label: string; items: AuditItem[]; added?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={heading(added)}>{label}</p>
      <div className="flex max-h-48 flex-wrap gap-1 overflow-y-auto">
        {items.map((x, i) => (
          <span
            key={i}
            title={x.id ?? undefined}
            className={`rounded px-1.5 py-0.5 text-[12px] break-all ${added ? "bg-success-tint text-ink-900" : "bg-black/4 text-ink-600"}`}
          >
            {x.text}
          </span>
        ))}
      </div>
    </div>
  );
}
