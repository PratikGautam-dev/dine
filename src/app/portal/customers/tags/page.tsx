"use client";

import { PlusSignIcon, Tag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { AllTagsView } from "@/components/crm/tags/AllTagsView";
import { CustomerTaggingView } from "@/components/crm/tags/CustomerTaggingView";
import { TagFormModal } from "@/components/crm/tags/TagFormModal";
import { TagRulesView } from "@/components/crm/tags/TagRulesView";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/erp-ui/Button";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { Tabs } from "@/components/erp-ui/Tabs";
import { useErpQuery } from "@/lib/erp/erp";
import { hasPermission, hasTenantWide, useStaffSession } from "@/lib/erp/staffAuth";
import type { CustomerTag, TagSummary } from "@/lib/erp/tags";

type View = "tags" | "tagging" | "rules";
const VIEWS: { key: View; label: string }[] = [
  { key: "tags", label: "All Tags" },
  { key: "tagging", label: "Customer Tagging" },
  { key: "rules", label: "Tag Rules" },
];

/** Customers > Tags: the tags (look, status, who they apply to), who carries them, and the rules that give them out automatically. */
export default function CustomerTagsPage() {
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const [view, setView] = useState<View>("tags");
  const [tagFilter, setTagFilter] = useState("");
  const [editing, setEditing] = useState<CustomerTag | null | undefined>(
    undefined,
  );
  const [version, setVersion] = useState(0);
  const [creatingRule, setCreatingRule] = useState<false | { tag_id?: string }>(
    false,
  );
  const summary = useErpQuery<TagSummary>("/api/v1/crm/tags/summary");
  const tags = useErpQuery<CustomerTag[]>("/api/v1/crm/tags");
  const canEdit = hasPermission(session, "tags", "write");
  const canConfigure = hasTenantWide(session, "tags:manage");

  if (!ready) return null;
  const changed = () => {
    summary.reload();
    tags.reload();
    setVersion((v) => v + 1);
  };

  return (
    <PortalShell restaurant={tenant} active="customers-tags">
      <PageHeader
        icon={<HugeiconsIcon icon={Tag01Icon} size={20} />}
        title="Customer Tags"
        description="Create and manage tags to segment customers for campaigns and analysis."
        actions={
          canConfigure && (
            <Button
              onClick={() => setEditing(null)}
              className="shrink-0 whitespace-nowrap"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} /> Add tag
            </Button>
          )
        }
      />
      {summary.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {summary.error}
        </p>
      )}
      <Tabs tabs={VIEWS} value={view} onChange={setView} />
      {view === "tags" && (
        <AllTagsView
          key={version}
          summary={summary.data ?? undefined}
          canConfigure={canConfigure}
          onEdit={setEditing}
          onOpenTag={(t) => {
            setTagFilter(t.id);
            setView("tagging");
          }}
          onChanged={changed}
        />
      )}
      {view === "tagging" && (
        <CustomerTaggingView
          key={version}
          currency={"INR"}
          summary={summary.data ?? undefined}
          tags={tags.data ?? []}
          canEdit={canEdit}
          tagFilter={tagFilter}
          onTagFilter={setTagFilter}
          onChanged={() => {
            summary.reload();
            tags.reload();
          }}
        />
      )}
      {view === "rules" && (
        <TagRulesView
          tags={tags.data ?? []}
          canConfigure={canConfigure}
          creating={creatingRule}
          onCreatingDone={() => setCreatingRule(false)}
          onChanged={changed}
        />
      )}
      {editing !== undefined && (
        <TagFormModal
          key={editing?.id ?? "new"}
          open
          tag={editing ?? null}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            changed();
          }}
        />
      )}
    </PortalShell>
  );
}
