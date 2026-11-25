"use client";

import { Layers, Plus, Puzzle, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { PageTabs } from "@/components/portal/PageTabs";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type Category,
  type ModifierGroup,
  type Station,
  useCategories,
  useDeleteRow,
  useModifierGroups,
  useSaveRow,
  useStations,
} from "@/hooks/usePosMenu";
import { useTaxRules } from "@/hooks/useTaxes";
import { fromMinor, toMinor } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

type Tab = "categories" | "groups" | "stations";

/** Food Menu > POS setup: the menu's categories (order, kitchen station, GST), add-on groups and kitchen stations, used by the POS till. */
export function PosMenuSetup({ onClose, canWrite }: { onClose: () => void; canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <Modal onClose={onClose} labelledBy="pos-setup-title" maxWidthClass="max-w-[720px]">
      <h2 id="pos-setup-title" className="text-[18px] font-bold text-ink-900">
        POS setup
      </h2>
      <p className="text-hint mb-space-3">
        How the till groups the menu, which add-ons it offers, and where each KOT prints.
      </p>
      <PageTabs
        tabs={[
          { key: "categories", label: "Categories", icon: <Layers size={14} /> },
          { key: "groups", label: "Add-on groups", icon: <Puzzle size={14} /> },
          { key: "stations", label: "Kitchen stations", icon: <UtensilsCrossed size={14} /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "categories" && <Categories canWrite={canWrite} />}
      {tab === "groups" && <Groups canWrite={canWrite} />}
      {tab === "stations" && <Stations canWrite={canWrite} />}
    </Modal>
  );
}

const errorText = (e: unknown) => (e as Error).message;

// ---- categories ---------------------------------------------------------------------------------------------------------------------
function Categories({ canWrite }: { canWrite: boolean }) {
  const categories = useCategories();
  const [adding, setAdding] = useState("");
  const save = useSaveRow<Category>("categories");
  if (categories.isPending) return <Skeleton className="h-32 w-full" />;
  if (categories.error)
    return <p className="text-[13px] text-error">{errorText(categories.error)}</p>;
  return (
    <div>
      <p className="text-hint mb-space-3">
        Renaming a category renames it everywhere, WhatsApp and the website too. A category&apos;s
        station and GST apply to its items that don&apos;t set their own.
      </p>
      <ul className="divide-y divide-line">
        {categories.data.map((c) => (
          <CategoryRow
            key={`${c.id}-${c.name}-${c.station_id}-${c.tax_code}-${c.sort_order}`}
            category={c}
            canWrite={canWrite}
          />
        ))}
      </ul>
      {categories.data.length === 0 && (
        <p className="text-[13px] text-ink-500">No categories yet.</p>
      )}
      {canWrite && (
        <form
          className="mt-space-3 flex gap-space-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            try {
              await save.mutateAsync({
                body: { name: adding.trim(), sort_order: categories.data.length },
              });
              setAdding("");
            } catch (err) {
              toast.error("Couldn't add the category", errorText(err));
            }
          }}
        >
          <Input
            placeholder="New category, e.g. Starters"
            value={adding}
            maxLength={80}
            onChange={(e) => setAdding(e.target.value)}
          />
          <Button type="submit" disabled={save.isPending}>
            <Plus size={14} /> Add
          </Button>
        </form>
      )}
    </div>
  );
}

