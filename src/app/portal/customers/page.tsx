"use client";

import {
  Add01Icon,
  CrownIcon,
  RepeatIcon,
  ShoppingCart01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { AddCustomerModal } from "@/components/crm/AddCustomerModal";
import { InsightsTab } from "@/components/crm/InsightsTab";
import { AddFollowUpModal } from "@/components/crm/AddFollowUpModal";
import { FollowUpsTab } from "@/components/crm/FollowUpsTab";
import { CustomersTab } from "@/components/crm/CustomersTab";
import { KpiTile } from "@/components/crm/shared";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/erp-ui/Button";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { Tabs } from "@/components/erp-ui/Tabs";
import type { CrmSummary } from "@/lib/erp/crm";
import { formatMoney, useErpQuery } from "@/lib/erp/erp";
import { hasGrant, hasPermission, useStaffSession } from "@/lib/erp/staffAuth";

/** Customers > All Customers. Membership, Tags and Campaigns are their own pages in the sidebar; this page keeps the customer list, the
 * open follow-ups and the customer insights. */
type Tab = "customers" | "follow-ups" | "insights";
const TABS: { key: Tab; label: string }[] = [
  { key: "customers", label: "Customers" },
  { key: "follow-ups", label: "Follow-ups" },
  { key: "insights", label: "Insights" },
];

export default function CustomersPage() {
  const { restaurant: tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const summary = useErpQuery<CrmSummary>("/api/v1/crm/summary");
  const [tab, setTab] = useState<Tab>("customers");
  const [filter, setFilter] = useState({ segment: "", tag: "" });
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [followVersion, setFollowVersion] = useState(0);
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const canCreate = hasPermission(session, "customers", "write");
  // enrolling a member and tagging are separate changes to a customer
  const canEnrich =
    !session || hasGrant(session, "customers:update");
  const currency = "INR";
  const s = summary.data;

  if (!ready) return null;

  const changed = () => {
    summary.reload();
    setVersion((v) => v + 1);
  };

  return (
    <PortalShell restaurant={tenant} active="customers">
      <PageHeader
        icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        title="All Customers"
        description="Manage your customers, build relationships and increase repeat sales."
        actionsClassName="w-full justify-end md:w-auto"
        actions={
          canCreate && tab === "follow-ups" ? (
            <Button
              onClick={() => setAddingFollowUp(true)}
              className="shrink-0 whitespace-nowrap"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} className="shrink-0" />{" "}
              Add follow-up
            </Button>
          ) : (
            canCreate &&
            tab === "customers" && (
              <Button
                onClick={() => setOpen(true)}
                className="shrink-0 whitespace-nowrap"
              >
                <HugeiconsIcon
                  icon={UserAdd01Icon}
                  size={16}
                  className="shrink-0"
                />{" "}
                Add customer
              </Button>
            )
          )
        }
      />
      {summary.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {summary.error}
        </p>
      )}
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "customers" && (
        <>
          <div className="mb-space-4 grid grid-cols-2 gap-space-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile
              stacked
              label="Total customers"
              value={s?.total_customers ?? "—"}
              icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
            />
            <KpiTile
              stacked
              label="Active customers"
              value={s?.active_customers ?? "—"}
              hint="purchased in last 6 months"
              icon={<HugeiconsIcon icon={UserCheck01Icon} size={20} />}
            />
            <KpiTile
              stacked
              label="Platinum customers"
              value={s?.platinum_customers ?? "—"}
              icon={<HugeiconsIcon icon={CrownIcon} size={20} />}
            />
            <KpiTile
              stacked
              label="New customers"
              value={s?.new_this_month ?? "—"}
              hint="this month"
              icon={<HugeiconsIcon icon={UserAdd01Icon} size={20} />}
            />
            <KpiTile
              stacked
              label="Avg. purchase value"
              value={
                s ? formatMoney(s.avg_purchase_value_minor, currency) : "—"
              }
              icon={<HugeiconsIcon icon={ShoppingCart01Icon} size={20} />}
            />
            <KpiTile
              stacked
              label="Repeat customers"
              value={s ? `${s.repeat_rate_pct}%` : "—"}
              hint={s ? `${s.repeat_customers} customers` : undefined}
              icon={<HugeiconsIcon icon={RepeatIcon} size={20} />}
            />
          </div>
          <CustomersTab
            key={version}
            currency={currency}
            canEdit={canCreate}
            segment={filter.segment}
            tag={filter.tag}
            onFilterChange={(f) => setFilter((cur) => ({ ...cur, ...f }))}
            onChanged={changed}
          />
        </>
      )}
      {tab === "follow-ups" && (
        <FollowUpsTab
          canEdit={canCreate}
          reloadKey={followVersion}
          onUsers={setTeam}
          onChanged={changed}
        />
      )}
      {tab === "insights" && <InsightsTab currency={currency} />}

      {addingFollowUp && (
        <AddFollowUpModal
          users={team}
          onClose={() => setAddingFollowUp(false)}
          onAdded={() => {
            setFollowVersion((v) => v + 1);
            changed();
          }}
        />
      )}
      {open && (
        <AddCustomerModal
          canEnrich={canEnrich}
          onClose={() => setOpen(false)}
          onAdded={changed}
        />
      )}
    </PortalShell>
  );
}
