"use client";

import {
  Add01Icon,
  Briefcase01Icon,
  CheckmarkCircle02Icon,
  CrownIcon,
  GiftIcon,
  MoreHorizontalIcon,
  Notification01Icon,
  Search01Icon,
  Settings02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  CheckLine,
  HistoryList,
  StatCard,
  StatusPill,
  TierCrown,
  ViewHeader,
} from "@/components/crm/membership/parts";
import { RuleModal } from "@/components/crm/rules/RuleModal";
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
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { Tabs } from "@/components/erp-ui/Tabs";
import { type CrmSettings } from "@/lib/erp/crm";
import { erp, formatMoney, fromMinor, toMinor, useErpQuery } from "@/lib/erp/erp";
import {
  TIER_LABEL,
  type HistoryEntry,
  type Overview,
  type QualificationRule,
  type RulesResponse,
} from "@/lib/erp/membership";
import {
  FREQUENCY_LABEL,
  describeAction,
  describeConditions,
  type CrmRule,
  type RuleRun,
} from "@/lib/erp/rules";
import { toast } from "@/lib/toast";

type SubTab = "qualification" | "automations" | "history";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "qualification", label: "Qualification Rules" },
  { key: "automations", label: "Automations" },
  { key: "history", label: "History" },
];
const TIER_KEYS = ["silver", "gold", "platinum"] as const;

function qualIcon(r: QualificationRule) {
  const key = r.id.replace("system:", "");
  if (key === "silver" || key === "gold" || key === "platinum")
    return <TierCrown tier={key} size={32} />;
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-tint text-success">
      <HugeiconsIcon
        icon={key === "inactive" ? Briefcase01Icon : UserIcon}
        size={16}
      />
    </span>
  );
}

const APPLIES_LABEL: Record<string, string> = {
  all: "All customers",
  previous: "Previous tier members only",
  except_platinum: "All members except Platinum",
  except_gold_platinum: "Regular and Silver members only",
};
const ACTION_LABEL: Record<string, string> = {
  inactive: "Mark as Inactive",
  regular: "Move back to Regular",
};

const pillFor = (status: CrmRule["status"]) =>
  status === "active" ? "active" : status === "draft" ? "draft" : "paused";

/** Membership > Rules: how tiers are earned (points, plus optional minimum spend and orders), automations that really run (points,
 * follow-ups), and the history of changes. */
