"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Add01Icon,
  Calendar03Icon,
  MoreHorizontalIcon,
  Search01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { OfferFormModal } from "@/components/offers/OfferFormModal";
import {
  ChannelIcon,
  ChannelUsage,
  KIND_LABEL,
  OfferActivity,
  OfferKpis,
  StagePill,
  TypeDonut,
  UsageCell,
  stageOf,
} from "@/components/offers/offerView";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/erp-ui/Button";
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
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { Select } from "@/components/erp-ui/Select";
import { useBranchFilter } from "@/lib/branchContext";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { useOffers, type Offer } from "@/hooks/useOffers";

export default function PortalOffersPage() {
  const { restaurant, ready } = usePortalGuard();
  const { data, error, creating, createOffer, editOffer, deleteOffer, toggleOffer } =
    useOffers(ready);
  const { branches } = useBranchFilter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [removing, setRemoving] = useState<Offer | null>(null);
  const [allActivity, setAllActivity] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("");
  const [openedAt] = useState(() => Date.now());

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const day = 86_400_000;
    const within = (iso: string, from: number, to: number) => {
      const t = Date.parse(iso);
      return t >= from && t - from <= to;
    };
    return (data?.offers ?? []).filter(
      (o) =>
        (!statusFilter ||
          (statusFilter === "paused" ? o.status === "disabled" : o.status === statusFilter)) &&
        (!typeFilter || o.discount_type === typeFilter) &&
        (!channelFilter || !o.fulfillment_type || o.fulfillment_type === channelFilter) &&
        (!branchFilter || !o.branch_ids.length || o.branch_ids.includes(branchFilter)) &&
        (!rangeFilter ||
          (rangeFilter === "now" && o.status === "active") ||
          (rangeFilter === "ending" && within(o.valid_to, openedAt, 30 * day)) ||
          (rangeFilter === "starting" && within(o.valid_from, openedAt, 30 * day))) &&
        (!q || [o.name, o.coupon_code, o.discount_type].some((v) => v.toLowerCase().includes(q))),
    );
  }, [data, search, statusFilter, typeFilter, channelFilter, branchFilter, rangeFilter, openedAt]);

  const columns = useMemo<ColumnDef<Offer, unknown>[]>(
    () => [
      {
        header: "Discount Name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <HugeiconsIcon icon={Tag01Icon} size={16} className="shrink-0 text-brand-700" />
            <span className="min-w-0">
              <span className="block font-semibold text-ink-900">{row.original.name}</span>
              {row.original.branch_ids.length > 0 && (
                <span className="block max-w-[240px] truncate text-[12px] text-ink-600">
                  {row.original.branch_ids
                    .map((id) => branches.find((b) => b.id === id)?.name ?? "Unknown branch")
                    .join(", ")}
                </span>
              )}
            </span>
          </span>
        ),
      },
      { header: "Status", cell: ({ row }) => <StagePill stage={stageOf(row.original)} /> },
      {
        header: "Code",
        cell: ({ row }) => (
          <span className="rounded-md bg-ink-50 px-space-2 py-0.5 font-mono text-[12px] text-ink-800">
            {row.original.coupon_code}
          </span>
        ),
      },
      {
        header: "Type",
        cell: ({ row }) => (
          <span className="rounded-md bg-ink-50 px-space-2 py-0.5 text-[12px] font-medium text-ink-800">
            {KIND_LABEL[row.original.discount_type]}
          </span>
        ),
      },
      {
        header: "Value",
        cell: ({ row }) =>
          row.original.discount_type === "percentage"
            ? `${row.original.discount_value}%`
            : rupees(row.original.discount_value),
      },
      {
        header: "Food Item Eligibility",
        cell: () => <span className="text-ink-700">All food items</span>,
      },
      {
        header: "Customer Eligibility",
        cell: ({ row }) => (
          <span className="text-ink-700">
            {row.original.per_customer_limit != null
              ? `All customers · ${row.original.per_customer_limit} per guest`
              : "All customers"}
          </span>
        ),
      },
      { header: "Channels", cell: ({ row }) => <ChannelIcon offer={row.original} /> },
      {
        header: "Validity",
        cell: ({ row }) => (
          <span className="text-ink-700">
            {formatDate(row.original.valid_from)} – {formatDate(row.original.valid_to)}
          </span>
        ),
      },
      { header: "Usage", cell: ({ row }) => <UsageCell o={row.original} /> },
      {
        id: "actions",
        header: "Actions",
        meta: {
          className:
            "!min-w-0 sticky right-0 z-[1] bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
        },
        cell: ({ row }) => (
          <PermissionGate page="offers" action="write">
            <div className="flex items-center justify-end gap-space-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`More actions for ${row.original.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleOffer(row.original)}>
                    {row.original.is_active ? "Pause" : "Resume"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PermissionGate>
        ),
      } as ColumnDef<Offer, unknown>,
    ],
    [branches, toggleOffer],
  );

  const all = useMemo(() => data?.offers ?? [], [data]);

  return (
    <PortalShell restaurant={restaurant} active="offers">
      <PageHeader
        icon={<HugeiconsIcon icon={Tag01Icon} size={20} />}
        title="Discounts"
        description="Manage and configure discounts for food orders, customers, and campaigns."
        actionsClassName="w-full justify-end md:w-auto"
        actions={
          <PermissionGate page="offers" action="write">
            <Button onClick={() => setEditing("new")}>
              <HugeiconsIcon icon={Add01Icon} size={16} /> Add Discount
            </Button>
          </PermissionGate>
        }
      />
      <OfferKpis list={data?.offers} />
      {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
      {editing && (
        <OfferFormModal
          key={editing === "new" ? "new" : editing.id}
          open
          busy={creating}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(fields, active) =>
            editing === "new" ? createOffer(fields, active) : editOffer(editing, fields, active)
          }
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Remove discount?"
        message={`“${removing?.name ?? ""}” will be removed. If it has already been used on orders it is switched off instead.`}
        confirmLabel="Remove"
        destructive
        busy={false}
        onConfirm={async () => {
          if (removing) await deleteOffer(removing);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />

      <Card className="mb-space-3 flex flex-wrap items-end gap-space-3 p-space-3 max-md:grid max-md:grid-cols-2 xl:flex-nowrap md:[&_button_svg]:hidden">
        <span className="relative min-w-[200px] flex-1 basis-0 self-end max-md:col-span-2 max-md:min-w-0">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by name, code, or keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search offers"
          />
        </span>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
          Status
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="!w-[125px] max-md:!w-full max-md:!px-space-2"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
          Discount Type
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
            className="!w-[135px] max-md:!w-full max-md:!px-space-2"
            aria-label="Discount type"
          >
            <option value="">All types</option>
            <option value="percentage">Percentage off</option>
            <option value="flat">Flat amount off</option>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
          Channel
          <Select
            value={channelFilter}
            onValueChange={setChannelFilter}
            className="!w-[130px] max-md:!w-full max-md:!px-space-2"
            aria-label="Channel"
          >
            <option value="">All channels</option>
            <option value="pickup">Takeaway</option>
            <option value="dine_in">Dine in</option>
            <option value="delivery">Delivery</option>
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
          Branch
          <Select
            value={branchFilter}
            onValueChange={setBranchFilter}
            className="!w-[135px] max-md:!w-full max-md:!px-space-2"
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
          Date Range
          <span className="relative max-md:block">
            <HugeiconsIcon
              icon={Calendar03Icon}
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-ink-600"
            />
            <Select
              value={rangeFilter}
              onValueChange={setRangeFilter}
              className="!w-[145px] !pl-9 max-md:!w-full"
              aria-label="Date range"
            >
              <option value="">All time</option>
              <option value="now">Running now</option>
              <option value="ending">Ends within 30 days</option>
              <option value="starting">Starts within 30 days</option>
            </Select>
          </span>
        </label>
      </Card>

      <Card className="p-space-2">
        <div className="whitespace-nowrap [&_td]:px-[5px] [&_th]:min-w-0 [&_th]:px-[5px]">
          <DataTable
            columns={columns}
            data={filteredOffers}
            getRowId={(o) => String(o.id)}
            loading={!data}
            emptyMessage={
              !data
                ? "Loading discounts…"
                : all.length
                  ? "No discounts match."
                  : "No discounts yet."
            }
          />
        </div>
      </Card>
      {all.length > 0 && (
        <div className="mt-space-4 grid gap-space-4 lg:grid-cols-3">
          <TypeDonut list={all} />
          <ChannelUsage list={all} />
          <OfferActivity
            list={all}
            all={allActivity}
            onToggle={() => setAllActivity(!allActivity)}
          />
        </div>
      )}
    </PortalShell>
  );
}
