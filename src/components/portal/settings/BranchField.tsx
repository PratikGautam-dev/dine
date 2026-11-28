"use client";

import { Field } from "@/components/erp-ui/Field";
import { Select } from "@/components/erp-ui/Select";
import type { Branch } from "@/lib/branchContext";

/** "Branch" dropdown for a branch-scoped settings page; with a single branch it just names it. */
export function BranchField({
  branches,
  branchId,
  branch,
  onChange,
}: {
  branches: Branch[];
  branchId: string | null;
  branch: Branch | null;
  onChange: (id: string) => void;
}) {
  if (branches.length > 1) {
    return (
      <Field label="Branch" htmlFor="settings-branch">
        <Select id="settings-branch" value={branchId ?? ""} onValueChange={onChange}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  return branch ? (
    <p className="mb-space-3 text-[13px] font-medium text-ink-900">Branch: {branch.name}</p>
  ) : null;
}
