"use client";

import { useEffect, useState } from "react";
import { useBranchFilter } from "@/lib/branchContext";

/** The branch a branch-scoped settings page (Booking rules, Reservation types) is editing: the one picked on the page
 * (or named by ?branch= in the URL), else the one chosen in the top bar, else the default branch. */
export function useSettingsBranch() {
  const { accessibleBranches, selectedBranchId } = useBranchFilter();
  const [pickedId, setPickedId] = useState<string | null>(null);
  // A link such as /portal/settings/reservation-types?branch=<id> opens it on that branch.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("branch");
    // Read once on mount (the URL is client-only), so the first render matches the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) setPickedId(fromUrl);
  }, []);
  const branchId =
    pickedId ?? selectedBranchId ?? accessibleBranches.find((b) => b.is_default)?.id ?? accessibleBranches[0]?.id ?? null;
  const branch = accessibleBranches.find((b) => b.id === branchId) ?? null;
  return { branches: accessibleBranches, branchId, branch, setBranchId: setPickedId };
}
