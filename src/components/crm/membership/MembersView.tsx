"use client";

import {
  Clock01Icon,
  MoneyBag02Icon,
  MoreHorizontalIcon,
  Search01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserAdd01Icon,
  CrownIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CheckLine,
  HistoryList,
  StatCard,
  StatusPill,
  TierCrown,
  TierPill,
  ViewHeader,
} from "@/components/crm/membership/parts";
import { Avatar } from "@/components/crm/shared";
import { CustomerSelect } from "@/components/erp/CustomerSelect";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { DataTable } from "@/components/erp-ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Pager } from "@/components/erp-ui/Pager";
import { Select } from "@/components/erp-ui/Select";
import { Tabs } from "@/components/erp-ui/Tabs";
import {
  erp,
  formatDateTime,
  formatMoney,
  qs,
  useErpQuery,
  type Customer,
} from "@/lib/erp/erp";
import {
  SOURCE_LABEL,
  TIER_LABEL,
  TIERS,
  type HistoryEntry,
  type Member,
  type MembersResponse,
  type Renewal,
  type Source,
  type Tier,
} from "@/lib/erp/membership";
import { formatDate } from "@/lib/erp/crm";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

type SubTab = "all" | "expiring" | "renewals" | "history";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "all", label: "All Members" },
  { key: "expiring", label: "Expiring Soon" },
  { key: "renewals", label: "Renewals" },
  { key: "history", label: "History" },
];
const PAGE = 8;

