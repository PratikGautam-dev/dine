"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { rupees } from "@/lib/foodOrders";
import type { CustomerSegment, NewSegmentFields } from "@/hooks/useCustomerSegments";

/** Customers page's Segments tab -- named, saved filters (as opposed to the All Customers tab's
 * ad-hoc filter bar), member counts computed live by the backend. */
export function SegmentsPanel({
  segments,
  creating,
  onCreate,
  deletingId,
  onDelete,
}: {
  segments: CustomerSegment[] | null;
  creating: boolean;
  onCreate: (fields: NewSegmentFields) => Promise<boolean>;
  deletingId: number | null;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [minSpendRupees, setMinSpendRupees] = useState("");
  const [minOrders, setMinOrders] = useState("");
  const [platinumOnly, setPlatinumOnly] = useState(false);

  async function handleCreate() {
    const ok = await onCreate({
      name: name.trim(),
      tag: tag.trim() || undefined,
      min_points: minPoints ? Number(minPoints) : undefined,
      min_spend_paise: minSpendRupees ? Number(minSpendRupees) * 100 : undefined,
      min_orders: minOrders ? Number(minOrders) : undefined,
      platinum_only: platinumOnly,
    });
    if (ok) {
      setName("");
      setTag("");
      setMinPoints("");
      setMinSpendRupees("");
      setMinOrders("");
      setPlatinumOnly(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[340px_1fr]">
      <PermissionGate page="patients" action="write">
        <Card className="h-fit p-space-4">
          <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">New segment</h3>
          <Field label="Name" htmlFor="segment-name" required>
            <Input id="segment-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Big spenders" />
          </Field>
          <Field label="Tag" htmlFor="segment-tag" hint="Optional — matches customers with this tag.">
            <Input id="segment-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="VIP" />
          </Field>
          <div className="grid grid-cols-3 gap-space-2">
            <Field label="Min points" htmlFor="segment-points">
              <Input
                id="segment-points" type="number" min={0} value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
              />
            </Field>
            <Field label="Min spend ₹" htmlFor="segment-spend">
              <Input
                id="segment-spend" type="number" min={0} value={minSpendRupees}
                onChange={(e) => setMinSpendRupees(e.target.value)}
              />
            </Field>
            <Field label="Min orders" htmlFor="segment-orders">
              <Input
                id="segment-orders" type="number" min={0} value={minOrders}
                onChange={(e) => setMinOrders(e.target.value)}
              />
            </Field>
          </div>
          <label className="mb-space-3 flex items-center gap-space-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={platinumOnly} onChange={(e) => setPlatinumOnly(e.target.checked)} />
            Platinum tier only
          </label>
          <Button className="w-full" onClick={handleCreate} disabled={creating || !name.trim()}>
            <Plus size={14} /> {creating ? "Creating…" : "Create segment"}
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
                    {s.member_count > s.preview.length && (
                      <li className="text-[11.5px] text-ink-400">
                        +{s.member_count - s.preview.length} more
                      </li>
                    )}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
