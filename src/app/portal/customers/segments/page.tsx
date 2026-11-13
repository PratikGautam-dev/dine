"use client";

import {
  ChartBarLineIcon,
  FilterHorizontalIcon,
  Layers01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { SegmentBuilder } from "@/components/crm/rules/SegmentBuilder";
import {
  CustomersInSegment,
  SegmentAnalytics,
} from "@/components/crm/rules/SegmentInsights";
import {
  SegmentsOverview,
  SegmentsView,
} from "@/components/crm/rules/SegmentsView";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { cn } from "@/lib/cn";
import type { SavedSegment } from "@/lib/erp/rules";
import { hasTenantWide, useStaffSession } from "@/lib/erp/staffAuth";

type Tab = "all" | "builder" | "customers" | "analytics";
const TABS = [
  { key: "all", label: "All Segments", icon: Layers01Icon },
  { key: "builder", label: "Segment Builder", icon: FilterHorizontalIcon },
  { key: "customers", label: "Customers in Segment", icon: UserMultiple02Icon },
  { key: "analytics", label: "Analytics", icon: ChartBarLineIcon },
] as const;

/** Customers > Segments: saved groups built from Membership, Tags and behaviour. */
export default function CustomerSegmentsPage() {
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const [tab, setTab] = useState<Tab>("all");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<SavedSegment | null>(null);
  if (!ready) return null;
  const canConfigure = hasTenantWide(session, "segments:manage");
  const currency = "INR";
  const openBuilder = (segment: SavedSegment | null) => {
    setEditing(segment);
    setTab("builder");
  };
  return (
    <PortalShell restaurant={tenant} active="customers-segments">
      <PageHeader
        icon={<HugeiconsIcon icon={ChartBarLineIcon} size={20} />}
        title="Customer Segments"
        description="Segments combine membership, tags and behaviour to build campaign-ready audiences."
      />
      <SegmentsOverview key={version} />
      <div
        role="tablist"
        className="no-scrollbar mb-space-4 flex gap-space-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => {
              if (t.key === "builder") setEditing(null);
              setTab(t.key);
            }}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-space-2 rounded-t-lg border-b-2 px-space-4 py-space-2 text-[14px] font-semibold transition-colors",
              tab === t.key
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-transparent text-ink-600 hover:text-ink-900",
            )}
          >
            <HugeiconsIcon icon={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "all" && (
        <SegmentsView
          currency={currency}
          canConfigure={canConfigure}
          onEdit={openBuilder}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
      {tab === "builder" &&
        (canConfigure ? (
          <SegmentBuilder
            key={editing?.id ?? "new"}
            segment={editing}
            onSaved={() => {
              setVersion((v) => v + 1);
              setEditing(null);
              setTab("all");
            }}
            onCancel={() => {
              setEditing(null);
              setTab("all");
            }}
          />
        ) : (
          <p className="text-[13px] text-ink-600">
            You don&apos;t have permission to create segments.
          </p>
        ))}
      {tab === "customers" && <CustomersInSegment currency={currency} />}
      {tab === "analytics" && <SegmentAnalytics />}
    </PortalShell>
  );
}
