"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Pencil, Tag as TagIcon, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { rupees } from "@/lib/foodOrders";
import type { Patient } from "@/hooks/usePatients";

type TagEntry = { tag: string; members: Patient[] };

const MEMBER_COLUMNS: ColumnDef<Patient>[] = [
  {
    id: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-ink-900">{row.original.name || "Not registered yet"}</p>
        <p className="flex items-center gap-1 text-[12px] text-ink-600">
          <WhatsAppIcon size={12} /> {row.original.phone}
        </p>
      </div>
    ),
  },
  {
    id: "tier",
    header: "Tier",
    cell: ({ row }) => (row.original.loyalty_tier ? <Badge tone="warning">{row.original.loyalty_tier}</Badge> : "—"),
  },
  {
    id: "spend",
    header: "Total spend",
    cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.total_spend_paise)}</span>,
  },
];

/** Customers page's Tags tab -- the restaurant-wide tag directory (every distinct tag in use,
 * with a live member count), sitting above the per-customer tag editor (TagsPanel). Members are
 * computed client-side from the already-loaded customer directory (`directory` -- the same
 * unfiltered list the All Customers tab's own summary tiles use), not a separate fetch, since
 * every patient's tags already ride along on that list. Rename/delete act across every customer
 * carrying that tag in one action (db.rename_patient_tag()/delete_patient_tag_everywhere()). */
export function TagDirectory({
  directory,
  tagActionLoading,
  onRenameTag,
  onDeleteTag,
  onSelectCustomer,
}: {
  directory: Patient[] | null;
  tagActionLoading: string | null;
  onRenameTag: (oldTag: string, newTag: string) => Promise<boolean>;
  onDeleteTag: (tag: string) => Promise<boolean>;
  onSelectCustomer: (id: number) => void;
}) {
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [viewingTag, setViewingTag] = useState<string | null>(null);

  const entries = useMemo<TagEntry[]>(() => {
    const byTag = new Map<string, Patient[]>();
    for (const p of directory ?? []) {
      for (const tag of p.tags ?? []) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push(p);
      }
    }
    return [...byTag.entries()]
      .map(([tag, members]) => ({ tag, members }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [directory]);

  const taggedCustomers = useMemo(() => {
    const ids = new Set<number>();
    for (const p of directory ?? []) if ((p.tags ?? []).length > 0) ids.add(p.id);
    return ids.size;
  }, [directory]);

  const viewing = entries.find((e) => e.tag === viewingTag) ?? null;

  function startRename(tag: string) {
    setRenamingTag(tag);
    setRenameDraft(tag);
  }

  async function saveRename(tag: string) {
    const next = renameDraft.trim();
    if (!next || next === tag) {
      setRenamingTag(null);
      return;
    }
    const ok = await onRenameTag(tag, next);
    if (ok) setRenamingTag(null);
  }

  async function confirmDelete() {
    if (!deletingTag) return;
    const ok = await onDeleteTag(deletingTag);
    if (ok) setDeletingTag(null);
  }

  return (
    <div className="mb-space-4 space-y-space-4">
      <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-3">
        <StatTile label="Tags in use" value={entries.length} deltaPct={null} icon={<TagIcon size={20} />} hint="" />
        <StatTile label="Tagged customers" value={taggedCustomers} deltaPct={null} tone="info" hint="" />
        <StatTile
          label="Most used tag"
          value={entries[0]?.tag ?? "—"}
          deltaPct={null}
          tone="warning"
          hint={entries[0] ? `${entries[0].members.length} customers` : ""}
        />
      </div>

      <Card className="p-space-4">
        <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Tag directory</h3>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-space-2 rounded-lg bg-paper py-space-6 text-center">
            <TagIcon size={22} className="text-ink-300" />
            <p className="text-[12.5px] text-ink-400">
              No tags yet — add one to a customer below to start building your tag directory.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-space-2">
            {entries.map(({ tag, members }) => (
              <div
                key={tag}
                className="flex items-center gap-space-2 rounded-lg border border-line bg-card px-space-3 py-space-2"
              >
                {renamingTag === tag ? (
                  <>
                    <Input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(tag);
                        if (e.key === "Escape") setRenamingTag(null);
                      }}
                      autoFocus
                      className="h-7 w-32 text-[12.5px]"
                    />
                    <button
                      type="button"
                      onClick={() => saveRename(tag)}
                      disabled={tagActionLoading === tag}
                      aria-label="Save rename"
                      className="rounded-full p-1 text-success hover:bg-black/[0.04] disabled:opacity-50"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingTag(null)}
                      aria-label="Cancel rename"
                      className="rounded-full p-1 text-ink-400 hover:bg-black/[0.04]"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewingTag(tag)}
                      className="flex items-center gap-space-2 text-[13px] font-semibold text-ink-900"
                    >
                      <Badge tone="brand">{tag}</Badge>
                      <span className="flex items-center gap-1 text-ink-600">
                        <Users size={12} /> {members.length}
                      </span>
                    </button>
                    <PermissionGate page="patients" action="write">
                      <button
                        type="button"
                        onClick={() => startRename(tag)}
                        disabled={tagActionLoading === tag}
                        aria-label={`Rename tag ${tag}`}
                        className="rounded-full p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900 disabled:opacity-50"
                      >
                        <Pencil size={12} />
                      </button>
                    </PermissionGate>
                    <PermissionGate page="patients" action="delete">
                      <button
                        type="button"
                        onClick={() => setDeletingTag(tag)}
                        disabled={tagActionLoading === tag}
                        aria-label={`Delete tag ${tag}`}
                        className="rounded-full p-1 text-ink-400 hover:bg-black/[0.04] hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </PermissionGate>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {viewing && (
        <Modal onClose={() => setViewingTag(null)} labelledBy="tag-members-title" maxWidthClass="max-w-[640px]">
          <div className="mb-space-4 flex items-center justify-between">
            <h3 id="tag-members-title" className="text-[16px] font-bold text-ink-900">
              {viewing.tag} — {viewing.members.length} customer{viewing.members.length === 1 ? "" : "s"}
            </h3>
            <button
              type="button"
              onClick={() => setViewingTag(null)}
              aria-label="Close"
              className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
            >
              <X size={16} />
            </button>
          </div>
          <DataTable
            columns={MEMBER_COLUMNS}
            data={viewing.members}
            getRowId={(p) => String(p.id)}
            onRowClick={(p) => {
              setViewingTag(null);
              onSelectCustomer(p.id);
            }}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={deletingTag !== null}
        title={`Delete tag "${deletingTag}"?`}
        message={`This removes "${deletingTag}" from every customer who has it. This can't be undone.`}
        confirmLabel="Delete tag"
        destructive
        busy={tagActionLoading === deletingTag}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTag(null)}
      />
    </div>
  );
}
