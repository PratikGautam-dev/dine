"use client";

import {
  Add01Icon,
  CheckmarkCircle02Icon,
  CrownIcon,
  Link01Icon,
  MoreHorizontalIcon,
  Search01Icon,
  UserGroupIcon,
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
import { erp, useErpQuery } from "@/lib/erp/erp";
import {
  BENEFIT_TIERS,
  BENEFIT_TYPE,
  TIER_LABEL,
  type Benefit,
  type BenefitTier,
  type BenefitType,
  type BenefitsResponse,
  type HistoryEntry,
  type MembersResponse,
  type Overview,
} from "@/lib/erp/membership";
import { toast } from "@/lib/toast";

type SubTab = "overview" | "mapping" | "usage" | "history";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Benefits Overview" },
  { key: "mapping", label: "Tier Mapping" },
  { key: "usage", label: "Usage Analytics" },
  { key: "history", label: "History" },
];

type Form = {
  name: string;
  type: BenefitType;
  usage: string;
  status: "active" | "draft";
  tiers: Partial<Record<BenefitTier, string>>;
};
const EMPTY: Form = {
  name: "",
  type: "loyalty_reward",
  usage: "",
  status: "active",
  tiers: {},
};

const bodyOf = (b: Benefit | Form) => ({
  name: b.name,
  benefit_type: "benefit_type" in b ? b.benefit_type : b.type,
  usage_limit: ("usage_limit" in b ? b.usage_limit : b.usage) || null,
  status: b.status,
  tiers: b.tiers,
});