export function MembersView({
  currency,
  canEdit,
  tierFilter,
  onTierFilter,
  onChanged,
}: {
  currency: string;
  canEdit: boolean;
  tierFilter: string;
  onTierFilter: (tier: string) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [sub, setSub] = useState<SubTab>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const listing = sub === "all" || sub === "expiring";
  const effectiveStatus = sub === "expiring" ? "expiring" : status;

  /** A different filter starts again from the first page. */
  const refilter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
    };

  const list = useErpQuery<MembersResponse>(
    listing
      ? `/api/v1/crm/membership/members${qs({
          q,
          tier: tierFilter,
          status: effectiveStatus,
          source,
          limit: PAGE,
          offset: page * PAGE,
        })}`
      : // the figures and tier summary are needed on every sub-tab
        `/api/v1/crm/membership/members?limit=1`,
  );
  const renewals = useErpQuery<Renewal[]>(
    sub === "renewals" ? "/api/v1/crm/membership/renewals" : null,
  );
  const history = useErpQuery<HistoryEntry[]>(
    sub === "history" ? "/api/v1/crm/membership/history" : null,
  );
  const [assigning, setAssigning] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [assignSource, setAssignSource] = useState<Source>("in_store");
  const [busy, setBusy] = useState(false);
  const k = list.data?.kpis;

  const reload = () => {
    list.reload();
    onChanged();
  };

  async function act(
    m: Member,
    path: string,
    method: "POST" | "PUT",
    body: unknown,
    done: string,
  ) {
    const res = await erp(
      `/api/v1/crm/membership/members/${m.id}/${path}`,
      method,
      body,
    );
    if (res.error)
      return toast.error("Couldn't update the membership", res.error);
    toast.success(done);
    reload();
  }

  async function assign() {
    if (!customer) return;
    setBusy(true);
    const res = await erp("/api/v1/crm/membership/members", "POST", {
      customer_id: customer.id,
      source: assignSource,
    });
    setBusy(false);
    if (res.error)
      return toast.error("Couldn't assign the membership", res.error);
    toast.success("Membership assigned");
    setAssigning(false);
    setCustomer(null);
    reload();
  }

  const columns = useMemo<ColumnDef<Member, unknown>[]>(
    () => [
      {
        header: "Customer",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <Avatar name={row.original.name} size={34} />
            <span className="font-semibold text-ink-900">
              {row.original.name || "Unnamed"}
            </span>
          </span>
        ),
      },
      {
        header: "Contact",
        cell: ({ row }) => (
          <span>
            <span className="block text-ink-900">
              {row.original.phone ?? "—"}
            </span>
            <span className="block text-[12px] text-ink-600">
              {row.original.email ?? ""}
            </span>
          </span>
        ),
      },
      {
        header: "Membership tier",
        cell: ({ row }) =>
          row.original.segment === "not_member" ? (
            <span className="text-ink-600">Profile incomplete</span>
          ) : (
            <TierPill tier={row.original.segment} />
          ),
      },
      {
        header: "Join date",
        cell: ({ row }) => formatDate(row.original.joined_at),
      },
      {
        header: "Expiry date",
        cell: ({ row }) =>
          row.original.expires_at ? (
            formatDate(row.original.expires_at)
          ) : (
            <span className="text-ink-400">No expiry</span>
          ),
      },
      {
        header: "Source",
        cell: ({ row }) => SOURCE_LABEL[row.original.source],
      },
      {
        header: "Eligible spend",
        cell: ({ row }) =>
          formatMoney(row.original.loyalty_spend_minor, currency),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusPill status={row.original.member_status} />,
      },
      {
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${row.original.name}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/portal/customers/${row.original.id}`);
                }}
              >
                View profile
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    void act(
                      row.original,
                      "renew",
                      "POST",
                      undefined,
                      "Membership renewed",
                    );
                  }}
                >
                  Renew
                </DropdownMenuItem>
              )}
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    void act(
                      row.original,
                      "pause",
                      "PUT",
                      { paused: !row.original.paused },
                      row.original.paused
                        ? "Membership resumed"
                        : "Membership paused",
                    );
                  }}
                >
                  {row.original.paused ? "Resume" : "Pause"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, currency, router],
  );

  const renewalColumns = useMemo<ColumnDef<Renewal, unknown>[]>(
    () => [
      {
        header: "Customer",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <Avatar name={row.original.customer_name} size={34} />
            <span className="font-semibold text-ink-900">
              {row.original.customer_name}
            </span>
          </span>
        ),
      },
      {
        header: "Membership tier",
        cell: ({ row }) => <TierPill tier={row.original.tier} />,
      },
      {
        header: "Renewal fee",
        cell: ({ row }) => formatMoney(row.original.amount_minor, currency),
      },
      {
        header: "Renewed on",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
    ],
    [currency],
  );

  return (
    <div>
      <ViewHeader
        title="Membership Members"
        description="Manage customers assigned to Regular, Silver, Gold and Platinum membership plans."
        action={
          canEdit && (
            <Button onClick={() => setAssigning(true)} className="shrink-0">
              <HugeiconsIcon icon={UserAdd01Icon} size={16} /> Assign membership
            </Button>
          )
        }
      />
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Members"
          value={k ? k.total_members.toLocaleString("en-IN") : "—"}
          delta={k?.total_delta_pct}
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
        <StatCard
          label="Active Members"
          value={k ? k.active_members.toLocaleString("en-IN") : "—"}
          hint={k ? `${k.active_pct}% of total` : undefined}
          icon={<HugeiconsIcon icon={UserCheck01Icon} size={20} />}
        />
        <StatCard
          label="Expiring This Month"
          value={k ? k.expiring_this_month.toLocaleString("en-IN") : "—"}
          icon={<HugeiconsIcon icon={Clock01Icon} size={20} />}
        />
        <StatCard
          label="Membership Revenue"
          value={k ? formatMoney(k.revenue_minor, currency) : "—"}
          delta={k?.revenue_delta_pct}
          icon={<HugeiconsIcon icon={MoneyBag02Icon} size={20} />}
        />
      </div>

      <Tabs
        tabs={SUB_TABS}
        value={sub}
        onChange={setSub}
        className="!mb-space-3"
      />

      {listing && (
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
          <span className="relative min-w-[200px] flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              placeholder="Search by customer name, email, phone or membership ID…"
              value={search}
              onChange={(e) => refilter(setSearch)(e.target.value)}
              className="pl-9"
              aria-label="Search members"
            />
          </span>
          <Select
            value={tierFilter}
            onValueChange={refilter(onTierFilter)}
            className="!w-auto max-md:flex-auto"
            aria-label="Membership tier"
          >
            <option value="">All membership tiers</option>
            {TIERS.map((t: Tier) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
          {sub === "all" && (
            <Select
              value={status}
              onValueChange={refilter(setStatus)}
              className="!w-auto max-md:flex-auto"
              aria-label="Status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring Soon</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </Select>
          )}
          <Select
            value={source}
            onValueChange={refilter(setSource)}
            className="!w-auto max-md:flex-auto"
            aria-label="Source"
          >
            <option value="">All sources</option>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Card>
      )}
      {list.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {list.error}
        </p>
      )}

      <Card className="p-space-2">
        {listing && (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={columns}
                data={list.data?.items ?? []}
                getRowId={(m) => m.id}
                onRowClick={(m) => router.push(`/portal/customers/${m.id}`)}
                loading={list.loading}
                paginate={false}
                emptyMessage={
                  list.loading ? "Loading members…" : "No members match."
                }
              />
            </div>
            <Pager
              page={page}
              pageSize={PAGE}
              total={list.data?.total ?? 0}
              noun="members"
              onPage={setPage}
            />
          </>
        )}
        {sub === "renewals" && (
          <div className="whitespace-nowrap">
            <DataTable
              columns={renewalColumns}
              data={renewals.data ?? []}
              getRowId={(r) => r.id}
              loading={renewals.loading}
              emptyMessage={renewals.loading ? "Loading…" : "No renewals yet."}
            />
          </div>
        )}
        {sub === "history" && (
          <HistoryList
            entries={history.data ?? []}
            prefixes={["assigned", "renewed", "paused", "resumed"]}
            loading={history.loading}
          />
        )}
      </Card>

      <Card className="mt-space-4 p-space-4">
        <div className="mb-space-3 flex items-center gap-space-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <HugeiconsIcon icon={CrownIcon} size={20} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-ink-900">
              Membership Tier Distribution
            </h3>
            <p className="text-[12.5px] text-ink-600">
              Overview of member distribution and key metrics for each
              membership plan.
            </p>
          </div>
        </div>
        <div className="grid gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
          {(list.data?.tier_summary ?? []).map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-line p-space-3"
            >
              <div className="mb-space-2 flex items-center gap-space-3">
                <TierCrown tier={t.tier} size={40} />
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">
                    {TIER_LABEL[t.tier]}
                  </p>
                  <p className="text-[18px] font-bold leading-tight text-ink-900">
                    {t.members.toLocaleString("en-IN")}{" "}
                    <span className="text-[14px] font-semibold">members</span>
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                <CheckLine>{t.share_pct}% of total members</CheckLine>
                <CheckLine>
                  {formatMoney(t.avg_spend_minor, currency)} average spend
                </CheckLine>
                {t.renewal_rate_pct !== null && (
                  <CheckLine>{t.renewal_rate_pct}% renewal rate</CheckLine>
                )}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={assigning}
        onClose={() => setAssigning(false)}
        title="Assign membership"
        description="The customer needs a name, phone, email and date of birth. They start on the Regular plan and move up as they earn loyalty points."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !customer} onClick={assign}>
              Assign membership
            </Button>
          </>
        }
      >
        <Field label="Customer" htmlFor="a_customer" required>
          <CustomerSelect
            id="a_customer"
            value={customer}
            onChange={setCustomer}
          />
        </Field>
        <Field label="Source" htmlFor="a_source">
          <Select
            id="a_source"
            value={assignSource}
            onValueChange={(v) => setAssignSource(v as Source)}
          >
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}
