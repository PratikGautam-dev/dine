"use client";

import { Building2 } from "lucide-react";
import { HeaderSelect } from "@/components/portal/HeaderSelect";
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
  const {
    multiBranchEnabled,
    accessibleBranches,
    isRestricted,
    selectedBranchId,
    setSelectedBranchId,
  } = useBranchFilter();

  if (!multiBranchEnabled || accessibleBranches.length === 0) return null;
  if (!isRestricted && accessibleBranches.length <= 1) return null;

  const options = [
    ...(isRestricted ? [] : [{ value: "", label: "All branches", hint: null }]),
    ...accessibleBranches.map((b) => ({ value: b.id, label: b.name, hint: b.city })),
  ];

  return (
    <div className="hidden md:block">
      <HeaderSelect
        icon={<Building2 />}
        ariaLabel="Branch"
        value={selectedBranchId ?? ""}
        options={options}
        onChange={(id) => setSelectedBranchId(id || null)}
      />
    </div>
  );
}