export function BenefitsView({
  canConfigure,
  onChanged,
}: {
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const data = useErpQuery<BenefitsResponse>("/api/v1/crm/membership/benefits");
  const [sub, setSub] = useState<SubTab>("overview");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [tier, setTier] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Benefit | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [removing, setRemoving] = useState<Benefit | null>(null);
  const [busy, setBusy] = useState(false);
  const usage = useErpQuery<MembersResponse>(
    sub === "usage" ? "/api/v1/crm/membership/members?limit=1" : null,
  );
  const plans = useErpQuery<Overview>("/api/v1/crm/membership/overview");
  const history = useErpQuery<HistoryEntry[]>(
    sub === "history" ? "/api/v1/crm/membership/history" : null,
  );
  const k = data.data?.kpis;
  const all = data.data?.items ?? [];

  const rows = all.filter(
    (b) =>
      b.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!type || b.benefit_type === type) &&
      (!tier || tier in b.tiers) &&
      (!status || b.status === status),
  );

  const reload = () => {
    data.reload();
    plans.reload();
    onChanged();
  };

  function openEdit(b: Benefit | "new") {
    setForm(
      b === "new"
        ? EMPTY
        : {
            name: b.name,
            type: b.benefit_type,
            usage: b.usage_limit ?? "",
            status: b.status,
            tiers: b.tiers,
          },
    );
    setEditing(b);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const res =
      editing === "new"
        ? await erp("/api/v1/crm/membership/benefits", "POST", bodyOf(form))
        : await erp(
            `/api/v1/crm/membership/benefits/${editing.id}`,
            "PUT",
            bodyOf(form),
          );
    setBusy(false);
    if (res.error) return toast.error("Couldn't save the benefit", res.error);
    toast.success(editing === "new" ? "Benefit added" : "Benefit saved");
    setEditing(null);
    reload();
  }

  async function toggleTier(b: Benefit, t: BenefitTier, on: boolean) {
    const tiers = { ...b.tiers };
    if (on) tiers[t] = tiers[t] ?? "";
    else delete tiers[t];
    const res = await erp(`/api/v1/crm/membership/benefits/${b.id}`, "PUT", {
      ...bodyOf(b),
      tiers,
    });
    if (res.error) return toast.error("Couldn't update the mapping", res.error);
    reload();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/membership/benefits/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't delete the benefit", res.error);
    toast.success("Benefit deleted");
    setRemoving(null);
    reload();
  }

  const columns = useMemo<ColumnDef<Benefit, unknown>[]>(
    () => [
      {
        header: "Benefit name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <HugeiconsIcon
                icon={BENEFIT_TYPE[row.original.benefit_type].icon}
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
        header: "Benefit type",
        cell: ({ row }) => BENEFIT_TYPE[row.original.benefit_type].label,
      },
      ...BENEFIT_TIERS.map((t): ColumnDef<Benefit, unknown> => ({
        id: t,
        header: TIER_LABEL[t],
        cell: ({ row }) => {
          if (!(t in row.original.tiers))
            return <span className="text-ink-400">–</span>;
          const value = row.original.tiers[t];
          return value ? (
            <span className="text-ink-900">{value}</span>
          ) : (
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={18}
              className="text-success"
            />
          );
        },
      })),
      {
        header: "Usage / limit",
        cell: ({ row }) =>
          row.original.usage_limit ?? <span className="text-ink-400">—</span>,
      },
      {
        header: "Status",
        cell: ({ row }) => (
          <StatusPill
            status={row.original.status === "active" ? "active" : "draft"}
          />
        ),
      },
      ...(canConfigure
        ? [
            {
              id: "actions",
              header: "Actions",
              meta: { className: "!min-w-0" },
              cell: ({ row }: { row: { original: Benefit } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${row.original.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openEdit(row.original)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<Benefit, unknown>,
          ]
        : []),
    ],
    [canConfigure],
  );

  return (
    <div>
      <ViewHeader
        title="Membership Benefits"
        description="Configure benefits and privileges for Regular, Silver, Gold and Platinum memberships."
        action={
          canConfigure && (
            <Button onClick={() => openEdit("new")} className="shrink-0">
              <HugeiconsIcon icon={Add01Icon} size={16} /> Add benefit
            </Button>
          )
        }
      />
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Benefits"
          value={k ? k.total : "—"}
          icon={<HugeiconsIcon icon={CrownIcon} size={20} />}
        />
        <StatCard
          label="Active Benefits"
          value={k ? k.active : "—"}
          icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />}
        />
        <StatCard
          label="Tier-linked Benefits"
          value={k ? k.tier_links : "—"}
          hint="total mappings"
          icon={<HugeiconsIcon icon={Link01Icon} size={20} />}
        />
        <StatCard
          label="Members Using Benefits"
          value={k ? k.members_using.toLocaleString("en-IN") : "—"}
          hint={
            k ? `of ${k.members.toLocaleString("en-IN")} members` : undefined
          }
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
      </div>

      <Tabs
        tabs={SUB_TABS}
        value={sub}
        onChange={setSub}
        className="!mb-space-3"
      />

      {sub === "overview" && (
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
          <span className="relative min-w-[200px] flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              placeholder="Search by benefit name, type or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search benefits"
            />
          </span>
          <Select
            value={type}
            onValueChange={setType}
            className="!w-auto max-md:!w-[calc(50%-0.25rem)] max-md:!px-space-2 max-md:text-[13px]"
            aria-label="Benefit type"
          >
            <option value="">
              <span className="md:hidden">All types</span>
              <span className="max-md:hidden">All benefit types</span>
            </option>
            {(Object.keys(BENEFIT_TYPE) as BenefitType[]).map((t) => (
              <option key={t} value={t}>
                {BENEFIT_TYPE[t].label}
              </option>
            ))}
          </Select>
          <Select
            value={tier}
            onValueChange={setTier}
            className="!w-auto max-md:!w-[calc(50%-0.25rem)] max-md:!px-space-2 max-md:text-[13px]"
            aria-label="Membership tier"
          >
            <option value="">
              <span className="md:hidden">All tiers</span>
              <span className="max-md:hidden">All membership tiers</span>
            </option>
            {BENEFIT_TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onValueChange={setStatus}
            className="!w-auto max-md:flex-auto"
            aria-label="Status"
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </Select>
        </Card>
      )}
      {data.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {data.error}
        </p>
      )}

      <Card className="p-space-2">
        {sub === "overview" && (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={columns}
                data={rows}
                getRowId={(b) => b.id}
                loading={data.loading}
                paginate={false}
                emptyMessage={
                  data.loading
                    ? "Loading benefits…"
                    : all.length
                      ? "No benefits match."
                      : "No benefits yet. Add one to start."
                }
              />
            </div>
            <p className="px-space-3 py-space-3 text-[12.5px] text-ink-600">
              Showing {rows.length ? `1–${rows.length}` : "0"} of {all.length}{" "}
              benefits
            </p>
          </>
        )}
        {sub === "mapping" && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase text-ink-600">
                  <th className="px-space-3 py-space-2">Benefit</th>
                  {BENEFIT_TIERS.map((t) => (
                    <th key={t} className="px-space-3 py-space-2 text-center">
                      {TIER_LABEL[t]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {all.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-space-3 py-space-2 font-semibold text-ink-900">
                      {b.name}
                    </td>
                    {BENEFIT_TIERS.map((t) => (
                      <td key={t} className="px-space-3 py-space-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!canConfigure}
                          checked={t in b.tiers}
                          aria-label={`${b.name} for ${TIER_LABEL[t]}`}
                          onChange={(e) => toggleTier(b, t, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {!all.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-space-3 py-space-6 text-center text-ink-600"
                    >
                      No benefits yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {sub === "usage" && (
          <div className="grid gap-space-3 p-space-3 sm:grid-cols-2 xl:grid-cols-4">
            {BENEFIT_TIERS.map((t) => {
              const members =
                usage.data?.tier_summary.find((s) => s.tier === t)?.members ??
                0;
              const offered = all.filter(
                (b) => b.status === "active" && t in b.tiers,
              ).length;
              return (
                <div
                  key={t}
                  className="rounded-lg border border-line p-space-3"
                >
                  <div className="flex items-center gap-space-2">
                    <TierCrown tier={t} size={34} />
                    <p className="font-semibold text-ink-900">
                      {TIER_LABEL[t]}
                    </p>
                  </div>
                  <p className="mt-space-2 text-[22px] font-bold text-ink-900">
                    {members.toLocaleString("en-IN")}
                    <span className="text-[13px] font-semibold text-ink-600">
                      {" "}
                      members
                    </span>
                  </p>
                  <p className="text-[13px] text-ink-600">
                    {offered} active benefit{offered === 1 ? "" : "s"} offered
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {sub === "history" && (
          <HistoryList
            entries={history.data ?? []}
            prefixes={["benefit"]}
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
              Tier Benefit Summary
            </h3>
            <p className="text-[12.5px] text-ink-600">
              Quick overview of key benefits for each membership plan.
            </p>
          </div>
        </div>
        <div className="grid gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data.data?.summary ?? []).map((s) => (
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
                    {
                      plans.data?.tiers.find((p) => p.tier === s.tier)
                        ?.description
                    }
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                {s.benefits.map((b) => (
                  <CheckLine key={b.name}>
                    {b.value ? `${b.value} ${b.name.toLowerCase()}` : b.name}
                  </CheckLine>
                ))}
                {!s.benefits.length && (
                  <li className="text-[13px] text-ink-600">No benefits yet</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add benefit" : "Edit benefit"}
        description="Choose which membership tiers get this benefit. A value (like 1.25x) is optional."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !form.name.trim()} onClick={save}>
              {editing === "new" ? "Add benefit" : "Save"}
            </Button>
          </>
        }
      >
        <Field label="Benefit name" htmlFor="b_name" required>
          <Input
            id="b_name"
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid gap-space-3 sm:grid-cols-2">
          <Field label="Benefit type" htmlFor="b_type">
            <Select
              id="b_type"
              value={form.type}
              onValueChange={(v) =>
                setForm({ ...form, type: v as BenefitType })
              }
            >
              {(Object.keys(BENEFIT_TYPE) as BenefitType[]).map((t) => (
                <option key={t} value={t}>
                  {BENEFIT_TYPE[t].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Usage / limit"
            htmlFor="b_usage"
            hint="e.g. Once on join, 1 / year, Unlimited"
          >
            <Input
              id="b_usage"
              maxLength={60}
              value={form.usage}
              onChange={(e) => setForm({ ...form, usage: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Tiers" htmlFor="b_tiers">
          <div id="b_tiers" className="space-y-space-2">
            {BENEFIT_TIERS.map((t) => (
              <div key={t} className="flex items-center gap-space-3">
                <label className="flex w-28 items-center gap-space-2 text-[14px]">
                  <input
                    type="checkbox"
                    checked={t in form.tiers}
                    onChange={(e) => {
                      const tiers = { ...form.tiers };
                      if (e.target.checked) tiers[t] = "";
                      else delete tiers[t];
                      setForm({ ...form, tiers });
                    }}
                  />
                  {TIER_LABEL[t]}
                </label>
                <Input
                  aria-label={`Value for ${TIER_LABEL[t]}`}
                  placeholder="Value (optional)"
                  disabled={!(t in form.tiers)}
                  value={form.tiers[t] ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tiers: { ...form.tiers, [t]: e.target.value },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Field>
        <Field
          label="Status"
          htmlFor="b_status"
          hint="A draft isn't shown as offered to members."
        >
          <Select
            id="b_status"
            value={form.status}
            onValueChange={(v) =>
              setForm({ ...form, status: v as Form["status"] })
            }
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title="Delete this benefit?"
        message={`“${removing?.name ?? ""}” is removed from every membership tier.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
