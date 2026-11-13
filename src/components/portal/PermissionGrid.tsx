"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import type { PagePerms } from "@/hooks/usePortalRoles";
import { GROUP_ORDER, type RolePage } from "@/lib/rolePages";

type Column = "view" | "write" | "delete";
const COLUMNS: { key: Column; label: string }[] = [
  { key: "view", label: "View" },
  { key: "write", label: "Create & edit" },
  { key: "delete", label: "Delete" },
];

export const NO_ACCESS: PagePerms = { view: false, write: false, delete: false };

/** Dine's own ticking rule, kept in one place: giving Create & edit or Delete also gives View; taking View away takes everything away. */
export function tick(cell: PagePerms, column: Column, on: boolean): PagePerms {
  if (column === "view") return on ? { ...cell, view: true } : { ...NO_ACCESS };
  return { ...cell, [column]: on, view: on ? true : cell.view };
}

/** The permissions of one role: a row per portal page with View / Create & edit / Delete, grouped like the portal's menus. */
export function PermissionGrid({
  pages,
  value,
  onChange,
  readOnly,
}: {
  pages: RolePage[];
  value: Record<string, PagePerms>;
  onChange: (next: Record<string, PagePerms>) => void;
  readOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return pages.filter((p) => !query || `${p.label} ${p.covers}`.toLowerCase().includes(query));
  }, [pages, q]);
  const groups = GROUP_ORDER.filter((g) => rows.some((r) => r.group === g));
  const cell = (key: string) => value[key] ?? NO_ACCESS;

  function setColumnForAll(group: string, column: Column, on: boolean) {
    const next = { ...value };
    rows.filter((r) => r.group === group).forEach((r) => (next[r.key] = tick(cell(r.key), column, on)));
    onChange(next);
  }

  return (
    <div>
      <Input
        placeholder="Find a page"
        aria-label="Find a page"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-space-2"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
              <th className="py-space-2 pr-space-3 font-semibold">Page</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="w-28 py-space-2 text-center font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => {
            const inGroup = rows.filter((r) => r.group === g);
            return (
              <tbody key={g}>
                <tr>
                  <td className="bg-paper px-space-2 py-space-1 text-[11px] font-bold tracking-wide text-ink-600 uppercase">{g}</td>
                  {COLUMNS.map((c) => {
                    const all = inGroup.every((r) => cell(r.key)[c.key]);
                    const some = inGroup.some((r) => cell(r.key)[c.key]);
                    return (
                      <td key={c.key} className="bg-paper text-center">
                        <input
                          type="checkbox"
                          aria-label={`${g}: ${c.label} for every page`}
                          checked={all}
                          disabled={readOnly}
                          ref={(el) => {
                            if (el) el.indeterminate = some && !all;
                          }}
                          onChange={(e) => setColumnForAll(g, c.key, e.target.checked)}
                          className="h-4 w-4 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                    );
                  })}
                </tr>
                {inGroup.map((p) => (
                  <tr key={p.key} className="border-t border-line">
                    <td className="py-space-2 pr-space-3 text-ink-900">
                      <span className="font-medium">{p.label}</span>
                      <span className="block text-[11px] font-normal text-ink-400">{p.covers}</span>
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="py-space-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${p.label}: ${c.label}`}
                          checked={cell(p.key)[c.key]}
                          disabled={readOnly}
                          onChange={(e) => onChange({ ...value, [p.key]: tick(cell(p.key), c.key, e.target.checked) })}
                          className="h-4 w-4 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