export function RulesView({
  currency,
  canConfigure,
  onChanged,
}: {
  currency: string;
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const data = useErpQuery<RulesResponse>("/api/v1/crm/membership/rules");
  const plans = useErpQuery<Overview>("/api/v1/crm/membership/overview");
  const [sub, setSub] = useState<SubTab>("qualification");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editingQual, setEditingQual] = useState<QualificationRule | null>(
    null,
  );
  const [qual, setQual] = useState({
    name: "",
    value: "",
    spend: "",
    orders: "",
    status: "active" as "active" | "paused",
    applies: "all",
    action: "inactive",
  });
  const [automation, setAutomation] = useState<CrmRule | "new" | null>(null);
  const [removing, setRemoving] = useState<CrmRule | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useErpQuery<HistoryEntry[]>(
    sub === "history" ? "/api/v1/crm/membership/history" : null,
  );
  const k = data.data?.kpis;
  const term = search.trim().toLowerCase();
  const qualRows = (data.data?.qualification ?? []).filter((r) =>
    `${r.name} ${r.trigger_text} ${r.action_text}`.toLowerCase().includes(term),
  );
  const autoRows = (data.data?.automations ?? []).filter(
    (r) =>
      `${r.name} ${describeConditions(r.conditions, r.match)} ${describeAction(r.action)}`
        .toLowerCase()
        .includes(term) &&
      (!status || r.status === status),
  );

  const reload = () => {
    data.reload();
    plans.reload();
    onChanged();
  };

  function openQual(r: QualificationRule) {
    setQual({
      name: r.name === r.default_name ? "" : r.name,
      value: r.value === null ? "" : String(r.value),
      spend: r.min_spend_minor ? fromMinor(r.min_spend_minor) : "",
      orders: r.min_orders ? String(r.min_orders) : "",
      status: r.status,
      applies: r.applies_value ?? "all",
      action: r.action_value ?? "inactive",
    });
    setEditingQual(r);
  }

  async function saveQual() {
    if (!editingQual) return;
    const key = editingQual.id.replace("system:", "");
    const body: Record<string, unknown> = {
      name: qual.name.trim(),
      ...(editingQual.pausable ? { status: qual.status } : {}),
      ...(editingQual.applies_choices.length ? { applies: qual.applies } : {}),
      ...(editingQual.action_choices.length ? { action: qual.action } : {}),
    };
    if (editingQual.field !== null) {
      const value = Number(qual.value);
      if (!Number.isInteger(value) || value < 0 || qual.value.trim() === "")
        return toast.error("Check the value", "Enter a whole number.");
      body.value = value;
      if ((TIER_KEYS as readonly string[]).includes(key)) {
        const spend = qual.spend.trim() ? toMinor(qual.spend) : 0;
        if (spend === null || spend < 0)
          return toast.error(
            "Check the spend",
            "Enter an amount, or leave it empty.",
          );
        body.min_spend_minor = spend;
        body.min_orders = qual.orders.trim() ? Number(qual.orders) : 0;
      }
    }
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/membership/rules/system/${key}`,
      "PUT",
      body,
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't save the rule", res.error);
    toast.success("Rule saved");
    setEditingQual(null);
    reload();
  }

  async function runNow(r: CrmRule) {
    const res = await erp<RuleRun>(
      `/api/v1/crm/rules/membership/${r.id}/run`,
      "POST",
    );
    if (res.error || !res.data)
      return toast.error("Couldn't run the automation", res.error ?? undefined);
    toast.success(
      "Automation ran",
      `${res.data.matched} matched · ${res.data.added} acted on`,
    );
    reload();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/rules/membership/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error)
      return toast.error("Couldn't delete the automation", res.error);
    toast.success("Automation deleted");
    setRemoving(null);
    reload();
  }

  const menuClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none";

  const qualColumns = useMemo<ColumnDef<QualificationRule, unknown>[]>(
    () => [
      {
        header: "Rule name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            {qualIcon(row.original)}
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      { header: "Applies to", cell: ({ row }) => row.original.applies_to },
      {
        header: "Trigger / condition",
        cell: ({ row }) => (
          <span className="block max-w-[300px] whitespace-normal">
            {row.original.trigger_text}
          </span>
        ),
      },
      { header: "Action", cell: ({ row }) => row.original.action_text },
      { header: "Frequency", cell: () => "Real-time" },
      {
        header: "Status",
        cell: ({ row }) => (
          <StatusPill
            status={row.original.status === "paused" ? "paused" : "active"}
          />
        ),
      },
      ...(canConfigure
        ? [
            {
              id: "actions",
              header: "Actions",
              meta: { className: "!min-w-0" },
              cell: ({ row }: { row: { original: QualificationRule } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${row.original.name}`}
                    className={menuClass}
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openQual(row.original)}>
                      Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<QualificationRule, unknown>,
          ]
        : []),
    ],
    [canConfigure],
  );

  const autoColumns = useMemo<ColumnDef<CrmRule, unknown>[]>(
    () => [
      {
        header: "Rule name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <HugeiconsIcon
                icon={
                  row.original.action.type === "award_points"
                    ? GiftIcon
                    : Notification01Icon
                }
                size={16}
              />
            </span>
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      {
        header: "Trigger / condition",
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate"
            title={describeConditions(
              row.original.conditions,
              row.original.match,
            )}
          >
            {describeConditions(row.original.conditions, row.original.match)}
          </span>
        ),
      },
      {
        header: "Action",
        cell: ({ row }) => (
          <span className="block max-w-[240px] truncate">
            {describeAction(row.original.action)}
          </span>
        ),
      },
      {
        header: "Frequency",
        cell: ({ row }) => FREQUENCY_LABEL[row.original.frequency],
      },
      {
        header: "Last run",
        cell: ({ row }) =>
          row.original.last_run_at ? (
            <span className="text-ink-600">
              {new Date(row.original.last_run_at).toLocaleDateString("en-IN")}
              <span className="block text-[12px]">
                {row.original.matched_count.toLocaleString("en-IN")} matched
              </span>
            </span>
          ) : (
            <span className="text-ink-400">Not yet</span>
          ),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusPill status={pillFor(row.original.status)} />,
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
                    className={menuClass}
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setAutomation(row.original)}
                    >
                      Edit
                    </DropdownMenuItem>
                    {row.original.status === "active" && (
                      <DropdownMenuItem onClick={() => runNow(row.original)}>
                        Run now
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
    [canConfigure],
  );

  const q = (key: string) =>
    data.data?.qualification.find((r) => r.id === `system:${key}`);
  const tierLines = (key: (typeof TIER_KEYS)[number], from: string) => {
    const r = q(key);
    return [
      `Loyalty points ≥ ${r?.value?.toLocaleString("en-IN") ?? "—"}`,
      ...(r?.min_spend_minor
        ? [`Spend since joining ≥ ${formatMoney(r.min_spend_minor, currency)}`]
        : []),
      ...(r?.min_orders
        ? [`At least ${r.min_orders.toLocaleString("en-IN")} orders`]
        : []),
      `Auto-upgrade from ${from}`,
    ];
  };
  const summary = [
    {
      tier: "regular" as const,
      lines: [
        "All registered customers are eligible",
        "Auto-assigned when the profile is complete",
      ],
    },
    { tier: "silver" as const, lines: tierLines("silver", "Regular") },
    { tier: "gold" as const, lines: tierLines("gold", "Silver") },
    { tier: "platinum" as const, lines: tierLines("platinum", "Gold") },
  ];
  const editingKey = editingQual?.id.replace("system:", "") ?? "";
  const editingTier = (TIER_KEYS as readonly string[]).includes(editingKey);

  return (
    <div>
      <ViewHeader
        title="Membership Rules"
        description="How customers qualify for Regular, Silver, Gold and Platinum, and automations that reward or follow up with members."
        action={
          canConfigure && (
            <Button
              onClick={() => {
                setSub("automations");
                setAutomation("new");
              }}
              className="shrink-0"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} /> Add automation
            </Button>
          )
        }
      />
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Rules"
          value={k ? k.total : "—"}
          icon={<HugeiconsIcon icon={GiftIcon} size={20} />}
        />
        <StatCard
          label="Active Rules"
          value={k ? k.active : "—"}
          icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />}
        />
        <StatCard
          label="Automation Actions"
          value={
            k ? k.automation_events_this_month.toLocaleString("en-IN") : "—"
          }
          hint="points given / follow-ups this month"
          icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
        />
        <StatCard
          label="Upcoming Expiry Alerts"
          value={k ? k.expiring_30d : "—"}
          hint="in next 30 days"
          icon={<HugeiconsIcon icon={Notification01Icon} size={20} />}
        />
      </div>

      <Tabs
        tabs={SUB_TABS}
        value={sub}
        onChange={setSub}
        className="!mb-space-3"
      />

      {sub !== "history" && (
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
          <span className="relative min-w-[200px] flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              placeholder="Search by rule name, condition or action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search rules"
            />
          </span>
          {sub === "automations" && (
            <Select
              value={status}
              onValueChange={setStatus}
              className="!w-auto max-md:flex-auto"
              aria-label="Status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
            </Select>
          )}
        </Card>
      )}
      {data.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {data.error}
        </p>
      )}

      <Card className="p-space-2">
        {sub === "history" ? (
          <HistoryList
            entries={history.data ?? []}
            prefixes={["rule", "tier"]}
            loading={history.loading}
          />
        ) : sub === "qualification" ? (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={qualColumns}
                data={qualRows}
                getRowId={(r) => r.id}
                loading={data.loading}
                paginate={false}
                emptyMessage={
                  data.loading ? "Loading rules…" : "No rules match."
                }
              />
            </div>
            <p className="px-space-3 py-space-3 text-[12px] text-ink-400">
              Tiers are worked out live from these settings; editing one changes
              every customer&apos;s tier at once.
            </p>
          </>
        ) : (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={autoColumns}
                data={autoRows}
                getRowId={(r) => r.id}
                loading={data.loading}
                paginate={false}
                emptyMessage={
                  data.loading
                    ? "Loading automations…"
                    : "No automations yet. Add one, e.g. a birthday bonus or a follow-up when a membership is about to expire."
                }
              />
            </div>
            <p className="px-space-3 py-space-3 text-[12px] text-ink-400">
              Automations act on members only, once per customer per period,
              when saved, daily, and after orders when set to real time.
            </p>
          </>
        )}
      </Card>

      <Card className="mt-space-4 p-space-4">
        <div className="mb-space-3 flex items-center gap-space-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <HugeiconsIcon icon={CrownIcon} size={20} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-ink-900">
              Tier Qualification Summary
            </h3>
            <p className="text-[12.5px] text-ink-600">
              How customers qualify for each membership tier and the automation
              behaviour.
            </p>
          </div>
        </div>
        <div className="grid gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((s) => {
            const plan = plans.data?.tiers.find((p) => p.tier === s.tier);
            return (
              <div
                key={s.tier}
                className="rounded-lg border border-line p-space-3"
              >
                <div className="mb-space-2 flex items-center gap-space-3">
                  <TierCrown tier={s.tier} size={40} />
                  <div>
                    <p className="font-semibold text-ink-900">
                      {TIER_LABEL[s.tier]}
                    </p>
                    <p className="text-[12px] text-ink-600">
                      {plan?.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {s.lines.map((line) => (
                    <CheckLine key={line}>{line}</CheckLine>
                  ))}
                  {(plan?.key_benefits ?? []).slice(0, 2).map((b) => (
                    <CheckLine key={b}>{b}</CheckLine>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <PointsConversion
        currency={currency}
        canConfigure={canConfigure}
        onChanged={reload}
      />

      <Modal
        open={editingQual !== null}
        onClose={() => setEditingQual(null)}
        title={`Edit rule · ${editingQual?.default_name ?? ""}`}
        description="A change applies to every customer's membership tier straight away."
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingQual(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy || (editingQual?.field != null && qual.value.trim() === "")
              }
              onClick={saveQual}
            >
              {busy ? "Saving…" : "Save rule"}
            </Button>
          </>
        }
      >
        <Field
          label="Rule name"
          htmlFor="q_name"
          hint="Shown in the rules table. Leave empty to use the default name."
        >
          <Input
            id="q_name"
            maxLength={80}
            placeholder={editingQual?.default_name}
            value={qual.name}
            onChange={(e) => setQual({ ...qual, name: e.target.value })}
          />
        </Field>

        {editingQual?.field != null && (
          <div className="mb-space-4">
            <p className="text-label mb-space-2">Condition</p>
            <div
              className={
                editingTier
                  ? "grid gap-space-3 sm:grid-cols-3"
                  : "grid gap-space-3 sm:max-w-xs"
              }
            >
              <Field
                label={
                  editingKey === "inactive"
                    ? "Days without a purchase"
                    : "Loyalty points"
                }
                htmlFor="q_value"
                required
                className="!mb-0"
              >
                <Input
                  id="q_value"
                  inputMode="numeric"
                  value={qual.value}
                  onChange={(e) =>
                    setQual({
                      ...qual,
                      value: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </Field>
              {editingTier && (
                <>
                  <Field
                    label={`Minimum spend (${currency})`}
                    htmlFor="q_spend"
                    className="!mb-0"
                  >
                    <Input
                      id="q_spend"
                      inputMode="decimal"
                      placeholder="No minimum"
                      value={qual.spend}
                      onChange={(e) =>
                        setQual({ ...qual, spend: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Minimum orders"
                    htmlFor="q_orders"
                    className="!mb-0"
                  >
                    <Input
                      id="q_orders"
                      inputMode="numeric"
                      placeholder="No minimum"
                      value={qual.orders}
                      onChange={(e) =>
                        setQual({
                          ...qual,
                          orders: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </Field>
                </>
              )}
            </div>
            <p className="mt-space-2 text-[12.5px] text-ink-600">
              {editingTier
                ? "A customer needs all of these, with spend counted since joining and net of refunds. Higher tiers can't ask for less than lower ones."
                : "A member with no purchase for this many days becomes Inactive."}
            </p>
          </div>
        )}

        <div className="mb-space-4">
          <p className="text-label mb-space-2">Status</p>
          <div
            role="radiogroup"
            aria-label="Status"
            className="grid gap-space-2 sm:grid-cols-2"
          >
            {(
              [
                ["active", "Active", "The rule is applied."],
                [
                  "paused",
                  "Paused",
                  editingKey === "inactive"
                    ? "No member becomes Inactive."
                    : "No one is awarded this tier; they stay on the tier below.",
                ],
              ] as const
            ).map(([value, label, hint]) => {
              const checked = qual.status === value;
              const locked = !editingQual?.pausable && value === "paused";
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={locked}
                  onClick={() => setQual({ ...qual, status: value })}
                  className={`flex items-start gap-space-2 rounded-lg border px-space-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    checked
                      ? "border-brand-600 bg-brand-50"
                      : "border-line hover:bg-black/[0.03]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      checked ? "border-brand-700" : "border-ink-300"
                    }`}
                  >
                    {checked && (
                      <span className="h-2 w-2 rounded-full bg-brand-700" />
                    )}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-ink-900">
                      {label}
                    </span>
                    <span className="block text-[12px] text-ink-600">
                      {hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!editingQual?.pausable && (
            <p className="mt-space-2 text-[12.5px] text-ink-600">
              This rule can&apos;t be paused: it is how membership starts.
            </p>
          )}
        </div>

        <div>
          <p className="text-label mb-space-2">Who and what</p>
          <div className="grid gap-space-3 sm:grid-cols-2">
            {editingQual && editingQual.applies_choices.length > 0 ? (
              <Field label="Applies to" className="!mb-0">
                <Select
                  value={qual.applies}
                  onValueChange={(v) => setQual({ ...qual, applies: v })}
                >
                  {editingQual.applies_choices.map((c) => (
                    <option key={c} value={c}>
                      {APPLIES_LABEL[c] ?? c}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="text-[13px]">
                <p className="text-ink-600">Applies to</p>
                <p className="font-medium text-ink-900">
                  {editingQual?.applies_to}
                </p>
              </div>
            )}
            {editingQual && editingQual.action_choices.length > 0 ? (
              <Field label="Action" className="!mb-0">
                <Select
                  value={qual.action}
                  onValueChange={(v) => setQual({ ...qual, action: v })}
                >
                  {editingQual.action_choices.map((c) => (
                    <option key={c} value={c}>
                      {ACTION_LABEL[c] ?? c}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="text-[13px]">
                <p className="text-ink-600">Action</p>
                <p className="font-medium text-ink-900">
                  {editingQual?.action_text}
                </p>
              </div>
            )}
            {editingQual?.field == null && (
              <div className="text-[13px] sm:col-span-2">
                <p className="text-ink-600">Trigger / condition</p>
                <p className="font-medium text-ink-900">
                  {editingQual?.trigger_text}
                </p>
              </div>
            )}
            <div className="text-[13px]">
              <p className="text-ink-600">Frequency</p>
              <p className="font-medium text-ink-900">Real-time</p>
            </div>
          </div>
          <p className="mt-space-2 text-[12px] text-ink-600">
            Changes apply to every customer straight away. Frequency is always
            real-time, because tiers are worked out live.
          </p>
        </div>
      </Modal>

      {automation !== null && (
        <RuleModal
          scope="membership"
          rule={automation === "new" ? null : automation}
          tags={[]}
          onClose={() => setAutomation(null)}
          onSaved={() => {
            setAutomation(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Delete this automation?"
        message={`“${removing?.name ?? ""}” will stop running. Points already given stay.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

/** How many loyalty points equal how much money when a customer redeems them (moved here from the old Membership tab). */
function PointsConversion({
  currency,
  canConfigure,
  onChanged,
}: {
  currency: string;
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const data = useErpQuery<{ settings: CrmSettings }>("/api/v1/crm/segments");
  const [points, setPoints] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = data.data?.settings;
  if (!s) return null;
  const shownAmount = amount ?? fromMinor(s.redemption_value_minor ?? 100);
  const n = Number(points ?? s.redemption_points ?? 100);
  const minor = toMinor(shownAmount);
  const valid =
    Number.isSafeInteger(n) &&
    n > 0 &&
    n <= 10 ** 9 &&
    minor !== null &&
    minor > 0 &&
    minor <= 10 ** 12 &&
    /^\d+(\.\d{1,2})?$/.test(shownAmount);

  async function save() {
    setBusy(true);
    const res = await erp("/api/v1/crm/settings", "PUT", {
      redemption_points: n,
      redemption_value_minor: minor,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't save", res.error);
    toast.success("Conversion saved");
    setPoints(null);
    setAmount(null);
    data.reload();
    onChanged();
  }

  return (
    <Card className="mt-space-4 p-space-4">
      <h3 className="mb-space-1 text-[15px] font-bold text-ink-900">
        Loyalty points to money conversion
      </h3>
      <p className="mb-space-3 text-[13px] text-ink-600">
        How many points equal a money deduction when a customer redeems them.
        This is separate from the rate at which customers earn points.
      </p>
      <div className="grid max-w-xl gap-space-3 sm:grid-cols-2">
        <Field
          label="Loyalty points"
          htmlFor="rp_points"
          hint="A positive whole number of points."
        >
          <Input
            id="rp_points"
            inputMode="numeric"
            disabled={!canConfigure || busy}
            value={points ?? String(s.redemption_points ?? 100)}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>
        <Field
          label={`Deduction amount (${currency})`}
          htmlFor="rp_amount"
          hint="The money value of those points."
        >
          <Input
            id="rp_amount"
            inputMode="decimal"
            disabled={!canConfigure || busy}
            value={shownAmount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      {valid && (
        <p className="text-[13px] font-semibold text-brand-700">
          {n.toLocaleString("en-IN")} points = {formatMoney(minor!, currency)}{" "}
          deduction.
        </p>
      )}
      {canConfigure && (
        <Button
          className="mobile-page-action mt-space-3"
          disabled={busy || !valid || (points === null && amount === null)}
          onClick={save}
        >
          Save conversion
        </Button>
      )}
    </Card>
  );
}
