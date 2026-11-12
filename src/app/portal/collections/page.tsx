"use client";

import { useMemo, useState } from "react";
import { FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { type Collection, type CollectionDraft, useCollections } from "@/hooks/useCollections";
import { type MenuItem, useMenuItems } from "@/hooks/useMenuItems";
import { rupees } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

type Filter = "all" | "header";

export default function CollectionsPage() {
  const { ready, restaurant } = usePortalGuard();
  const canWrite = usePermission("food_menu", "write");
  const { items } = useMenuItems(ready);
  const { collections, save, remove, toggleHeader } = useCollections(restaurant?.id ?? null);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Collection | null>(null);

  const itemsById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (collections ?? []).filter(
      (c) => (filter === "all" || c.show_in_header) && (!q || c.name.toLowerCase().includes(q)),
    );
  }, [collections, filter, search]);

  return (
    <PortalShell restaurant={restaurant} active="collections">
      <PageHeader
        title="Collections"
        icon={<FolderOpen size={22} />}
        description="Group menu items — Chef's specials, Under ₹200, Weekend brunch — to feature them."
        actions={
          canWrite && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} /> Add collection
            </Button>
          )
        }
      />

      <Card className="p-space-4">
        <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
          <div className="flex gap-space-1 rounded-md bg-black/[0.04] p-1">
            {(["all", "header"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  "rounded px-space-3 py-1.5 text-[13px] font-semibold " +
                  (filter === f ? "bg-card text-ink-900 shadow-[var(--shadow-sm)]" : "text-ink-600")
                }
              >
                {f === "all" ? "All" : "In header"}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections"
              className="h-9 w-56 rounded-md border border-line bg-card pr-3 pl-9 text-[13px] focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
          </label>
        </div>

        {!collections ? (
          <ListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <p className="py-space-6 text-center text-[13.5px] text-ink-600">
            {collections.length === 0
              ? "No collections yet. Create one to group your menu items."
              : "No collections match."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((c) => {
              const live = c.item_ids
                .map((id) => itemsById.get(id))
                .filter((i): i is MenuItem => !!i);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-space-3 py-space-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink-900">{c.name}</p>
                    <p className="truncate text-[12.5px] text-ink-600">
                      {live.length} {live.length === 1 ? "item" : "items"}
                      {live.length > 0 &&
                        ` · ${live
                          .slice(0, 3)
                          .map((i) => i.name)
                          .join(", ")}${live.length > 3 ? "…" : ""}`}
                    </p>
                  </div>
                  <label className="flex items-center gap-space-2 text-[12.5px] text-ink-600">
                    Show in header
                    <Switch
                      size="sm"
                      checked={c.show_in_header}
                      disabled={!canWrite}
                      onChange={() => toggleHeader(c.id)}
                    />
                  </label>
                  {canWrite && (
                    <div className="flex gap-space-1">
                      <Button
                        variant="ghost"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => setEditing(c)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setPendingDelete(c)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-space-4 text-[12px] text-ink-400">
          Collections are saved in this browser for now; they are not yet shared across devices or
          shown on the storefront.
        </p>
      </Card>

      {editing && (
        <CollectionEditor
          key={editing === "new" ? "new" : editing.id}
          collection={editing === "new" ? null : editing}
          items={items ?? []}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            save(draft, editing === "new" ? undefined : editing.id);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        destructive
        title="Delete collection?"
        message={`“${pendingDelete?.name}” will be removed. Your menu items are not affected.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </PortalShell>
  );
}

function CollectionEditor({
  collection,
  items,
  onClose,
  onSave,
}: {
  collection: Collection | null;
  items: MenuItem[];
  onClose: () => void;
  onSave: (draft: CollectionDraft) => void;
}) {
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [showInHeader, setShowInHeader] = useState(collection?.show_in_header ?? false);
  const [selected, setSelected] = useState<Set<string>>(new Set(collection?.item_ids ?? []));
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shown = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the collection a name.");
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      item_ids: [...selected],
      show_in_header: showInHeader,
    });
  }

  return (
    <Modal onClose={onClose} labelledBy="collection-editor-title" maxWidthClass="max-w-[560px]">
      <form onSubmit={submit}>
        <h2 id="collection-editor-title" className="mb-space-4 text-[17px] font-bold text-ink-900">
          {collection ? "Edit collection" : "Add collection"}
        </h2>
        <Field label="Name" htmlFor="col-name" required error={error ?? undefined}>
          <Input
            id="col-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!error}
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="col-desc">
          <Textarea
            id="col-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <label className="mb-space-4 flex items-center justify-between text-[13.5px] font-medium text-ink-900">
          Show in header
          <Switch checked={showInHeader} onChange={() => setShowInHeader((v) => !v)} />
        </label>

        <p className="text-label mb-space-1">Menu items ({selected.size} selected)</p>
        <Input
          placeholder="Search items"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-space-2"
        />
        <ul className="mb-space-4 max-h-56 overflow-y-auto rounded-md border border-line">
          {shown.length === 0 ? (
            <li className="p-space-3 text-[13px] text-ink-600">No menu items found.</li>
          ) : (
            shown.map((i) => (
              <li key={i.id} className="border-b border-line last:border-0">
                <label className="flex cursor-pointer items-center gap-space-3 px-space-3 py-2 hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-900">
                    {i.name}
                  </span>
                  <span className="text-[12.5px] text-ink-600">{rupees(i.price_paise)}</span>
                </label>
              </li>
            ))
          )}
        </ul>

        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save collection</Button>
        </div>
      </form>
    </Modal>
  );
}
