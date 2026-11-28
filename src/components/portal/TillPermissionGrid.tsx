"use client";

import { Input } from "@/components/ui/Input";
import type { TillPermission } from "@/hooks/useTillPermissions";

export type TillGrid = { permissions: string[]; maxDiscountPct: string };

const DISCOUNT_KEY = "bill.discount";

/** What one role may do on the POS till: a tick per action, grouped like the till's own screens, plus the largest discount the role may
 * give when it holds "Give discounts". The till enforces these offline; a cashier without one needs a manager's PIN. */
export function TillPermissionGrid({
  catalogue,
  value,
  onChange,
  readOnly,
}: {
  catalogue: TillPermission[];
  value: TillGrid;
  onChange: (next: TillGrid) => void;
  readOnly?: boolean;
}) {
  const held = new Set(value.permissions);
  const groups = [...new Set(catalogue.map((p) => p.group))];

  function set(keys: string[], on: boolean) {
    const next = new Set(held);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange({ ...value, permissions: catalogue.map((p) => p.key).filter((k) => next.has(k)) });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
            <th className="py-space-2 pr-space-3 font-semibold">On the till</th>
            <th className="w-28 py-space-2 text-center font-semibold">Allowed</th>
          </tr>
        </thead>
        {groups.map((g) => {
          const inGroup = catalogue.filter((p) => p.group === g);
          const all = inGroup.every((p) => held.has(p.key));
          const some = inGroup.some((p) => held.has(p.key));
          return (
            <tbody key={g}>
              <tr>
                <td className="bg-paper px-space-2 py-space-1 text-[11px] font-bold tracking-wide text-ink-600 uppercase">
                  {g}
                </td>
                <td className="bg-paper text-center">
                  <input
                    type="checkbox"
                    aria-label={`${g}: allow everything`}
                    checked={all}
                    disabled={readOnly}
                    ref={(el) => {
                      if (el) el.indeterminate = some && !all;
                    }}
                    onChange={(e) =>
                      set(
                        inGroup.map((p) => p.key),
                        e.target.checked,
                      )
                    }
                    className="h-4 w-4 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </td>
              </tr>
              {inGroup.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-space-2 pr-space-3 text-ink-900">
                    <span className="font-medium">{p.label}</span>
                    {p.hint && (
                      <span className="block text-[11px] font-normal text-ink-400">{p.hint}</span>
                    )}
                    {p.key === DISCOUNT_KEY && held.has(DISCOUNT_KEY) && (
                      <label className="mt-space-1 flex items-center gap-space-2 text-[12px] text-ink-600">
                        Up to
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.5"
                          aria-label="Largest discount, in percent"
                          className="h-8 w-20"
                          value={value.maxDiscountPct}
                          disabled={readOnly}
                          onChange={(e) => onChange({ ...value, maxDiscountPct: e.target.value })}
                        />
                        % of the bill
                      </label>
                    )}
                  </td>
                  <td className="py-space-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={p.label}
                      checked={held.has(p.key)}
                      disabled={readOnly}
                      onChange={(e) => set([p.key], e.target.checked)}
                      className="h-4 w-4 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/** "12.5" -> 1250 basis points; null when it isn't a percentage from 0 to 100. */
export function pctToBps(pct: string): number | null {
  const n = Number(pct);
  if (pct.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}

export const bpsToPct = (bps: number) => String(bps / 100);
