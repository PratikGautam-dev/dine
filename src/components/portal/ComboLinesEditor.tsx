"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { ComboCandidate } from "@/hooks/useMenuItems";
import { portalFetch } from "@/lib/portalAuth";
import { rupees } from "@/lib/foodOrders";

const SELECT_CLASS =
  "h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";

type Line = { component_item_id: string; quantity: string };

type Props = {
  lines: Line[];
  onChange: (lines: Line[]) => void;
};

/** What's inside a combo -- pick a real menu item + how many, one row per line. Loads the
 * restaurant's own non-combo items once (a combo can't contain another combo), and shows a live
 * "sum of parts" total against the selected lines so staff can see the discount they're giving
 * before they set the combo's own price. */
export function ComboLinesEditor({ lines, onChange }: Props) {
  const [candidates, setCandidates] = useState<ComboCandidate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await portalFetch("/api/portal/menu-items/combo-candidates");
      if (!cancelled && result.ok)
        setCandidates((result.data as { items: ComboCandidate[] }).items);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = new Map((candidates ?? []).map((c) => [c.id, c]));
  const sumOfPartsPaise = lines.reduce((total, l) => {
    const item = byId.get(l.component_item_id);
    return item ? total + item.price_paise * (Number(l.quantity) || 0) : total;
  }, 0);

  function updateLine(i: number, patch: Partial<Line>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }
  function addLine() {
    onChange([...lines, { component_item_id: "", quantity: "1" }]);
  }

  return (
    <Field
      label="What's in this combo"
      required
      hint="Pick real menu items and how many of each -- guests see them listed on WhatsApp."
    >
      {!candidates ? (
        <p className="text-[12.5px] text-ink-400">Loading your menu…</p>
      ) : candidates.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">
          Add some regular menu items first -- a combo bundles items you already have.
        </p>
      ) : (
        <div className="space-y-space-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-space-2">
              <select
                aria-label={`Combo item ${i + 1}`}
                className={SELECT_CLASS}
                value={line.component_item_id}
                onChange={(e) => updateLine(i, { component_item_id: e.target.value })}
              >
                <option value="">Choose an item…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {rupees(c.price_paise)}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                step="1"
                aria-label={`Quantity for combo item ${i + 1}`}
                className="w-16! shrink-0"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                aria-label={`Remove combo item ${i + 1}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-paper hover:text-error"
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" size="md" onClick={addLine}>
            <Plus size={14} /> Add item
          </Button>
          {lines.length > 0 && (
            <p className="text-[12.5px] text-ink-600">
              Sum of parts:{" "}
              <span className="font-semibold text-ink-900">{rupees(sumOfPartsPaise)}</span>
            </p>
          )}
        </div>
      )}
    </Field>
  );
}
