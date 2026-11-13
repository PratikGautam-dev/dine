"use client";

import { useBranchFilter } from "@/lib/branchContext";

export type BranchOption = { id: string; branch_name: string; branch_code: string };

/** The restaurant's branches in the ERP's shape (the Insights page's branch filter). Dine already holds the list in its branch context. */
export function useBranches() {
  const { branches } = useBranchFilter();
  return {
    data: (branches ?? []).filter((b) => b.is_active).map((b): BranchOption => ({ id: b.id, branch_name: b.name, branch_code: b.id })),
  };
}
