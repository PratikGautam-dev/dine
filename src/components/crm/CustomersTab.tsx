"use client";

import {
  Message01Icon,
  MoreHorizontalIcon,
  Search01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, ComposeModal, SegmentBadge } from "@/components/crm/shared";
import { Badge } from "@/components/erp-ui/Badge";
import { Card } from "@/components/erp-ui/Card";
import { DataTable } from "@/components/erp-ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Input } from "@/components/erp-ui/Input";
import { Select } from "@/components/erp-ui/Select";
import {
  SEGMENT_META,
  SEGMENT_ORDER,
  formatDate,
  type CrmCustomer,
} from "@/lib/erp/crm";
import { formatMoney, qs, useErpQuery } from "@/lib/erp/erp";
import type { SavedSegment } from "@/lib/erp/rules";
import { useDebounced } from "@/lib/erp/useDebounced";

export function CustomersTab({
  currency,
  canEdit,
  segment,
  tag,
  onFilterChange,
  onChanged,
}: {
  currency: string;
  canEdit: boolean;
  segment: string;
  tag: string;
  onFilterChange: (f: { segment?: string; tag?: string }) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const [status, setStatus] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const savedSegments = useErpQuery<SavedSegment[]>(
    "/api/v1/crm/customer-segments",
  );
  const list = useErpQuery<{ total: number; items: CrmCustomer[] }>(
    `/api/v1/crm/customers${qs({ q: query, segment, tag, status, segment_id: segmentId, limit: 200 })}`,
  );
  const tags =
    useErpQuery<{ tag: string; customers: number }[]>("/api/v1/crm/tags");
  const [composeFor, setComposeFor] = useState<CrmCustomer | null>(null);

  const rows = list.data?.items ?? [];
  const reload = () => {
    list.reload();
    tags.reload();
    onChanged();
  };

  const columns = useMemo<ColumnDef<CrmCustomer, unknown>[]>(
    () => [
      {
        header: "Customer",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <Avatar name={row.original.name} size={32} />
            <span>
              <span className="block font-semibold leading-tight text-ink-900">
                {row.original.name || "Unnamed"}
              </span>
              <span className="block text-[11px] text-ink-400">
                {row.original.customer_code ?? "—"}
              </span>
            </span>
          </span>
        ),
      },
      {
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ?? <span className="text-ink-400">—</span>,
      },
      {
        header: "Tags / Membership",
        cell: ({ row }) => {
          const extra = row.original.tags;
          return (
            <span className="flex flex-nowrap items-center gap-space-1">
              <SegmentBadge segment={row.original.segment} />
              {extra.slice(0, 1).map((t) => (
                <Badge key={t} tone="clay" className="normal-case">
                  {t}
                </Badge>
              ))}
              {extra.length > 1 && (
                <span
                  className="text-[11px] font-semibold text-ink-600"
                  title={extra.slice(1).join(", ")}
                >
                  +{extra.length - 1}
                </span>
              )}
            </span>
          );
        },
      },
      {
        header: "Purchase amount",
        cell: ({ row }) =>
          formatMoney(row.original.total_spent_minor, currency),
      },
      { header: "Orders", cell: ({ row }) => row.original.total_orders },
      {
        header: "Last purchase",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {formatDate(row.original.last_order_at)}
          </span>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) => (
          <Badge tone={row.original.status === "active" ? "success" : "error"}>
            {row.original.status}
          </Badge>
        ),
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
                <HugeiconsIcon icon={UserIcon} size={15} /> View profile
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setComposeFor(row.original);
                  }}
                >
                  <HugeiconsIcon icon={Message01Icon} size={15} /> Send message
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canEdit, currency, router],
  );

  return (
    <div>
      <div className="min-w-0">
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
          <span className="relative min-w-[200px] flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              placeholder="Search by customer ID, name, phone or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search customers"
            />
          </span>
          <Select
            value={segment}
            onValueChange={(value) => onFilterChange({ segment: value })}
            className="!w-auto max-md:flex-auto"
            aria-label="Membership"
          >
            <option value="">All memberships</option>
            {SEGMENT_ORDER.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_META[s].label}
              </option>
            ))}
          </Select>
          <Select
            value={tag}
            onValueChange={(value) => onFilterChange({ tag: value })}
            className="!w-auto max-md:flex-auto"
            aria-label="Tag"
          >
            <option value="">All tags</option>
            {(tags.data ?? []).map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag} ({t.customers})
              </option>
            ))}
          </Select>
          {(savedSegments.data ?? []).some(
            (g) => g.status === "active" && g.show_in_filters,
          ) && (
            <Select
              value={segmentId}
              onValueChange={setSegmentId}
              className="!w-auto max-md:flex-auto"
              aria-label="Segment"
            >
              <option value="">All segments</option>
              {(savedSegments.data ?? [])
                .filter((g) => g.status === "active" && g.show_in_filters)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
          )}
          <Select
            value={status}
            onValueChange={(value) => setStatus(value)}
            className="!w-auto max-md:flex-auto"
            aria-label="Status"
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </Card>
        {list.error && (
          <p className="mb-space-3 text-[13px] font-medium text-error">
            {list.error}
          </p>
        )}
        <Card className="p-space-2">
          <div className="whitespace-nowrap">
            <DataTable
              columns={columns}
              data={rows}
              getRowId={(c) => c.id}
              onRowClick={(c) => router.push(`/portal/customers/${c.id}`)}
              loading={list.loading}
              pageSize={15}
              emptyMessage={
                list.loading ? "Loading customers…" : "No customers match."
              }
            />
          </div>
        </Card>
      </div>

      <ComposeModal
        customer={composeFor}
        onClose={() => setComposeFor(null)}
        onSent={reload}
      />
    </div>
  );
}
