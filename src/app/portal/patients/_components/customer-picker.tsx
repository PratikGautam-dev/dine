"use client";

import { Search, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { Patient } from "@/hooks/usePatients";

/** The narrow left-hand "pick a customer" list the Loyalty/Tags/Communication tabs share --
 * lighter than the All Customers tab's full DataTable, since these tabs are about one customer's
 * detail at a time, not browsing/filtering the whole directory. */
export function CustomerPicker({
  patients,
  search,
  onSearchChange,
  activeId,
  onSelect,
}: {
  patients: Patient[] | null;
  search: string;
  onSearchChange: (v: string) => void;
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <Card className="flex max-h-140 flex-col p-space-3">
      <div className="relative mb-space-2 shrink-0">
        <Search size={14} className="absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400" />
        <Input
          placeholder="Search customers…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8 text-[13px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!patients ? (
          <TableSkeleton rows={5} columns={1} />
        ) : patients.length === 0 ? (
          <div className="py-space-6 text-center">
            <UserRound size={22} className="mx-auto mb-space-2 text-ink-300" />
            <p className="text-[12.5px] text-ink-400">No customers match.</p>
          </div>
        ) : (
          <ul className="space-y-space-1">
            {patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-md px-space-2 py-space-2 text-left transition-colors",
                    activeId === p.id ? "bg-brand-50" : "hover:bg-black/[0.03]",
                  )}
                >
                  <span className="truncate text-[13px] font-semibold text-ink-900">
                    {p.name || p.phone}
                  </span>
                  {p.name && <span className="truncate text-[11.5px] text-ink-600">{p.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
