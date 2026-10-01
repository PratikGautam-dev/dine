"use client";

import { Store } from "lucide-react";
import { useBranchFilter } from "@/lib/branchContext";

/** Global topbar branch switcher (multi-branch plan, Phase 3) -- rendered by PortalShell only on
 * pages whose data is actually branch-scoped (see PortalShell's own _BRANCH_AWARE_PAGES); Menu,
 * Customers, Staff, Offers and Messages are all explicitly shared across branches, so no
 * switcher is shown there -- one that visibly changed nothing would read as broken, not as
 * "nothing to filter." Renders nothing when multi-branch is off or the restaurant only has one
 * branch either -- a single-location restaurant sees no change from today.
 *
 * Per-branch staff access (migration 0060): a staff member Settings > Staff has restricted only
 * ever sees/picks from `accessibleBranches`, and "All Branches" is hidden entirely for them --
 * picking it would mean "give me everything," which the backend refuses for a restricted caller. */
export function BranchSwitcher() {
  const { multiBranchEnabled, accessibleBranches, isRestricted, selectedBranchId, setSelectedBranchId } = useBranchFilter();

  if (!multiBranchEnabled || accessibleBranches.length === 0) return null;
  if (!isRestricted && accessibleBranches.length <= 1) return null;

  return (
    <label className="hidden cursor-pointer items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-1.5 text-[13px] font-medium text-ink-700 md:flex">
      <Store size={15} className="text-ink-400" />
      <select
        value={selectedBranchId ?? ""}
        onChange={(e) => setSelectedBranchId(e.target.value || null)}
        aria-label="Branch"
        className="cursor-pointer bg-transparent outline-none"
      >
        {!isRestricted && <option value="">All Branches</option>}
        {accessibleBranches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
