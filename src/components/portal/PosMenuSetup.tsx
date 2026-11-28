"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Plus,
  Puzzle,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { PageTabs } from "@/components/portal/PageTabs";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  usePosSettings,
  useSaveRow,
  useStations,
} from "@/hooks/usePosMenu";
import { useTaxRules } from "@/hooks/useTaxes";
import { cn } from "@/lib/cn";
import { fromMinor, toMinor } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

type Tab = "categories" | "groups" | "stations";

/** Food Menu > POS setup: the menu's categories (order, kitchen station, GST), add-on groups and kitchen stations, used by the POS till.
 * Every change saves as it is made (a name when you leave the field, a choice when you pick it); the row says when it is saved. */
export function PosMenuSetup({ onClose, canWrite }: { onClose: () => void; canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <Modal onClose={onClose} labelledBy="pos-setup-title" maxWidthClass="max-w-[860px]">
      <h2 id="pos-setup-title" className="text-[18px] font-bold text-ink-900">
        POS setup
      </h2>
      <p className="text-hint mb-space-3">
        How the POS till shows your menu and where it prints kitchen tickets (KOTs).
      </p>
      <Guide />
      <PageTabs
        tabs={[
          { key: "categories", label: "Categories", icon: <Layers size={14} /> },
          { key: "stations", label: "Kitchen stations", icon: <UtensilsCrossed size={14} /> },
          { key: "groups", label: "Add-on groups", icon: <Puzzle size={14} /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div>
        {tab === "categories" && <Categories canWrite={canWrite} />}
        {tab === "stations" && <Stations canWrite={canWrite} />}
        {tab === "groups" && <Groups canWrite={canWrite} />}
      </div>
    </Modal>
  );
}

const errorText = (e: unknown) => (e as Error).message;
const GUIDE_KEY = "pos-setup-guide-closed";

/** "What is this?": open until the person closes it once (remembered in this browser only). */
function Guide() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) !== "1";
    } catch {
      return true; // storage blocked: the guide just stays open
    }
  });
  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(GUIDE_KEY, next ? "0" : "1");
    } catch {
      // not remembered; harmless
    }
  }
  return (
    <section className="mb-space-4 rounded-lg border border-line bg-paper">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-space-2 px-space-3 py-space-2 text-left text-[13.5px] font-semibold text-ink-900"
      >
        What is this?
        <ChevronDown
          size={16}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-space-2 border-t border-line px-space-3 py-space-3 text-[13px] text-ink-600">
          <p>
            Your menu already works on the POS till without anything here. Use this page when you
            want the till to{" "}
            <strong className="text-ink-900">print each dish in the right kitchen</strong>,{" "}
            <strong className="text-ink-900">show categories in your order</strong>, or{" "}
            <strong className="text-ink-900">offer add-ons</strong>.
          </p>
          <ul className="list-disc space-y-1 pl-space-5">
            <li>
              <strong className="text-ink-900">Kitchen stations</strong>: the places that cook, each
              with its own KOT printer, e.g. Tandoor, Bar, Chinese. Order a naan and a lime soda:
              the tandoor gets the naan, the bar gets the soda.
            </li>
            <li>
              <strong className="text-ink-900">Categories</strong>: the order of the category
              buttons on the till, which station cooks each category, and its GST if it differs from
              your usual rate.
            </li>
            <li>
              <strong className="text-ink-900">Add-on groups</strong>: choices offered with a dish,
              e.g. &quot;Extra cheese +₹30&quot; or &quot;Spice level: mild / medium / hot&quot;.
            </li>
          </ul>
          <p>
            <strong className="text-ink-900">Only one kitchen printer?</strong> You can skip
            stations; every KOT prints at the main kitchen printer.{" "}
            <strong className="text-ink-900">Several?</strong> Add the stations first, then pick
            each category&apos;s station. Each till chooses its printer per station in the POS app
            (Settings).
          </p>
        </div>
      )}
    </section>
  );
}

