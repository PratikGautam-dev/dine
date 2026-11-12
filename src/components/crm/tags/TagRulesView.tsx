"use client";

import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  File01Icon,
  MoreHorizontalIcon,
  Search01Icon,
  Settings02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { StatCard, StatusPill } from "@/components/crm/membership/parts";
import { ConditionBuilder } from "@/components/crm/rules/ConditionBuilder";
import { RuleModal } from "@/components/crm/rules/RuleModal";
import { TagChip, TagTile } from "@/components/crm/tags/TagChip";
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
import { Select } from "@/components/erp-ui/Select";
import { formatDate } from "@/lib/erp/crm";
import { erp, useErpQuery } from "@/lib/erp/erp";
import {
  conditionReady,
  defaultCondition,
  describeConditions,
  type Condition,
  type CrmRule,
  type Match,
  type RuleList,
  type RuleRun,
} from "@/lib/erp/rules";
import type { CustomerTag } from "@/lib/erp/tags";
import { toast } from "@/lib/toast";

const TYPES = [
  "Order-based",
  "Recency-based",
  "Date-based",
  "Behaviour-based",
  "Customer attribute",
];

/** Customers > Tags > Tag Rules: "IF conditions THEN tag", run on save, after orders (real-time) and daily. */
export function TagRulesView({
  tags,
  canConfigure,
  creating,
  onCreatingDone,
  onChanged,
}: {
  tags: CustomerTag[];
  canConfigure: boolean;
  /** The page's "Create rule" button was pressed (with a tag when it came from a new rule-based tag). */
  creating: false | { tag_id?: string };
  onCreatingDone: () => void;
  onChanged: () => void;
}) {
  const data = useErpQuery<RuleList>("/api/v1/crm/rules?scope=tag");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<CrmRule | null>(null);
  const [start, setStart] = useState<{
    conditions: Condition[];
    match: Match;
    tag_id: string;
  } | null>(null);
  const [removing, setRemoving] = useState<CrmRule | null>(null);
  const [busy, setBusy] = useState(false);
  // the quick builder at the bottom (as in the reference)
  const [quick, setQuick] = useState<{
    conditions: Condition[];
    match: Match;
    tag: string;
  }>({
    conditions: [defaultCondition("total_spend")],
    match: "all",
    tag: "",
  });
  const tagNames = Object.fromEntries(tags.map((t) => [t.id, t.name]));
  const k = data.data?.kpis;
  const rows = (data.data?.items ?? []).filter(
    (r) =>
      `${r.name} ${r.tag_name ?? ""} ${describeConditions(r.conditions, r.match, tagNames)}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (!type || r.rule_type === type) &&
      (!status || r.status === status),
  );
  const modalOpen = creating !== false || editing !== null || start !== null;

  const changed = () => {
    data.reload();
    onChanged();
  };

  async function runNow(r: CrmRule) {
    const res = await erp<RuleRun>(`/api/v1/crm/rules/tag/${r.id}/run`, "POST");
    if (res.error || !res.data)
      return toast.error("Couldn't run the rule", res.error ?? undefined);
    toast.success(
      "Rule ran",
      `${res.data.matched} matched · ${res.data.added} tagged · ${res.data.removed} untagged`,
    );
    changed();
  }

  async function setRuleStatus(r: CrmRule, next: "active" | "paused") {
    const res = await erp(`/api/v1/crm/rules/tag/${r.id}`, "PUT", {
      name: r.name,
      description: r.description,
      conditions: r.conditions,
      match: r.match,
      tag_id: r.tag_id,
      frequency: r.frequency,
      status: next,
    });
    if (res.error) return toast.error("Couldn't change the rule", res.error);
    toast.success(next === "active" ? "Rule activated" : "Rule paused");
    changed();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp<{ tags_removed: number }>(
      `/api/v1/crm/rules/tag/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't delete the rule", res.error);
    toast.success(
      "Rule deleted",
      res.data?.tags_removed
        ? `The tag came off ${res.data.tags_removed} customers.`
        : undefined,
    );
    setRemoving(null);
    changed();
  }

  const columns = useMemo<ColumnDef<CrmRule, unknown>[]>(
    () => [
      {
        header: "Rule name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-3">
            {row.original.tag_color && row.original.tag_icon && (
              <TagTile
                color={row.original.tag_color}
                icon={row.original.tag_icon}
              />
            )}
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      {
        header: "Trigger / conditions",
        cell: ({ row }) => (
          <span
            className="block max-w-[320px] truncate text-ink-600"
            title={describeConditions(
              row.original.conditions,
              row.original.match,
              tagNames,
            )}
          >
            {describeConditions(
              row.original.conditions,
              row.original.match,
              tagNames,
            )}
          </span>
        ),
      },
      {
        header: "Resulting tag",
        cell: ({ row }) =>
          row.original.tag_name &&
          row.original.tag_color &&
          row.original.tag_icon ? (
            <TagChip
              name={row.original.tag_name}
              color={row.original.tag_color}
              icon={row.original.tag_icon}
            />
          ) : (
            "—"
          ),
      },
      {
        header: "Rule type",
        cell: ({ row }) => (
          <span className="text-ink-600">{row.original.rule_type}</span>
        ),
      },
      {
        header: "Last run",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {row.original.last_run_at
              ? formatDate(row.original.last_run_at)
              : "Not yet"}
            {row.original.last_run_at && (
              <span className="block text-[12px]">
                {row.original.matched_count.toLocaleString("en-IN")} matched
              </span>
            )}
          </span>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "paused" ? (
            <StatusPill status="paused" />
          ) : row.original.status === "draft" ? (
            <StatusPill status="draft" />
          ) : row.original.tag_status !== "active" ? (
            <StatusPill status="paused" label="Tag inactive" />
          ) : (
            <StatusPill status="active" />
          ),
      },
      ...(canConfigure
        ? [
            {
              id: "actions",
              header: "Actions",
              meta: { className: "!min-w-0" },
              cell: ({ row }: { row: { original: CrmRule } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${row.original.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setEditing(row.original)}>
                      Edit
                    </DropdownMenuItem>
                    {row.original.status === "active" && (
                      <DropdownMenuItem onClick={() => runNow(row.original)}>
                        Run now
                      </DropdownMenuItem>
                    )}
                    {row.original.status === "active" ? (
                      <DropdownMenuItem
                        onClick={() => setRuleStatus(row.original, "paused")}
                      >
                        Pause
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => setRuleStatus(row.original, "active")}
                      >
                        Activate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<CrmRule, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canConfigure, tags],
  );

  return (
    <div>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Rules"
          value={k ? k.total : "—"}
          hint="tagging rules created"
          icon={<HugeiconsIcon icon={File01Icon} size={20} />}
        />
        <StatCard
          label="Active Rules"
          value={k ? k.active : "—"}
          hint={
            k
              ? `${k.active - k.active_last_month >= 0 ? "+" : ""}${k.active - k.active_last_month} vs last month`
              : undefined
          }
          icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />}
        />
        <StatCard
          label="Auto-Tag Events"
          value={k ? k.events_this_month.toLocaleString("en-IN") : "—"}
          hint="tags given this month"
          icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
        />
        <StatCard
          label="Customers Matched"
          value={k ? k.customers_matched.toLocaleString("en-IN") : "—"}
          hint="carry a rule's tag now"
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
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
            placeholder="Search by rule name, condition or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search rules"
          />
        </span>
        <Select
          value={type}
          onValueChange={setType}
          className="!w-auto max-md:flex-auto"
          aria-label="Rule type"
        >
          <option value="">All rule types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onValueChange={setStatus}
          className="!w-auto max-md:flex-auto"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
        </Select>
      </Card>
      {data.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {data.error}
        </p>
      )}
      <Card className="mb-space-4 p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            loading={data.loading}
            paginate={false}
            emptyMessage={
              data.loading
                ? "Loading rules…"
                : "No tag rules yet. Build one below."
            }
          />
        </div>
        <p className="px-space-3 py-space-3 text-[12.5px] text-ink-600">
          Showing {rows.length ? `1–${rows.length}` : "0"} of{" "}
          {data.data?.items.length ?? 0} rules
        </p>
      </Card>

      {canConfigure && (
        <Card className="p-space-4">
          <h2 className="flex items-center gap-space-2 text-[16px] font-bold text-ink-900">
            <HugeiconsIcon
              icon={Settings02Icon}
              size={18}
              className="text-brand-700"
            />{" "}
            Rule Builder
          </h2>
          <p className="mb-space-3 text-[13px] text-ink-600">
            Build a rule and see how many customers it would tag.
          </p>
          <div className="grid gap-space-3 xl:grid-cols-[1.4fr_auto_1fr] xl:items-start">
            <div>
              <p className="mb-space-2 text-[12px] font-bold tracking-wide text-ink-600 uppercase">
                If these conditions are met
              </p>
              <ConditionBuilder
                conditions={quick.conditions}
                match={quick.match}
                tags={tags}
                onChange={(conditions, match) =>
                  setQuick({ ...quick, conditions, match })
                }
              />
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={20}
              className="hidden self-center text-ink-400 xl:block"
            />
            <div className="space-y-space-3">
              <p className="text-[12px] font-bold tracking-wide text-ink-600 uppercase">
                Then assign this tag
              </p>
              <Select
                value={quick.tag}
                onValueChange={(tag) => setQuick({ ...quick, tag })}
                aria-label="Tag"
              >
                <option value="">Choose a tag…</option>
                {tags
                  .filter((t) => t.kind !== "system")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
              <Button
                className="w-full"
                disabled={!quick.tag || !quick.conditions.every(conditionReady)}
                onClick={() =>
                  setStart({
                    conditions: quick.conditions,
                    match: quick.match,
                    tag_id: quick.tag,
                  })
                }
              >
                Create rule
              </Button>
            </div>
          </div>
        </Card>
      )}

      {modalOpen && (
        <RuleModal
          scope="tag"
          rule={editing}
          start={
            start ??
            (creating && creating.tag_id
              ? { tag_id: creating.tag_id }
              : undefined)
          }
          tags={tags}
          onClose={() => {
            setEditing(null);
            setStart(null);
            onCreatingDone();
          }}
          onSaved={() => {
            setEditing(null);
            setStart(null);
            onCreatingDone();
            changed();
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Delete “${removing?.name ?? ""}”?`}
        message="The tag comes off the customers this rule gave it to. Tags given by hand stay."
        confirmLabel="Delete rule"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