function CategoryRow({ category, canWrite }: { category: Category; canWrite: boolean }) {
  const stations = useStations();
  const taxes = useTaxRules();
  const save = useSaveRow<Category>("categories");
  const del = useDeleteRow("categories");
  const [form, setForm] = useState({
    name: category.name,
    sort_order: String(category.sort_order),
    station_id: category.station_id ?? "",
    tax_code: category.tax_code ?? "",
  });
  const dirty =
    form.name !== category.name ||
    form.sort_order !== String(category.sort_order) ||
    form.station_id !== (category.station_id ?? "") ||
    form.tax_code !== (category.tax_code ?? "");

  async function submit() {
    try {
      await save.mutateAsync({
        id: category.id,
        body: {
          name: form.name.trim(),
          sort_order: Number(form.sort_order) || 0,
          station_id: form.station_id || null,
          tax_code: form.tax_code || null,
        },
      });
      toast.success("Category saved");
    } catch (e) {
      toast.error("Couldn't save the category", errorText(e));
    }
  }

  return (
    <li className="grid grid-cols-1 gap-space-2 py-space-3 sm:grid-cols-[1fr_64px_150px_130px_auto] sm:items-end">
      <Field
        label="Name"
        htmlFor={`cat-${category.id}`}
        className="mb-0"
        hint={`${category.item_count} item(s)`}
      >
        <Input
          id={`cat-${category.id}`}
          value={form.name}
          maxLength={80}
          disabled={!canWrite}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Order" htmlFor={`cat-o-${category.id}`} className="mb-0">
        <Input
          id={`cat-o-${category.id}`}
          type="number"
          value={form.sort_order}
          disabled={!canWrite}
          onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
        />
      </Field>
      <Field label="Station" htmlFor={`cat-s-${category.id}`} className="mb-0">
        <Select
          id={`cat-s-${category.id}`}
          className="w-full"
          value={form.station_id}
          disabled={!canWrite}
          onValueChange={(v) => setForm({ ...form, station_id: v })}
        >
          <option value="">None</option>
          {(stations.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="GST" htmlFor={`cat-t-${category.id}`} className="mb-0">
        <Select
          id={`cat-t-${category.id}`}
          className="w-full"
          value={form.tax_code}
          disabled={!canWrite}
          onValueChange={(v) => setForm({ ...form, tax_code: v })}
        >
          <option value="">Default</option>
          {(taxes.data ?? []).map((t) => (
            <option key={t.code} value={t.code}>
              {t.rate_bps / 100}%
            </option>
          ))}
        </Select>
      </Field>
      {canWrite && (
        <div className="flex gap-space-1">
          <Button type="button" disabled={!dirty || save.isPending} onClick={submit}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={`Delete ${category.name}`}
            disabled={del.isPending}
            onClick={() =>
              del.mutate(category.id, {
                onError: (e) => toast.error("Couldn't delete the category", errorText(e)),
              })
            }
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )}
    </li>
  );
}

// ---- add-on groups ------------------------------------------------------------------------------------------------------------------
type OptionForm = { id?: string; name: string; price: string; is_active: boolean };
type GroupForm = { id?: string; name: string; min: string; max: string; options: OptionForm[] };

const emptyGroup = (): GroupForm => ({
  name: "",
  min: "0",
  max: "",
  options: [{ name: "", price: "", is_active: true }],
});

function Groups({ canWrite }: { canWrite: boolean }) {
  const groups = useModifierGroups();
  const [editing, setEditing] = useState<GroupForm | null>(null);
  const del = useDeleteRow("modifier-groups");
  if (groups.isPending) return <Skeleton className="h-32 w-full" />;
  if (groups.error) return <p className="text-[13px] text-error">{errorText(groups.error)}</p>;
  if (editing) return <GroupEditor initial={editing} onDone={() => setEditing(null)} />;

  const edit = (g: ModifierGroup) =>
    setEditing({
      id: g.id,
      name: g.name,
      min: String(g.min_select),
      max: g.max_select === null ? "" : String(g.max_select),
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: fromMinor(o.price_paise),
        is_active: o.is_active,
      })),
    });

  return (
    <div>
      <p className="text-hint mb-space-3">
        A group of choices the cashier offers with an item, like &quot;Extra toppings&quot; or
        &quot;Spice level&quot;. Attach groups to items in each item&apos;s POS section.
      </p>
      <ul className="divide-y divide-line">
        {groups.data.map((g) => (
          <li key={g.id} className="flex items-start justify-between gap-space-2 py-space-3">
            <div className="min-w-0 text-[13.5px]">
              <p className="font-semibold text-ink-900">{g.name}</p>
              <p className="text-[12px] text-ink-600">
                {g.options
                  .map((o) => (o.price_paise ? `${o.name} +₹${fromMinor(o.price_paise)}` : o.name))
                  .join(", ")}
              </p>
              <p className="text-[12px] text-ink-400">
                Pick {g.min_select}
                {g.max_select === null
                  ? " or more"
                  : g.max_select === g.min_select
                    ? ""
                    : ` to ${g.max_select}`}{" "}
                · on {g.item_count} item(s)
              </p>
            </div>
            {canWrite && (
              <div className="flex shrink-0 gap-space-1">
                <Button type="button" variant="secondary" onClick={() => edit(g)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={`Delete ${g.name}`}
                  onClick={() =>
                    del.mutate(g.id, {
                      onError: (e) => toast.error("Couldn't delete the group", errorText(e)),
                    })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {groups.data.length === 0 && (
        <p className="text-[13px] text-ink-500">No add-on groups yet.</p>
      )}
      {canWrite && (
        <Button type="button" className="mt-space-3" onClick={() => setEditing(emptyGroup())}>
          <Plus size={14} /> Add group
        </Button>
      )}
    </div>
  );
}

function GroupEditor({ initial, onDone }: { initial: GroupForm; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const save = useSaveRow<ModifierGroup>("modifier-groups");
  const setOption = (i: number, patch: Partial<OptionForm>) =>
    setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const options = [];
    for (const o of form.options) {
      const price = o.price.trim() === "" ? 0 : toMinor(o.price);
      if (!o.name.trim() || price === null)
        return toast.error(
          "Each option needs a name, and a price like 40 or 40.50 (blank = free).",
        );
      options.push({ id: o.id, name: o.name.trim(), price_paise: price, is_active: o.is_active });
    }
    try {
      await save.mutateAsync({
        id: form.id,
        body: {
          name: form.name.trim(),
          min_select: Number(form.min) || 0,
          max_select: form.max.trim() === "" ? null : Number(form.max),
          options,
        },
      });
      toast.success("Add-on group saved");
      onDone();
    } catch (err) {
      toast.error("Couldn't save the group", errorText(err));
    }
  }

  return (
    <form onSubmit={submit}>
      <Field label="Group name" htmlFor="grp-name" required>
        <Input
          id="grp-name"
          maxLength={40}
          placeholder="e.g. Extra toppings"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-space-3">
        <Field label="Guest must pick at least" htmlFor="grp-min">
          <Input
            id="grp-min"
            type="number"
            min={0}
            value={form.min}
            onChange={(e) => setForm({ ...form, min: e.target.value })}
          />
        </Field>
        <Field label="Guest may pick at most" htmlFor="grp-max" hint="Blank = no limit.">
          <Input
            id="grp-max"
            type="number"
            min={1}
            value={form.max}
            onChange={(e) => setForm({ ...form, max: e.target.value })}
          />
        </Field>
      </div>
      <p className="mb-space-2 text-[12.5px] font-semibold text-ink-900">Options</p>
      {form.options.map((o, i) => (
        <div key={o.id ?? `new-${i}`} className="mb-space-2 flex items-center gap-space-2">
          <Input
            aria-label="Option name"
            placeholder="e.g. Cheese"
            maxLength={40}
            value={o.name}
            onChange={(e) => setOption(i, { name: e.target.value })}
          />
          <Input
            aria-label="Option price"
            inputMode="decimal"
            placeholder="Price (blank = free)"
            className="w-40"
            value={o.price}
            onChange={(e) => setOption(i, { price: e.target.value })}
          />
          <Button
            type="button"
            variant="secondary"
            aria-label="Remove option"
            disabled={form.options.length === 1}
            onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setForm({ ...form, options: [...form.options, { name: "", price: "", is_active: true }] })
        }
      >
        <Plus size={14} /> Add option
      </Button>
      <div className="mt-space-4 flex justify-end gap-space-2 border-t border-line pt-space-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save group"}
        </Button>
      </div>
    </form>
  );
}

// ---- kitchen stations ---------------------------------------------------------------------------------------------------------------
function Stations({ canWrite }: { canWrite: boolean }) {
  const stations = useStations();
  const save = useSaveRow<Station>("stations");
  const del = useDeleteRow("stations");
  const [adding, setAdding] = useState("");
  if (stations.isPending) return <Skeleton className="h-32 w-full" />;
  if (stations.error) return <p className="text-[13px] text-error">{errorText(stations.error)}</p>;
  return (
    <div>
      <p className="text-hint mb-space-3">
        Where KOTs print: kitchen, bar, tandoor. Each till sets which of its printers serves each
        station. Items with no station print at the till&apos;s main kitchen printer.
      </p>
      <ul className="divide-y divide-line">
        {stations.data.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-space-2 py-space-2 text-[13.5px]"
          >
            <span>
              <span className="font-semibold text-ink-900">{s.name}</span>
              <span className="ml-space-2 text-[12px] text-ink-500">
                {s.category_count} categor{s.category_count === 1 ? "y" : "ies"} · {s.item_count}{" "}
                item(s)
              </span>
            </span>
            {canWrite && (
              <Button
                type="button"
                variant="secondary"
                aria-label={`Delete ${s.name}`}
                onClick={() =>
                  del.mutate(s.id, {
                    onError: (e) => toast.error("Couldn't delete the station", errorText(e)),
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {stations.data.length === 0 && <p className="text-[13px] text-ink-500">No stations yet.</p>}
      {canWrite && (
        <form
          className="mt-space-3 flex gap-space-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            try {
              await save.mutateAsync({
                body: { name: adding.trim(), sort_order: stations.data.length },
              });
              setAdding("");
            } catch (err) {
              toast.error("Couldn't add the station", errorText(err));
            }
          }}
        >
          <Input
            placeholder="New station, e.g. Bar"
            maxLength={40}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          />
          <Button type="submit" disabled={save.isPending}>
            <Plus size={14} /> Add
          </Button>
        </form>
      )}
    </div>
  );
}
