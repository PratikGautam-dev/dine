"use client";

import { useState } from "react";
import { Plus, Tag as TagIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { CustomerHeader } from "./customer-header";
import type { PatientDetail } from "@/hooks/usePatients";

const SUGGESTED_TAGS = ["VIP", "Regular", "Frequent Buyer", "New Customer"];

/** Customers page's Tags tab -- the editor for one selected customer's tag list. A real tag
 * CRUD UI, not just the free-form list patients.tags used to be before this session (set via
 * POST /api/portal/patients/{id}/tags, which dedupes/trims server-side too). */
export function TagsPanel({
  profile,
  profileLoading,
  saving,
  onSave,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  saving: boolean;
  onSave: (tags: string[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");

  if (profileLoading || !profile) {
    return (
      <Card className="min-h-100 p-space-4">
        <FormSkeleton fields={3} />
      </Card>
    );
  }

  // Defensive: a backend that hasn't picked up this session's changes yet (e.g. a dev server
  // that needs a restart to load the new /tags route and the tags field on the detail response)
  // would otherwise crash this tab outright instead of just showing an empty tag list.
  const tags = profile.tags ?? [];
  const suggestions = SUGGESTED_TAGS.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));

  function addTagValue(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    onSave([...tags, trimmed]);
  }

  async function addTag() {
    const tag = draft.trim();
    if (!tag) return;
    const ok = await onSave([...tags, tag]);
    if (ok) setDraft("");
  }

  function removeTag(tag: string) {
    onSave(tags.filter((t) => t !== tag));
  }

  return (
    <Card className="min-h-100 p-space-4">
      <CustomerHeader profile={profile} />

      <p className="mb-space-2 text-[11px] font-semibold text-ink-600">TAGS</p>
      <div className="mb-space-4 flex flex-wrap gap-space-2">
        {tags.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-space-2 rounded-lg bg-paper py-space-6 text-center">
            <TagIcon size={22} className="text-ink-300" />
            <p className="text-[12.5px] text-ink-400">No tags yet — add one below.</p>
          </div>
        ) : (
          tags.map((tag) => (
            <Badge key={tag} tone="brand" className="gap-space-1">
              {tag}
              <PermissionGate page="patients" action="write">
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={saving}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
                >
                  <X size={10} />
                </button>
              </PermissionGate>
            </Badge>
          ))
        )}
      </div>

      <PermissionGate page="patients" action="write">
        <div className="mb-space-4 flex gap-space-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag… (e.g. VIP, Frequent Buyer)"
            className="text-[13px]"
          />
          <Button size="md" variant="secondary" onClick={addTag} disabled={saving || !draft.trim()}>
            <Plus size={14} /> Add
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div>
            <p className="mb-space-2 text-[11px] font-semibold text-ink-600">QUICK ADD</p>
            <div className="flex flex-wrap gap-space-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving}
                  onClick={() => addTagValue(s)}
                  className="rounded-full border border-dashed border-line px-space-3 py-1 text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </PermissionGate>
    </Card>
  );
}
