"use client";

import {
  BarChartIcon,
  MoreHorizontalIcon,
  Search01Icon,
  Settings02Icon,
  UserGroupIcon,
  UserIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatCard, TierPill } from "@/components/crm/membership/parts";
import { Avatar, SegmentBadge } from "@/components/crm/shared";
import { TagChip } from "@/components/crm/tags/TagChip";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
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
import { cn } from "@/lib/cn";
import { SEGMENT_META, formatDate } from "@/lib/erp/crm";
import { erp, formatMoney, qs, useErpQuery } from "@/lib/erp/erp";
import { TIER_LABEL } from "@/lib/erp/membership";
import {
  SOURCE_LABEL,
  TAG_COLOR,
  type CustomerTag,
  type TagSummary,
  type TaggedCustomer,
} from "@/lib/erp/tags";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

const PAGE = 25;
const TIERS = ["regular", "silver", "gold", "platinum"] as const;
type Result = {
  updated: number;
  added: number;
  removed: number;
  skipped: number;
};

function resultText(r: Result, verb: "added" | "removed") {
  const n = verb === "added" ? r.added : r.removed;
  const base = `Tag ${verb} for ${n} customer${n === 1 ? "" : "s"}`;
  return r.skipped
    ? `${base}; ${r.skipped} skipped (the tag doesn't apply to them)`
    : base;
}

