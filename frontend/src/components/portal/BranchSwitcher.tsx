"use client";

import { Store } from "lucide-react";
import { useBranchFilter } from "@/lib/branchContext";

/** Global topbar branch switcher (multi-branch plan, Phase 3) -- rendered by PortalShell only on
 * pages whose data is actually branch-scoped (see PortalShell's own _BRANCH_AWARE_PAGES); Menu,
 * Customers, Staff, Offers and Messages are all explicitly shared across branches, so no
 * switcher is shown there -- one that visibly changed nothing would read as broken, not as
 * "nothing to filter." Renders nothing when multi-branch is off or the restaurant only has one
 * branch either -- a single-location restaurant sees no change from today. */
export function BranchSwitcher() {
  const { multiBranchEnabled, branches, selectedBranchId, setSelectedBranchId } = useBranchFilter();

  if (!multiBranchEnabled || branches.length <= 1) return null;

  return (
    <label className="hidden cursor-pointer items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-1.5 text-[13px] font-medium text-ink-700 md:flex">
      <Store size={15} className="text-ink-400" />
      <select
        value={selectedBranchId ?? ""}
        onChange={(e) => setSelectedBranchId(e.target.value || null)}
        aria-label="Branch"
        className="cursor-pointer bg-transparent outline-none"
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
