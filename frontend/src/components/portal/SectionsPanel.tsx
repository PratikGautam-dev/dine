"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import type { Section } from "@/hooks/useRestaurantTables";

type Props = {
  sections: Section[];
  canManage: boolean;
  busy: boolean;
  onAdd: (name: string) => Promise<string | null>;
  onRename: (id: string, name: string) => Promise<string | null>;
  onMove: (id: string, direction: "up" | "down") => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
};

/** Step 1 of setting up the floor: the restaurant's sections (Main Hall, Patio, ...), in the order guests see
 * them on WhatsApp. Tables are added to one of these in step 2. */
export function SectionsPanel({ sections, canManage, busy, onAdd, onRename, onMove, onDelete }: Props) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Promise<string | null>): Promise<boolean> {
    const message = await action;
    setError(message);
    return message === null;
  }

  return (
    <Card className="mb-space-5 p-space-5">
      <div className="mb-space-1 flex items-baseline gap-space-2">
        <span className="text-eyebrow">Step 1</span>
        <h2 className="text-[15px] font-bold text-ink-900">Sections</h2>
      </div>
      <p className="mb-space-4 text-[13px] text-ink-600">
        Areas of your restaurant, like Main Hall or Patio. Guests pick a section on WhatsApp in this order.
      </p>

      {sections.length === 0 ? (
        <p className="mb-space-4 text-[13px] text-ink-400">No sections yet. Add your first one below, then add tables to it.</p>
      ) : (
        <ul className="mb-space-4 divide-y divide-line rounded-md border border-line">
          {sections.map((section, index) => (
            <li key={section.id} className="flex items-center gap-space-3 px-space-3 py-space-2">
              {editingId === section.id ? (
                <form
                  className="flex flex-1 items-center gap-space-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(onRename(section.id, editName))) setEditingId(null);
                  }}
                >
                  <Input
                    autoFocus value={editName} maxLength={60} aria-label={`Rename ${section.name}`}
                    className="h-9!" onChange={(e) => setEditName(e.target.value)}
                  />
                  <button type="submit" disabled={busy} aria-label="Save name" className="text-ink-600 hover:text-ink-900">
                    <Check size={16} />
                  </button>
                  <button
                    type="button" aria-label="Cancel rename" className="text-ink-600 hover:text-ink-900"
                    onClick={() => { setEditingId(null); setError(null); }}
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[14px] font-medium text-ink-900">{section.name}</span>
                  <span className="text-[12px] text-ink-400">
                    {section.table_count} {section.table_count === 1 ? "table" : "tables"}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-space-1 text-ink-600">
                      <button
                        type="button" aria-label={`Move ${section.name} up`} disabled={busy || index === 0}
                        className="rounded p-1 hover:bg-black/[0.04] disabled:opacity-30"
                        onClick={() => run(onMove(section.id, "up"))}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button" aria-label={`Move ${section.name} down`} disabled={busy || index === sections.length - 1}
                        className="rounded p-1 hover:bg-black/[0.04] disabled:opacity-30"
                        onClick={() => run(onMove(section.id, "down"))}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button" aria-label={`Rename ${section.name}`} className="rounded p-1 hover:bg-black/[0.04]"
                        onClick={() => { setEditingId(section.id); setEditName(section.name); setError(null); }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button" aria-label={`Delete ${section.name}`} className="rounded p-1 hover:bg-black/[0.04]"
                        onClick={() => { setPendingDelete(section); setError(null); }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form
          className="flex flex-wrap items-center gap-space-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) {
              setError("Section name is required.");
              return;
            }
            if (await run(onAdd(newName))) setNewName("");
          }}
        >
          <Input
            value={newName} maxLength={60} placeholder="New section name, e.g. Patio" aria-label="New section name"
            className="max-w-[280px]" onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" size="md" disabled={busy}>Add section</Button>
        </form>
      )}
      {error && <p className="mt-space-2 text-[13px] text-error">{error}</p>}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ""}
        message="This removes the section from your list. A section that still has tables or staff can't be deleted."
        confirmLabel="Delete section"
        destructive
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await run(onDelete(pendingDelete.id));
          setPendingDelete(null);
        }}
      />
    </Card>
  );
}
