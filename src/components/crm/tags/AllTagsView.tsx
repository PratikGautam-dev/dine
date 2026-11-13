"use client";

import {
  MoreHorizontalIcon,
  Search01Icon,
  Tag01Icon,
  UserGroupIcon,
  UserIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { StatCard, StatusPill } from "@/components/crm/membership/parts";
import { TagTile } from "@/components/crm/tags/TagChip";
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
import { Select } from "@/components/erp-ui/Select";
import { formatDate } from "@/lib/erp/crm";
import { erp, qs, useErpQuery } from "@/lib/erp/erp";
import type { CustomerTag, TagSummary } from "@/lib/erp/tags";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

const pct = (now: number, before: number) =>
  before ? Math.round((100 * (now - before)) / before) : null;

/** Customers > Tags > All Tags: the cards, then every tag with how many customers carry it. */
export function AllTagsView({
  summary,
  canConfigure,
  onEdit,
  onOpenTag,
  onChanged,
}: {
  summary: TagSummary | undefined;
  canConfigure: boolean;
  onEdit: (tag: CustomerTag) => void;
  onOpenTag: (tag: CustomerTag) => void;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [status, setStatus] = useState("");
  const tags = useErpQuery<CustomerTag[]>(
    `/api/v1/crm/tags${qs({ q, status })}`,
  );
  const [deleting, setDeleting] = useState<CustomerTag | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = tags.data ?? [];
  const top = summary?.top_tags[0];

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const res = await erp(`/api/v1/crm/tag-records/${deleting.id}`, "DELETE");
    setBusy(false);
    if (res.error) return toast.error("Couldn't delete the tag", res.error);
    toast.success(`“${deleting.name}” deleted`);
    setDeleting(null);
    tags.reload();
    onChanged();
  }

  const columns = useMemo<ColumnDef<CustomerTag, unknown>[]>(
    () => [
      {
        header: "Tag name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-3">
            <TagTile color={row.original.color} icon={row.original.icon} />
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      {
        header: "Assignment",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {row.original.kind === "rule"
              ? "Automatic (rule)"
              : row.original.kind === "system"
                ? "System"
                : "Manual"}
          </span>
        ),
      },
      {
        header: "Customer count",
        cell: ({ row }) => row.original.customers.toLocaleString("en-IN"),
      },
      {
        header: "Description",
        cell: ({ row }) => (
          <span className="block max-w-[360px] truncate text-ink-600">
            {row.original.description ?? "—"}
          </span>
        ),
      },
      {
        header: "Created on",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <StatusPill status="active" />
          ) : row.original.status === "draft" ? (
            <StatusPill status="draft" />
          ) : (
            <StatusPill status="inactive_plan" />
          ),
      },
      {
        // the menu sits in a clickable row: neither its button nor its items (rendered in a portal, but still bubbling through React) may also open the row
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => (
          <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${row.original.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onOpenTag(row.original)}>
                  View customers
                </DropdownMenuItem>
                {canConfigure && (
                  <DropdownMenuItem onClick={() => onEdit(row.original)}>
                    Edit tag
                  </DropdownMenuItem>
                )}
                {canConfigure && row.original.kind !== "system" && (
                  <DropdownMenuItem onClick={() => setDeleting(row.original)}>
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canConfigure],
  );

  return (
    <div>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Tags"
          value={summary ? summary.total_tags.toLocaleString("en-IN") : "—"}
          icon={<HugeiconsIcon icon={Tag01Icon} size={20} />}
        />
        <StatCard
          label="Tagged Customers"
          value={
            summary ? summary.tagged_customers.toLocaleString("en-IN") : "—"
          }
          delta={
            summary
              ? pct(summary.tagged_this_month, summary.tagged_last_month)
              : undefined
          }
          hint={
            summary
              ? `${summary.tagged_this_month.toLocaleString("en-IN")} new this month`
              : undefined
          }
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
        <StatCard
          label="Most Used Tag"
          value={top ? top.name : "—"}
          hint={
            top
              ? `${top.customers.toLocaleString("en-IN")} customers`
              : undefined
          }
          icon={<HugeiconsIcon icon={UserIcon} size={20} />}
        />
        <StatCard
          label="Tags Created"
          value={
            summary
              ? summary.tags_created_this_month.toLocaleString("en-IN")
              : "—"
          }
          hint="this month"
          icon={<HugeiconsIcon icon={PlusSignIcon} size={20} />}
        />
      </div>
      <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
        <span className="relative min-w-[200px] flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by tag name, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search tags"
          />
        </span>
        <Select
          value={status}
          onValueChange={setStatus}
          className="!w-auto max-md:flex-auto"
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Card>
      {tags.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {tags.error}
        </p>
      )}
      <Card className="p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(t) => t.id}
            loading={tags.loading}
            paginate={false}
            onRowClick={(t) => onOpenTag(t)}
            emptyMessage={
              tags.loading
                ? "Loading tags…"
                : q || status
                  ? "No tags match."
                  : "No tags yet. Add one to start grouping customers."
            }
          />
        </div>
        <p className="px-space-3 py-space-3 text-[12.5px] text-ink-600">
          Showing {rows.length ? `1–${rows.length}` : "0"} of {rows.length} tags
        </p>
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ""}”?`}
        message={
          deleting?.customers
            ? `It comes off ${deleting.customers.toLocaleString("en-IN")} customer${deleting.customers === 1 ? "" : "s"}. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete tag"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
