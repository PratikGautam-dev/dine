"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { rupees } from "@/lib/foodOrders";
import type { CustomerSegment, NewSegmentFields, SegmentMember } from "@/hooks/useCustomerSegments";

const EMPTY_FORM = { name: "", tag: "", minPoints: "", minSpendRupees: "", minOrders: "", platinumOnly: false };

const SEGMENT_MEMBER_COLUMNS: ColumnDef<SegmentMember>[] = [
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
    id: "points",
    header: "Points",
    cell: ({ row }) => <span className="tabular-nums">{row.original.loyalty_points}</span>,
  },
  {
    id: "spend",
    header: "Total spend",
    cell: ({ row }) => <span className="tabular-nums">{rupees(row.original.total_spend_paise)}</span>,
  },
];

/** Customers page's Segments tab -- named, saved filters (as opposed to the All Customers tab's
 * ad-hoc filter bar), member counts computed live by the backend. */
export function SegmentsPanel({
  segments,
  creating,
  onCreate,
  updatingId,
  onUpdate,
  deletingId,
  onDelete,
  viewingMembersId,
  members,
  membersLoading,
  onViewMembers,
  onCloseMembers,
}: {
  segments: CustomerSegment[] | null;
  creating: boolean;
  onCreate: (fields: NewSegmentFields) => Promise<boolean>;
  updatingId: number | null;
  onUpdate: (id: number, fields: Partial<NewSegmentFields>) => Promise<boolean>;
  deletingId: number | null;
  onDelete: (id: number) => void;
  viewingMembersId: number | null;
  members: SegmentMember[] | null;
  membersLoading: boolean;
  onViewMembers: (id: number) => void;
  onCloseMembers: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(s: CustomerSegment) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      tag: s.tag || "",
      minPoints: s.min_points != null ? String(s.min_points) : "",
      minSpendRupees: s.min_spend_paise != null ? String(s.min_spend_paise / 100) : "",
      minOrders: s.min_orders != null ? String(s.min_orders) : "",
      platinumOnly: s.platinum_only,
    });
  }

  async function handleSave() {
    const fields: NewSegmentFields = {
      name: form.name.trim(),
      tag: form.tag.trim() || undefined,
      min_points: form.minPoints ? Number(form.minPoints) : undefined,
      min_spend_paise: form.minSpendRupees ? Number(form.minSpendRupees) * 100 : undefined,
      min_orders: form.minOrders ? Number(form.minOrders) : undefined,
      platinum_only: form.platinumOnly,
    };
    const ok = editingId === null ? await onCreate(fields) : await onUpdate(editingId, fields);
    if (ok) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  const saving = editingId === null ? creating : updatingId === editingId;
  const totalMembers = (segments ?? []).reduce((sum, s) => sum + s.member_count, 0);
  const platinumSegments = (segments ?? []).filter((s) => s.platinum_only).length;
  const viewingSegment = segments?.find((s) => s.id === viewingMembersId) ?? null;

  return (
    <div className="space-y-space-4">
      <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-3">
        <StatTile label="Segments" value={(segments ?? []).length} deltaPct={null} icon={<Users size={20} />} hint="" />
        <StatTile
          label="Customers covered"
          value={totalMembers}
          deltaPct={null}
          tone="info"
          hint="A customer can be in more than one segment"
        />
        <StatTile label="Platinum-only segments" value={platinumSegments} deltaPct={null} tone="warning" hint="" />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[340px_1fr]">
        <PermissionGate page="patients" action="write">
          <Card className="h-fit p-space-4">
            <div className="mb-space-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink-900">
                {editingId === null ? "New segment" : "Edit segment"}
              </h3>
              {editingId !== null && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="text-[12px] font-semibold text-brand-600 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>
            <Field label="Name" htmlFor="segment-name" required>
              <Input
                id="segment-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Big spenders"
              />
            </Field>
            <Field label="Tag" htmlFor="segment-tag" hint="Optional — matches customers with this tag.">
              <Input
                id="segment-tag"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="VIP"
              />
            </Field>
            <div className="grid grid-cols-3 gap-space-2">
              <Field label="Min points" htmlFor="segment-points">
                <Input
                  id="segment-points" type="number" min={0} value={form.minPoints}
                  onChange={(e) => setForm((f) => ({ ...f, minPoints: e.target.value }))}
                />
              </Field>
              <Field label="Min spend ₹" htmlFor="segment-spend">
                <Input
                  id="segment-spend" type="number" min={0} value={form.minSpendRupees}
                  onChange={(e) => setForm((f) => ({ ...f, minSpendRupees: e.target.value }))}
                />
              </Field>
              <Field label="Min orders" htmlFor="segment-orders">
                <Input
                  id="segment-orders" type="number" min={0} value={form.minOrders}
                  onChange={(e) => setForm((f) => ({ ...f, minOrders: e.target.value }))}
                />
              </Field>
            </div>
            <label className="mb-space-3 flex items-center gap-space-2 text-[13px] text-ink-700">
              <input
                type="checkbox"
                checked={form.platinumOnly}
                onChange={(e) => setForm((f) => ({ ...f, platinumOnly: e.target.checked }))}
              />
              Platinum tier only
            </label>
            <Button className="w-full" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {editingId === null ? <Plus size={14} /> : <Pencil size={14} />}{" "}
              {saving ? "Saving…" : editingId === null ? "Create segment" : "Save changes"}
            </Button>
          </Card>
        </PermissionGate>

        <div>
          {!segments ? (
            <Card className="p-space-4">
              <TableSkeleton rows={4} columns={1} />
            </Card>
          ) : segments.length === 0 ? (
            <Card className="flex min-h-[200px] flex-col items-center justify-center p-space-4 text-center">
              <Users size={24} className="mb-space-2 text-ink-300" />
              <p className="text-[13px] text-ink-400">No segments yet. Create one to get started.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
              {segments.map((s) => (
                <Card key={s.id} className="p-space-4">
                  <div className="mb-space-2 flex items-start justify-between gap-space-2">
                    <div>
                      <h4 className="text-[14px] font-bold text-ink-900">{s.name}</h4>
                      <p className="text-[12px] text-ink-600">
                        {s.member_count} customer{s.member_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-space-1">
                      <PermissionGate page="patients" action="write">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          aria-label={`Edit segment ${s.name}`}
                          className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
                        >
                          <Pencil size={14} />
                        </button>
                      </PermissionGate>
                      <PermissionGate page="patients" action="delete">
                        <button
                          type="button"
                          onClick={() => onDelete(s.id)}
                          disabled={deletingId === s.id}
                          aria-label={`Delete segment ${s.name}`}
                          className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                  <div className="mb-space-3 flex flex-wrap gap-space-1">
                    {s.tag && <Badge tone="brand">Tag: {s.tag}</Badge>}
                    {s.min_points != null && <Badge tone="neutral">{s.min_points}+ points</Badge>}
                    {s.min_spend_paise != null && <Badge tone="neutral">{rupees(s.min_spend_paise)}+ spent</Badge>}
                    {s.min_orders != null && <Badge tone="neutral">{s.min_orders}+ orders</Badge>}
                    {s.platinum_only && <Badge tone="warning">Platinum only</Badge>}
                  </div>
                  {s.preview.length > 0 && (
                    <ul className="space-y-space-1 border-t border-line pt-space-2">
                      {s.preview.map((p) => (
                        <li key={p.id} className="truncate text-[12.5px] text-ink-700">
                          {p.name || p.phone}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.member_count > 0 && (
                    <button
                      type="button"
                      onClick={() => onViewMembers(s.id)}
                      className="mt-space-2 text-[11.5px] font-semibold text-brand-600 hover:underline"
                    >
                      View all {s.member_count} member{s.member_count === 1 ? "" : "s"} &gt;
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewingMembersId !== null && (
        <Modal onClose={onCloseMembers} labelledBy="segment-members-title" maxWidthClass="max-w-[640px]">
          <div className="mb-space-4 flex items-center justify-between">
            <h3 id="segment-members-title" className="text-[16px] font-bold text-ink-900">
              {viewingSegment ? `${viewingSegment.name} — members` : "Segment members"}
            </h3>
            <button
              type="button"
              onClick={onCloseMembers}
              aria-label="Close"
              className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
            >
              <X size={16} />
            </button>
          </div>
          {membersLoading || !members ? (
            <TableSkeleton rows={5} columns={3} />
          ) : members.length === 0 ? (
            <p className="py-space-4 text-center text-[13px] text-ink-400">No members match this segment.</p>
          ) : (
            <DataTable columns={SEGMENT_MEMBER_COLUMNS} data={members} getRowId={(m) => String(m.id)} />
          )}
        </Modal>
      )}
    </div>
  );
}
