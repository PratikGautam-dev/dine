"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Branch } from "@/lib/branchContext";

type Props = {
  name: string;
  branches: Branch[];
  initialBranchIds: string[];
  onSubmit: (branchIds: string[]) => Promise<string | null>;
  onClose: () => void;
};

/** Restricts (or un-restricts) which branches a team member can see and act on (migration 0060).
 * No branches checked = unrestricted, the default every staff member starts with. */
export function EditStaffBranchesDialog({
  name,
  branches,
  initialBranchIds,
  onSubmit,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initialBranchIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const problem = await onSubmit(selected);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="edit-branches-title" maxWidthClass="max-w-[440px]">
      <h2 id="edit-branches-title" className="text-[16px] font-semibold text-ink-900">
        Branch access for {name}
      </h2>
      <p className="mt-space-2 text-[13px] text-ink-600">
        Leave every box unchecked for unrestricted access (every branch visible, today&apos;s
        default). Check one or more to limit this person to exactly those branches.
      </p>
      <form onSubmit={handleSubmit} className="mt-space-4">
        <div className="max-h-[260px] space-y-1 overflow-y-auto rounded-md border border-line p-space-2">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-space-2 text-[13.5px] text-ink-900">
              <input
                type="checkbox"
                checked={selected.includes(b.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, b.id] : selected.filter((id) => id !== b.id),
                  )
                }
              />
              {b.name}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="mb-space-3 mt-space-3 text-[12.5px] font-medium text-error">
            {error}
          </p>
        )}
        <div className="mt-space-4 flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
