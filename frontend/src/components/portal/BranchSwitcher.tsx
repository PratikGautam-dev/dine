"use client";

import { Store } from "lucide-react";
import { useBranchFilter } from "@/lib/branchContext";

/** Global topbar branch switcher (multi-branch plan, Phase 3) -- rendered on every /portal/*
 * page via PortalShell, including Menu and Staff, so switching branches is always one click away
 * regardless of which page a staff member is on. Renders nothing when multi-branch is off or the
 * restaurant only has one branch -- a single-location restaurant sees no change from today. */
export function BranchSwitcher() {
  const { multiBranchEnabled, branches, selectedBranchId, setSelectedBranchId } = useBranchFilter();

  if (!multiBranchEnabled || branches.length <= 1) return null;

  return (
    <label className="hidden items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-1.5 text-[13px] font-medium text-ink-700 md:flex">
      <Store size={15} className="text-ink-400" />
      <select
        value={selectedBranchId ?? ""}
        onChange={(e) => setSelectedBranchId(e.target.value || null)}
        aria-label="Branch"
        className="bg-transparent outline-none"
      >
        <option value="">All Branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
