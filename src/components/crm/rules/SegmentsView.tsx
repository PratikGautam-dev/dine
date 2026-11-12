"use client";

import {
  ChartBarLineIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  UserGroupIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/crm/membership/parts";
import { Avatar, SegmentBadge } from "@/components/crm/shared";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { DataTable } from "@/components/erp-ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Pager } from "@/components/erp-ui/Pager";
import { Select } from "@/components/erp-ui/Select";
import { formatDate, type CrmCustomer, type CrmSummary } from "@/lib/erp/crm";
import { erp, formatMoney, qs, useErpQuery } from "@/lib/erp/erp";
import {
  describeConditions,
  segmentUsesField,
  type ConditionField,
  type SavedSegment,
} from "@/lib/erp/rules";
import type { CustomerTag } from "@/lib/erp/tags";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

/** Customers > Segments: saved groups of customers defined by conditions, counted live; a campaign can be sent to one. */
export function SegmentsView({
  currency,
  canConfigure,
  onEdit,
  onChanged,
}: {
  currency: string;
  canConfigure: boolean;
  onEdit: (segment: SavedSegment) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const segments = useErpQuery<SavedSegment[]>("/api/v1/crm/customer-segments");
  const tags = useErpQuery<CustomerTag[]>("/api/v1/crm/tags");
  const [search, setSearch] = useState("");
  const [uses, setUses] = useState("");
  const [kind, setKind] = useState("");
  const [state, setState] = useState("");
  const [viewing, setViewing] = useState<SavedSegment | null>(null);
  const [removing, setRemoving] = useState<SavedSegment | null>(null);
  const [busy, setBusy] = useState(false);
  const tagList = tags.data ?? [];
  const tagNames = Object.fromEntries(tagList.map((t) => [t.id, t.name]));
  const all = segments.data ?? [];
  const usesField = (s: SavedSegment, field: string) =>
    segmentUsesField(s.conditions, field as ConditionField);
  const rows = all.filter(
    (s) =>
      `${s.name} ${s.description ?? ""} ${describeConditions(s.conditions, s.match, tagNames)}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (!kind || s.kind === kind) &&
      (!state || s.status === state) &&
      (!uses || usesField(s, uses === "membership" ? "tier" : "has_tag")),
  );

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/customer-segments/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't delete the segment", res.error);
    toast.success(`“${removing.name}” deleted`);
    setRemoving(null);
    segments.reload();
    onChanged();
  }

  const columns = useMemo<ColumnDef<SavedSegment, unknown>[]>(
    () => [
      {
        header: "Segment Name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <HugeiconsIcon
              icon={UserMultiple02Icon}
              size={16}
              className="shrink-0 text-brand-700"
            />
            <span>
              <span className="block font-semibold text-ink-900">
                {row.original.name}
              </span>
              {row.original.description && (
                <span className="block text-[12px] text-ink-600">
                  {row.original.description}
                </span>
              )}
            </span>
          </span>
        ),
      },
      {
        header: "Segment Type",
        cell: ({ row }) => (
          <span className="rounded-full bg-brand-50 px-space-2 py-0.5 text-[12px] font-medium text-brand-700">
            {row.original.kind === "static" ? "Static" : "Dynamic"}
          </span>
        ),
      },
      {
        header: "Condition Summary",
        cell: ({ row }) => {
          const text = describeConditions(
            row.original.conditions,
            row.original.match,
            tagNames,
          );
          return (
            <span
              className="block max-w-[380px] truncate text-ink-600"
              title={text}
            >
              {text}
            </span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "draft" ? (
            <span className="rounded-full bg-ink-50 px-space-2 py-0.5 text-[12px] font-medium text-ink-700">
              Draft
            </span>
          ) : (
            <span className="rounded-full bg-success-tint px-space-2 py-0.5 text-[12px] font-medium text-success">
              Active
            </span>
          ),
      },
      {
        header: "Customer Count",
        meta: { className: "text-right" },
        cell: ({ row }) => (
          <span className="block text-right font-semibold text-ink-900">
            {row.original.member_count.toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        header: "Created",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            {canConfigure && (
              <button
                type="button"
                aria-label={`Edit ${row.original.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(row.original);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
              </button>
            )}
            {/* the menu is inside a clickable row: neither its button nor its items (which render in a portal, but still bubble through React) may also open the row */}
            <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Actions for ${row.original.name}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setViewing(row.original)}>
                    View customers
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/portal/campaigns")}
                  >
                    Send a campaign
                  </DropdownMenuItem>
                  {canConfigure && (
                    <DropdownMenuItem onClick={() => onEdit(row.original)}>
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canConfigure && (
                    <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canConfigure, tagList],
  );

  return (
    <div>
      <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
        <span className="relative min-w-[200px] flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by segment name or condition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search segments"
          />
        </span>
        <Select
          value={kind}
          onValueChange={setKind}
          className="!w-auto max-md:!w-[calc(50%-0.25rem)] max-md:!px-space-2 max-md:text-[13px]"
          aria-label="Segment type"
        >
          <option value="">
            <span className="md:hidden">Type: All</span>
            <span className="max-md:hidden">Segment Type: All</span>
          </option>
          <option value="dynamic">Dynamic</option>
          <option value="static">Static</option>
        </Select>
        <Select
          value={state}
          onValueChange={setState}
          className="!w-auto max-md:!w-[calc(50%-0.25rem)] max-md:!px-space-2 max-md:text-[13px]"
          aria-label="Status"
        >
          <option value="">Status: All</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </Select>
        <Select
          value={uses}
          onValueChange={setUses}
          className="!w-auto max-md:flex-auto"
          aria-label="Uses"
        >
          <option value="">Membership &amp; Tags: All</option>
          <option value="membership">Uses Membership</option>
          <option value="tags">Uses Tags</option>
        </Select>
        <button
          type="button"
          aria-label="Refresh"
          onClick={() => {
            segments.reload();
            onChanged();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink-700 hover:bg-black/[0.04]"
        >
          <HugeiconsIcon icon={RefreshIcon} size={16} />
        </button>
      </Card>
      {segments.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {segments.error}
        </p>
      )}
      <Card className="p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(s) => s.id}
            loading={segments.loading}
            paginate={false}
            onRowClick={(s) => setViewing(s)}
            emptyMessage={
              segments.loading
                ? "Loading segments…"
                : "No segments yet. Create one, e.g. customers who spent over ₹20,000 or haven't bought in 60 days."
            }
          />
        </div>
        <p className="px-space-3 py-space-3 text-[12.5px] text-ink-600">
          Counts are worked out afresh each time this page loads. Pick a segment
          as a campaign&apos;s audience in Campaigns.
        </p>
      </Card>

      {viewing && (
        <SegmentCustomers
          segment={viewing}
          currency={currency}
          onClose={() => setViewing(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Delete “${removing?.name ?? ""}”?`}
        message="Customers aren't changed. Campaigns already sent to it keep their history."
        confirmLabel="Delete segment"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

const PAGE = 25;

function SegmentCustomers({
  segment,
  currency,
  onClose,
}: {
  segment: SavedSegment;
  currency: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={segment.name}
      description={describeConditions(segment.conditions, segment.match)}
    >
      <SegmentCustomerList segment={segment} currency={currency} />
    </Modal>
  );
}

/** The customers in one segment right now, searchable and paged (used in the dialog and in the Customers in Segment tab). */
export function SegmentCustomerList({
  segment,
  currency,
}: {
  segment: SavedSegment;
  currency: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(0);
  const list = useErpQuery<{ total: number; items: CrmCustomer[] }>(
    `/api/v1/crm/customer-segments/${segment.id}/customers${qs({ q, limit: PAGE, offset: page * PAGE })}`,
  );
  const rows = list.data?.items ?? [];
  return (
    <>
      <Input
        placeholder="Search by name, phone or email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        className="mb-space-3"
        aria-label="Search customers"
      />
      {list.error && (
        <p className="mb-space-2 text-[13px] font-medium text-error">
          {list.error}
        </p>
      )}
      <div className="divide-y divide-line rounded-lg border border-line">
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push(`/portal/customers/${c.id}`)}
            className="flex w-full items-center gap-space-3 px-space-3 py-space-2 text-left hover:bg-black/[0.02]"
          >
            <Avatar name={c.name} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink-900">
                {c.name || "Unnamed"}
              </span>
              <span className="block truncate text-[12px] text-ink-600">
                {c.phone ?? c.email ?? "—"}
              </span>
            </span>
            <SegmentBadge segment={c.segment} />
            <span className="hidden w-28 text-right text-[13px] text-ink-700 sm:block">
              {formatMoney(c.total_spent_minor, currency)}
            </span>
            <span className="hidden w-20 text-right text-[13px] text-ink-600 sm:block">
              {c.total_orders} orders
            </span>
          </button>
        ))}
        {!list.loading && rows.length === 0 && (
          <p className="p-space-3 text-[13px] text-ink-400">
            No customers match right now.
          </p>
        )}
        {list.loading && (
          <p className="p-space-3 text-[13px] text-ink-400">Loading…</p>
        )}
      </div>
      <Pager
        page={page}
        pageSize={PAGE}
        total={list.data?.total ?? 0}
        noun="customers"
        onPage={setPage}
      />
    </>
  );
}

/** The banner and the four counts above the Segments tabs. */
export function SegmentsOverview() {
  const segments = useErpQuery<SavedSegment[]>("/api/v1/crm/customer-segments");
  const summary = useErpQuery<CrmSummary>("/api/v1/crm/summary");
  const all = segments.data ?? [];
  const usesField = (s: SavedSegment, field: string) =>
    segmentUsesField(s.conditions, field as ConditionField);
  const largest = all.reduce<SavedSegment | null>(
    (best, s) => (!best || s.member_count > best.member_count ? s : best),
    null,
  );
  return (
    <>
      {/* on a phone the icon sits beside the title and the description runs the full width below; from md up the icon is on the left, centred on both lines */}
      <div className="mb-space-4 grid grid-cols-[auto_1fr] items-center gap-x-space-3 gap-y-space-2 rounded-xl border border-line bg-brand-50 p-space-3 md:gap-x-space-4 md:gap-y-0 md:p-space-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 md:row-span-2 md:h-11 md:w-11">
          <HugeiconsIcon icon={ChartBarLineIcon} size={20} />
        </span>
        <p className="text-[15px] font-bold leading-snug text-ink-900">
          Dynamic customer audiences for smarter campaigns
        </p>
        <p className="text-[13px] text-ink-700 max-md:col-span-2 md:col-start-2">
          Build segments from Membership tiers, Tags, spend and behaviour, then
          use them as a campaign&apos;s audience.
        </p>
      </div>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Segments"
          value={segments.data ? all.length : "—"}
          icon={<HugeiconsIcon icon={ChartBarLineIcon} size={20} />}
        />
        <StatCard
          label="Using Membership"
          value={
            segments.data ? all.filter((s) => usesField(s, "tier")).length : "—"
          }
          hint="segments with a tier condition"
          icon={<HugeiconsIcon icon={UserMultiple02Icon} size={20} />}
        />
        <StatCard
          label="Using Tags"
          value={
            segments.data
              ? all.filter((s) => usesField(s, "has_tag")).length
              : "—"
          }
          hint="segments with a tag condition"
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
        <StatCard
          label="Largest Segment"
          value={largest ? largest.name : "—"}
          hint={
            largest
              ? `${largest.member_count.toLocaleString("en-IN")} of ${(summary.data?.total_customers ?? 0).toLocaleString("en-IN")} customers`
              : undefined
          }
          icon={<HugeiconsIcon icon={UserMultiple02Icon} size={20} />}
        />
      </div>
    </>
  );
}