/** "Saving…" / "Saved" beside a row, so it is clear a change took effect without a Save button. */
type RowState = "saving" | "saved" | undefined;
function SaveState({ state }: { state: RowState }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-ink-500">
        <Loader2 size={13} className="animate-spin" /> Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-success">
        <Check size={13} /> Saved
      </span>
    );
  return null;
}

function useRowStates() {
  const [states, setStates] = useState<Record<string, RowState>>({});
  async function track(id: string, work: () => Promise<unknown>, failure: string) {
    setStates((s) => ({ ...s, [id]: "saving" }));
    try {
      await work();
      setStates((s) => ({ ...s, [id]: "saved" }));
      setTimeout(() => setStates((s) => (s[id] === "saved" ? { ...s, [id]: undefined } : s)), 2000);
      return true;
    } catch (e) {
      setStates((s) => ({ ...s, [id]: undefined }));
      toast.error(failure, errorText(e));
      return false;
    }
  }
  return { states, track };
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors",
        "hover:bg-black/[0.05] hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
        danger && "hover:bg-error-tint hover:text-error",
      )}
    >
      {children}
    </button>
  );
}

/** A name that saves when you leave the field or press Enter; Escape puts it back. Callers key it by the saved name, so a saved
 * rename (or one from elsewhere) starts it afresh. */
function NameInput({
  id,
  value,
  label,
  disabled,
  maxLength,
  onSave,
}: {
  id: string;
  value: string;
  label: string;
  disabled: boolean;
  maxLength: number;
  onSave: (name: string) => void;
}) {
  const [text, setText] = useState(value);
  function commit() {
    const name = text.trim();
    if (!name) return setText(value);
    if (name !== value) onSave(name);
  }
  return (
    <Input
      id={id}
      aria-label={label}
      value={text}
      maxLength={maxLength}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          e.stopPropagation();
          setText(value);
        }
      }}
    />
  );
}

function AddRow({
  placeholder,
  maxLength,
  busy,
  onAdd,
}: {
  placeholder: string;
  maxLength: number;
  busy: boolean;
  onAdd: (name: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="mt-space-3 flex gap-space-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() && (await onAdd(text.trim()))) setText("");
      }}
    >
      <Input
        placeholder={placeholder}
        value={text}
        maxLength={maxLength}
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" disabled={busy} className="shrink-0">
        <Plus size={14} /> Add
      </Button>
    </form>
  );
}