/** Customers > Tags > Customer Tagging: everyone carrying a tag, filtered and paged on the server, tagged in bulk or one at a time. */
export function CustomerTaggingView({
  currency,
  summary,
  tags,
  canEdit,
  tagFilter,
  onTagFilter,
  onChanged,
}: {
  currency: string;
  summary: TagSummary | undefined;
  tags: CustomerTag[];
  canEdit: boolean;
  tagFilter: string;
  onTagFilter: (id: string) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(0);
  const list = useErpQuery<{ total: number; items: TaggedCustomer[] }>(
    `/api/v1/crm/tagging${qs({ q, tag_id: tagFilter, status, source, tier, limit: PAGE, offset: page * PAGE })}`,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [editing, setEditing] = useState<TaggedCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const active = tags.filter((t) => t.status === "active");

  /** A filter change starts again from page 1 with nothing selected. */
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
      setSelected(new Set());
    };

  const refresh = () => {
    list.reload();
    onChanged();
  };

  async function tagging(ids: string[], add: string[], remove: string[]) {
    setBusy(true);
    const res = await erp<Result>("/api/v1/crm/tagging", "POST", {
      customer_ids: ids,
      add,
      remove,
    });
    setBusy(false);
    if (res.error || !res.data) {
      toast.error("Couldn't change tags", res.error ?? undefined);
      return null;
    }
    return res.data;
  }

  async function bulk(verb: "added" | "removed") {
    if (!bulkTag || selected.size === 0) return;
    const r = await tagging(
      [...selected],
      verb === "added" ? [bulkTag] : [],
      verb === "removed" ? [bulkTag] : [],
    );
    if (!r) return;
    toast.success(resultText(r, verb));
    setSelected(new Set());
    refresh();
  }

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns = useMemo<ColumnDef<TaggedCustomer, unknown>[]>(
    () => [
      ...(canEdit
        ? [
            {
              id: "select",
              meta: { className: "!min-w-0 w-8" },
              header: () => (
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  className="h-4 w-4 accent-[var(--color-brand-700)]"
                  checked={allOnPage}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      for (const r of rows) {
                        if (allOnPage) next.delete(r.id);
                        else next.add(r.id);
                      }
                      return next;
                    })
                  }
                />
              ),
              cell: ({ row }) => (
                <input
                  type="checkbox"
                  aria-label={`Select ${row.original.name}`}
                  className="h-4 w-4 accent-[var(--color-brand-700)]"
                  checked={selected.has(row.original.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(row.original.id)}
                />
              ),
            } satisfies ColumnDef<TaggedCustomer, unknown>,
          ]
        : []),
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
        header: "Phone / Email",
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
        header: "Membership",
        cell: ({ row }) =>
          (TIERS as readonly string[]).includes(row.original.segment) ? (
            <TierPill tier={row.original.segment as (typeof TIERS)[number]} />
          ) : (
            <SegmentBadge segment={row.original.segment} />
          ),
      },
      {
        header: "Current tags",
        cell: ({ row }) => (
          <span className="flex max-w-[380px] flex-wrap gap-1">
            {row.original.tags.slice(0, 3).map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} icon={t.icon} />
            ))}
            {row.original.tags.length > 3 && (
              <span
                className="self-center text-[11px] font-semibold text-ink-600"
                title={row.original.tags
                  .slice(3)
                  .map((t) => t.name)
                  .join(", ")}
              >
                +{row.original.tags.length - 3}
              </span>
            )}
          </span>
        ),
      },
      {
        header: "Tag source",
        cell: ({ row }) => (
          <span className="flex items-center gap-1 text-ink-600">
            <HugeiconsIcon
              icon={
                row.original.tag_source === "manual" ? UserIcon : Settings02Icon
              }
              size={14}
            />
            {SOURCE_LABEL[row.original.tag_source]}
          </span>
        ),
      },
      {
        header: "Last purchase",
        cell: ({ row }) =>
          row.original.last_order_at ? (
            <span>
              <span className="block text-ink-900">
                {formatDate(row.original.last_order_at)}
              </span>
              {row.original.last_order_minor !== null && (
                <span className="block text-[12px] text-ink-600">
                  {formatMoney(row.original.last_order_minor, currency)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-ink-400">—</span>
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
        // the menu sits in a clickable row: neither its button nor its items (rendered in a portal, but still bubbling through React) may also open the row
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => (
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
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/portal/customers/${row.original.id}`)
                  }
                >
                  Open customer
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditing(row.original)}>
                    Edit tags
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, currency, rows, selected, allOnPage],
  );

  const tierTotal = TIERS.reduce((n, t) => n + (summary?.by_tier[t] ?? 0), 0);

  return (
    <div>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Tagged Customers"
          value={
            summary ? summary.tagged_customers.toLocaleString("en-IN") : "—"
          }
          hint={
            summary
              ? `${summary.tagged_this_month.toLocaleString("en-IN")} new this month`
              : undefined
          }
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
        <StatCard
          label="Auto-tagged Customers"
          value={summary ? summary.auto_tagged.toLocaleString("en-IN") : "—"}
          hint="by rules or the system"
          icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
        />
        <StatCard
          label="Manually Tagged"
          value={
            summary ? summary.manually_tagged.toLocaleString("en-IN") : "—"
          }
          icon={<HugeiconsIcon icon={UserIcon} size={20} />}
        />
        <StatCard
          label="Multi-tag Customers"
          value={summary ? summary.multi_tagged.toLocaleString("en-IN") : "—"}
          hint="carry two or more tags"
          icon={<HugeiconsIcon icon={UserMultiple02Icon} size={20} />}
        />
      </div>

      <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
        <span className="relative min-w-[220px] flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by customer name, phone or email…"
            value={search}
            onChange={(e) => filter(setSearch)(e.target.value)}
            className="pl-9"
            aria-label="Search customers"
          />
        </span>
        <Select
          value={tagFilter}
          onValueChange={filter(onTagFilter)}
          className="!w-auto max-md:flex-auto"
          aria-label="Tag"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onValueChange={filter(setStatus)}
          className="!w-auto max-md:flex-auto"
          aria-label="Status"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
        <Select
          value={source}
          onValueChange={filter(setSource)}
          className="!w-auto max-md:flex-auto"
          aria-label="Source"
        >
          <option value="">All sources</option>
          <option value="manual">Manual</option>
          <option value="auto">Auto-tagged</option>
          <option value="system">System</option>
        </Select>
        <Select
          value={tier}
          onValueChange={filter(setTier)}
          className="!w-auto max-md:flex-auto"
          aria-label="Membership"
        >
          <option value="">All memberships</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
          <option value="inactive">Inactive</option>
          <option value="not_member">Not a member</option>
        </Select>
      </Card>

      {canEdit && selected.size > 0 && (
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 border-brand-200 bg-brand-50 p-space-3">
          <span className="text-[13.5px] font-semibold text-ink-900">
            {selected.size} selected
          </span>
          <Select
            value={bulkTag}
            onValueChange={setBulkTag}
            className="!w-auto max-md:flex-auto"
            aria-label="Tag to add or remove"
          >
            <option value="">Choose a tag…</option>
            {active.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button disabled={busy || !bulkTag} onClick={() => bulk("added")}>
            Add tag
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !bulkTag}
            onClick={() => bulk("removed")}
          >
            Remove tag
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </Card>
      )}

      {list.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {list.error}
        </p>
      )}
      <Card className="mb-space-4 p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(c) => c.id}
            loading={list.loading}
            paginate={false}
            onRowClick={(c) => router.push(`/portal/customers/${c.id}`)}
            emptyMessage={
              list.loading ? "Loading customers…" : "No tagged customers match."
            }
          />
        </div>
        <Pager
          page={page}
          pageSize={PAGE}
          total={total}
          noun="customers"
          onPage={setPage}
        />
      </Card>

      <Card className="p-space-4">
        <h2 className="flex items-center gap-space-2 text-[16px] font-bold text-ink-900">
          <HugeiconsIcon
            icon={BarChartIcon}
            size={18}
            className="text-brand-700"
          />{" "}
          Tagging Summary
        </h2>
        <p className="mb-space-3 text-[13px] text-ink-600">
          Tagged customers by membership tier, and the most used tags.
        </p>
        <div className="grid gap-space-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-2 gap-space-2 sm:grid-cols-4">
            {TIERS.map((t) => {
              const n = summary?.by_tier[t] ?? 0;
              return (
                <div
                  key={t}
                  className="rounded-lg border border-line p-space-3"
                >
                  <p className="text-[12.5px] text-ink-600">{TIER_LABEL[t]}</p>
                  <p className="text-[20px] font-bold text-ink-900">
                    {n.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[12px] text-ink-600">
                    {tierTotal ? Math.round((100 * n) / tierTotal) : 0}% of
                    members tagged
                  </p>
                </div>
              );
            })}
            {(summary?.by_tier.not_member ?? 0) > 0 && (
              <p className="col-span-full text-[12.5px] text-ink-600">
                Plus{" "}
                {(summary?.by_tier.not_member ?? 0).toLocaleString("en-IN")}{" "}
                tagged customers who are{" "}
                {SEGMENT_META.not_member.label.toLowerCase()}.
              </p>
            )}
          </div>
          <div>
            <p className="mb-space-2 text-[13px] font-semibold text-ink-900">
              Top used tags
            </p>
            {(summary?.top_tags ?? []).length === 0 && (
              <p className="text-[13px] text-ink-400">
                No tagged customers yet.
              </p>
            )}
            <ul className="grid gap-x-space-4 gap-y-1 sm:grid-cols-2">
              {(summary?.top_tags ?? []).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-space-2 text-[13px]"
                >
                  <span className="flex min-w-0 items-center gap-space-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        TAG_COLOR[t.color].swatch,
                      )}
                    />
                    <span className="truncate text-ink-900">{t.name}</span>
                  </span>
                  <span className="shrink-0 text-ink-600">
                    {t.customers.toLocaleString("en-IN")} customers
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {editing && (
        <EditTagsModal
          key={editing.id}
          customer={editing}
          tags={tags}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (add, remove) => {
            if (!editing) return;
            const r = await tagging([editing.id], add, remove);
            if (!r) return;
            toast.success(
              r.skipped
                ? `Tags saved; ${r.skipped} didn't apply to this customer`
                : "Tags saved",
            );
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/** One customer's tags as a checklist: inactive and draft tags they already carry can be taken off, not given. */
function EditTagsModal({
  customer,
  tags,
  busy,
  onClose,
  onSave,
}: {
  customer: TaggedCustomer | null;
  tags: CustomerTag[];
  busy: boolean;
  onClose: () => void;
  onSave: (add: string[], remove: string[]) => void;
}) {
  const had = useMemo(
    () => new Set(customer?.tags.map((t) => t.id) ?? []),
    [customer],
  );
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(had));
  const shown = tags.filter((t) => t.status === "active" || had.has(t.id));
  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title={`Tags for ${customer?.name || "this customer"}`}
      description="Tick the tags this customer should carry."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              onSave(
                [...chosen].filter((id) => !had.has(id)),
                [...had].filter((id) => !chosen.has(id)),
              )
            }
          >
            Save tags
          </Button>
        </>
      }
    >
      <div className="grid gap-space-2 sm:grid-cols-2">
        {shown.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-space-2 rounded-md px-space-2 py-1 hover:bg-black/[0.03]"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand-700)]"
              checked={chosen.has(t.id)}
              disabled={t.status !== "active" && !had.has(t.id)}
              onChange={() =>
                setChosen((s) => {
                  const next = new Set(s);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  return next;
                })
              }
            />
            <TagChip name={t.name} color={t.color} icon={t.icon} />
            {t.status !== "active" && (
              <span className="text-[11.5px] text-ink-400">{t.status}</span>
            )}
          </label>
        ))}
        {shown.length === 0 && (
          <p className="text-[13px] text-ink-400">
            No active tags. Add one in All Tags first.
          </p>
        )}
      </div>
    </Modal>
  );
}