const byOrder = <T extends { sort_order: number; name: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

// ---- categories ---------------------------------------------------------------------------------------------------------------------
// Phones: arrows, name and actions on one line, then the item count, then station and GST side by side. md and up: one table row.
const CAT_GRID =
  "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[64px_minmax(0,1fr)_48px_160px_160px_72px]";

function Categories({ canWrite }: { canWrite: boolean }) {
  const categories = useCategories();
  const stations = useStations();
  const taxes = useTaxRules();
  const settings = usePosSettings();
  const save = useSaveRow<Category>("categories");
  const del = useDeleteRow("categories");
  const { states, track } = useRowStates();
  const [deleting, setDeleting] = useState<Category | null>(null);

  if (categories.isPending) return <Skeleton className="h-32 w-full" />;
  if (categories.error)
    return <p className="text-[13px] text-error">{errorText(categories.error)}</p>;
  const rows = byOrder(categories.data);
  const defaultRate = settings.data ? settings.data.restaurant.default_tax_bps / 100 : null;

  const body = (c: Category, patch: Partial<Category>) => {
    const next = { ...c, ...patch };
    return {
      name: next.name,
      sort_order: next.sort_order,
      station_id: next.station_id,
      tax_code: next.tax_code,
    };
  };
  const update = (c: Category, patch: Partial<Category>) =>
    track(
      c.id,
      () => save.mutateAsync({ id: c.id, body: body(c, patch) }),
      `Couldn't save ${c.name}`,
    );

  /** Moves a category one place and numbers the whole list 1, 2, 3 ... so the order is unambiguous. */
  async function move(index: number, by: -1 | 1) {
    const order = [...rows];
    const [moved] = order.splice(index, 1);
    order.splice(index + by, 0, moved);
    const changed = order
      .map((c, i) => ({ c, sort_order: i + 1 }))
      .filter(({ c, sort_order }) => c.sort_order !== sort_order);
    await track(
      moved.id,
      async () => {
        for (const { c, sort_order } of changed)
          await save.mutateAsync({ id: c.id, body: body(c, { sort_order }) });
      },
      "Couldn't change the order",
    );
  }

  return (
    <div>
      <p className="text-hint mb-space-3">
        Changes save on their own. Renaming a category renames it everywhere, WhatsApp and the
        website too.
      </p>
      <div className="rounded-lg border border-line">
        <div
          className={cn(
            "hidden gap-space-3 border-b border-line bg-paper px-space-3 py-space-2 text-[12px] font-semibold text-ink-600 md:grid",
            CAT_GRID,
          )}
        >
          <span>Order</span>
          <span>Category</span>
          <span className="text-center">Items</span>
          <span>Kitchen station</span>
          <span>GST</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {rows.map((c, i) => (
            <li
              key={c.id}
              className={cn(
                "grid items-center gap-space-2 px-space-3 py-space-2 md:gap-space-3",
                CAT_GRID,
              )}
            >
              <div className="order-1 flex items-center gap-1 md:order-none">
                <IconButton
                  label={`Move ${c.name} up`}
                  disabled={!canWrite || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  label={`Move ${c.name} down`}
                  disabled={!canWrite || i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={15} />
                </IconButton>
              </div>
              <div className="order-2 min-w-0 md:order-none">
                <NameInput
                  key={c.name}
                  id={`cat-${c.id}`}
                  label="Category name"
                  value={c.name}
                  maxLength={80}
                  disabled={!canWrite}
                  onSave={(name) => update(c, { name })}
                />
              </div>
              <span className="order-4 col-span-2 col-start-2 -mt-1 text-[12px] text-ink-500 md:order-none md:col-span-1 md:col-start-auto md:mt-0 md:text-center md:text-[13px] md:text-ink-600">
                {c.item_count}
                <span className="md:hidden"> item{c.item_count === 1 ? "" : "s"}</span>
              </span>
              <div className="order-5 col-span-3 grid grid-cols-2 gap-space-2 md:contents">
                <label className="min-w-0">
                  <span className="mb-1 block text-[12px] font-semibold text-ink-600 md:hidden">
                    Kitchen station
                  </span>
                  <Select
                    aria-label={`Kitchen station for ${c.name}`}
                    className="w-full"
                    value={c.station_id ?? ""}
                    disabled={!canWrite}
                    onValueChange={(v) => update(c, { station_id: v || null })}
                  >
                    <option value="">Main kitchen</option>
                    {(stations.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-[12px] font-semibold text-ink-600 md:hidden">
                    GST
                  </span>
                  <Select
                    aria-label={`GST for ${c.name}`}
                    className="w-full"
                    value={c.tax_code ?? ""}
                    disabled={!canWrite}
                    onValueChange={(v) => update(c, { tax_code: v || null })}
                  >
                    <option value="">
                      {defaultRate === null ? "Usual rate" : `Usual rate (${defaultRate}%)`}
                    </option>
                    {(taxes.data ?? []).map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name ? `${t.name} (${t.rate_bps / 100}%)` : `${t.rate_bps / 100}%`}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <div className="order-3 flex items-center justify-end gap-space-1 md:order-none">
                <SaveState state={states[c.id]} />
                {canWrite && !states[c.id] && (
                  <IconButton
                    label={
                      c.item_count ? `${c.name} has items: move them first` : `Delete ${c.name}`
                    }
                    danger
                    disabled={c.item_count > 0}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                )}
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="px-space-3 py-space-4 text-[13px] text-ink-500">No categories yet.</p>
        )}
      </div>
      {canWrite && (
        <AddRow
          placeholder="New category, e.g. Starters"
          maxLength={80}
          busy={save.isPending}
          onAdd={async (name) => {
            try {
              await save.mutateAsync({ body: { name, sort_order: rows.length + 1 } });
              toast.success(`${name} added`);
              return true;
            } catch (e) {
              toast.error("Couldn't add the category", errorText(e));
              return false;
            }
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "category"}?`}
        message="It has no items. It is removed from the till, WhatsApp and the website."
        confirmLabel="Delete"
        destructive
        busy={del.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => toast.error("Couldn't delete the category", errorText(e)),
          })
        }
      />
    </div>
  );
}

// ---- kitchen stations ---------------------------------------------------------------------------------------------------------------
function Stations({ canWrite }: { canWrite: boolean }) {
  const stations = useStations();
  const save = useSaveRow<Station>("stations");
  const del = useDeleteRow("stations");
  const { states, track } = useRowStates();
  const [deleting, setDeleting] = useState<Station | null>(null);
  if (stations.isPending) return <Skeleton className="h-32 w-full" />;
  if (stations.error) return <p className="text-[13px] text-error">{errorText(stations.error)}</p>;
  const rows = byOrder(stations.data);

  return (
    <div>
      <p className="text-hint mb-space-3">
        The places that cook, each with its own KOT printer. Dishes whose category has no station
        print at the till&apos;s main kitchen printer. After adding stations, choose each
        category&apos;s station in the Categories tab.
      </p>
      <div className="rounded-lg border border-line">
        <div className="hidden grid-cols-[minmax(0,1fr)_200px_72px] gap-space-3 border-b border-line bg-paper px-space-3 py-space-2 text-[12px] font-semibold text-ink-600 md:grid">
          <span>Station</span>
          <span>Used by</span>
          <span />
        </div>
        <ul className="divide-y divide-line">
          {rows.map((s) => (
            <li
              key={s.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-space-2 px-space-3 py-space-2 md:grid-cols-[minmax(0,1fr)_200px_72px] md:gap-space-3"
            >
              <NameInput
                key={s.name}
                id={`st-${s.id}`}
                label="Station name"
                value={s.name}
                maxLength={40}
                disabled={!canWrite}
                onSave={(name) =>
                  track(
                    s.id,
                    () =>
                      save.mutateAsync({
                        id: s.id,
                        body: { name, sort_order: s.sort_order, is_active: s.is_active },
                      }),
                    `Couldn't rename ${s.name}`,
                  )
                }
              />
              <span className="order-3 col-span-2 text-[12px] text-ink-500 md:order-none md:col-span-1 md:text-[13px] md:text-ink-600">
                {s.category_count} categor{s.category_count === 1 ? "y" : "ies"} · {s.item_count}{" "}
                item
                {s.item_count === 1 ? "" : "s"}
              </span>
              <div className="order-2 flex items-center justify-end gap-space-1 md:order-none">
                <SaveState state={states[s.id]} />
                {canWrite && !states[s.id] && (
                  <IconButton label={`Delete ${s.name}`} danger onClick={() => setDeleting(s)}>
                    <Trash2 size={15} />
                  </IconButton>
                )}
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="px-space-3 py-space-4 text-[13px] text-ink-500">
            No stations yet: every KOT prints at the main kitchen printer.
          </p>
        )}
      </div>
      {canWrite && (
        <AddRow
          placeholder="New station, e.g. Tandoor or Bar"
          maxLength={40}
          busy={save.isPending}
          onAdd={async (name) => {
            try {
              await save.mutateAsync({ body: { name, sort_order: rows.length + 1 } });
              toast.success(`${name} added. Now pick it for its categories in the Categories tab.`);
              return true;
            } catch (e) {
              toast.error("Couldn't add the station", errorText(e));
              return false;
            }
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "station"}?`}
        message={
          deleting && deleting.category_count + deleting.item_count > 0
            ? `${deleting.category_count} categor${deleting.category_count === 1 ? "y" : "ies"} and ${deleting.item_count} item(s) use it. Their KOTs will print at the main kitchen printer instead.`
            : "Nothing uses it yet."
        }
        confirmLabel="Delete"
        destructive
        busy={del.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => toast.error("Couldn't delete the station", errorText(e)),
          })
        }
      />
    </div>
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

const pickRule = (g: ModifierGroup) =>
  g.max_select === null
    ? g.min_select
      ? `Pick at least ${g.min_select}`
      : "Optional, any number"
    : g.min_select === g.max_select
      ? `Pick exactly ${g.min_select}`
      : g.min_select
        ? `Pick ${g.min_select} to ${g.max_select}`
        : `Optional, up to ${g.max_select}`;

function Groups({ canWrite }: { canWrite: boolean }) {
  const groups = useModifierGroups();
  const [editing, setEditing] = useState<GroupForm | null>(null);
  const [deleting, setDeleting] = useState<ModifierGroup | null>(null);
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
        Choices the cashier offers with a dish, like &quot;Extra toppings&quot; or &quot;Spice
        level&quot;. After making a group, attach it to dishes in each dish&apos;s POS section on
        the Food Menu.
      </p>
      <div className="rounded-lg border border-line">
        <ul className="divide-y divide-line">
          {groups.data.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-space-3 px-space-3 py-space-3"
            >
              <div className="min-w-0 text-[13.5px]">
                <p className="font-semibold text-ink-900">{g.name}</p>
                <p className="truncate text-[12.5px] text-ink-600">
                  {g.options
                    .map((o) =>
                      o.price_paise ? `${o.name} +₹${fromMinor(o.price_paise)}` : o.name,
                    )
                    .join(", ")}
                </p>
                <p className="text-[12px] text-ink-500">
                  {pickRule(g)} · on {g.item_count} dish{g.item_count === 1 ? "" : "es"}
                </p>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-space-1">
                  <Button type="button" variant="secondary" onClick={() => edit(g)}>
                    Edit
                  </Button>
                  <IconButton label={`Delete ${g.name}`} danger onClick={() => setDeleting(g)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
        {groups.data.length === 0 && (
          <p className="px-space-3 py-space-4 text-[13px] text-ink-500">No add-on groups yet.</p>
        )}
      </div>
      {canWrite && (
        <Button type="button" className="mt-space-3" onClick={() => setEditing(emptyGroup())}>
          <Plus size={14} /> Add group
        </Button>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "group"}?`}
        message={
          deleting?.item_count
            ? `It is on ${deleting.item_count} dish(es); the till stops offering it with them.`
            : "No dish uses it yet."
        }
        confirmLabel="Delete"
        destructive
        busy={del.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => toast.error("Couldn't delete the group", errorText(e)),
          })
        }
      />
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
    if (!form.name.trim()) return toast.error("Give the group a name, e.g. Extra toppings.");
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
      <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
        <Field label="Guest must pick at least" htmlFor="grp-min" hint="0 = optional.">
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
      <div className="mb-space-1 grid grid-cols-[minmax(0,1fr)_110px_32px] md:grid-cols-[minmax(0,1fr)_160px_32px] gap-space-2 text-[12px] font-semibold text-ink-600">
        <span>Option</span>
        <span>Extra price (₹)</span>
        <span />
      </div>
      {form.options.map((o, i) => (
        <div
          key={o.id ?? `new-${i}`}
          className="mb-space-2 grid grid-cols-[minmax(0,1fr)_110px_32px] md:grid-cols-[minmax(0,1fr)_160px_32px] items-center gap-space-2"
        >
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
            placeholder="Blank = free"
            value={o.price}
            onChange={(e) => setOption(i, { price: e.target.value })}
          />
          <IconButton
            label="Remove option"
            danger
            disabled={form.options.length === 1}
            onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
          >
            <Trash2 size={15} />
          </IconButton>
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
