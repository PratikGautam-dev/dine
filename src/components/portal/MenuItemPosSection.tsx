"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { Button } from "@/components/ui/Button";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type ItemPos,
  useItemPos,
  useModifierGroups,
  useSaveItemPos,
  useStations,
} from "@/hooks/usePosMenu";
import { useTaxRules } from "@/hooks/useTaxes";
import { fromMinor, toMinor } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

type PriceKey = "dine_in_price_paise" | "takeaway_price_paise" | "delivery_price_paise";
const ORDER_TYPES: { key: PriceKey; label: string }[] = [
  { key: "dine_in_price_paise", label: "Dine-in" },
  { key: "takeaway_price_paise", label: "Takeaway" },
  { key: "delivery_price_paise", label: "Delivery" },
];

type VariantForm = { id?: string; name: string; price: string; is_active: boolean } & Record<
  PriceKey,
  string
>;
type Form = {
  station_id: string;
  tax_code: string;
  short_name: string;
  variants: VariantForm[];
  modifier_group_ids: string[];
} & Record<PriceKey, string>;

function toForm(item: ItemPos): Form {
  return {
    station_id: item.station_id ?? "",
    tax_code: item.tax_code ?? "",
    short_name: item.short_name ?? "",
    dine_in_price_paise: fromMinor(item.dine_in_price_paise),
    takeaway_price_paise: fromMinor(item.takeaway_price_paise),
    delivery_price_paise: fromMinor(item.delivery_price_paise),
    variants: item.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: fromMinor(v.price_paise),
      dine_in_price_paise: fromMinor(v.dine_in_price_paise),
      takeaway_price_paise: fromMinor(v.takeaway_price_paise),
      delivery_price_paise: fromMinor(v.delivery_price_paise),
      is_active: v.is_active,
    })),
    modifier_group_ids: item.modifier_group_ids,
  };
}

/** Blank -> null ("same as the item's price"); otherwise paise, or undefined when it isn't a valid amount. */
function optionalPaise(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  return toMinor(value) ?? undefined;
}

/** The POS details of one menu item, saved on their own (Food Menu > edit item > POS): which kitchen station its KOT prints at, its GST
 * code, a short name for the KOT, prices for dine-in / takeaway / delivery, variants (half / full) and the add-on groups it offers. */
export function MenuItemPosSection({ itemId, canWrite }: { itemId: string; canWrite: boolean }) {
  const item = useItemPos(itemId);
  if (item.isPending) return <Skeleton className="h-32 w-full" />;
  if (item.error) return <p className="text-[12.5px] text-error">{item.error.message}</p>;
  return <PosForm key={item.dataUpdatedAt} item={item.data} canWrite={canWrite} />;
}

function PosForm({ item, canWrite }: { item: ItemPos; canWrite: boolean }) {
  const stations = useStations();
  const groups = useModifierGroups();
  const taxes = useTaxRules();
  const save = useSaveItemPos(item.id);
  const [form, setForm] = useState<Form>(() => toForm(item));
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setVariant = (i: number, patch: Partial<VariantForm>) =>
    set({ variants: form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  async function submit() {
    const prices = Object.fromEntries(ORDER_TYPES.map((t) => [t.key, optionalPaise(form[t.key])]));
    if (Object.values(prices).some((p) => p === undefined))
      return toast.error("Check the order-type prices: amounts like 240 or 240.50.");
    const variants = [];
    for (const v of form.variants) {
      const price = toMinor(v.price);
      const vPrices = Object.fromEntries(ORDER_TYPES.map((t) => [t.key, optionalPaise(v[t.key])]));
      if (!v.name.trim() || price === null || Object.values(vPrices).some((p) => p === undefined))
        return toast.error("Each variant needs a name and a price.");
      variants.push({
        id: v.id,
        name: v.name.trim(),
        price_paise: price,
        ...vPrices,
        is_active: v.is_active,
      });
    }
    try {
      await save.mutateAsync({
        station_id: form.station_id || null,
        tax_code: form.tax_code || null,
        short_name: form.short_name.trim() || null,
        ...(prices as Record<PriceKey, number | null>),
        variants: variants as ItemPos["variants"],
        modifier_group_ids: form.modifier_group_ids,
      });
      toast.success("POS details saved");
    } catch (e) {
      toast.error("Couldn't save the POS details", (e as Error).message);
    }
  }

  const ro = !canWrite;
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
        <Field
          label="Kitchen station"
          htmlFor="pos-station"
          hint="Where its KOT prints. Blank = the category's station."
        >
          <Select
            id="pos-station"
            className="w-full"
            value={form.station_id}
            onValueChange={(v) => set({ station_id: v })}
            disabled={ro}
          >
            <option value="">Category&apos;s station</option>
            {(stations.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="GST"
          htmlFor="pos-tax"
          hint="Blank = the category's, or the restaurant's default."
        >
          <Select
            id="pos-tax"
            className="w-full"
            value={form.tax_code}
            onValueChange={(v) => set({ tax_code: v })}
            disabled={ro}
          >
            <option value="">Default</option>
            {(taxes.data ?? []).map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} ({t.rate_bps / 100}%)
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Name on the KOT"
          htmlFor="pos-short"
          hint="Up to 24 characters. Blank = the item's name."
        >
          <Input
            id="pos-short"
            maxLength={24}
            value={form.short_name}
            disabled={ro}
            onChange={(e) => set({ short_name: e.target.value })}
          />
        </Field>
      </div>

      <p className="mb-space-2 text-[12.5px] font-semibold text-ink-900">Price by order type (₹)</p>
      <p className="text-hint mb-space-2">
        Blank = the item&apos;s price ({fromMinor(item.price_paise)}).
      </p>
      <div className="mb-space-4 grid grid-cols-3 gap-space-2">
        {ORDER_TYPES.map((t) => (
          <Field key={t.key} label={t.label} htmlFor={`pos-${t.key}`} className="mb-0">
            <Input
              id={`pos-${t.key}`}
              inputMode="decimal"
              placeholder={fromMinor(item.price_paise)}
              value={form[t.key]}
              disabled={ro}
              onChange={(e) => set({ [t.key]: e.target.value } as Partial<Form>)}
            />
          </Field>
        ))}
      </div>

      <p className="mb-space-1 text-[12.5px] font-semibold text-ink-900">Variants</p>
      <p className="text-hint mb-space-2">
        Half / full, small / large. With variants, the cashier picks one and its price is used.
      </p>
      {form.variants.map((v, i) => (
        <div
          key={v.id ?? `new-${i}`}
          className="mb-space-2 rounded-md border border-line p-space-2"
        >
          <div className="flex items-center gap-space-2">
            <Input
              aria-label="Variant name"
              placeholder="e.g. Half"
              value={v.name}
              disabled={ro}
              onChange={(e) => setVariant(i, { name: e.target.value })}
            />
            <Input
              aria-label="Variant price"
              inputMode="decimal"
              placeholder="Price"
              className="w-28"
              value={v.price}
              disabled={ro}
              onChange={(e) => setVariant(i, { price: e.target.value })}
            />
            {!ro && (
              <Button
                type="button"
                variant="secondary"
                aria-label="Remove variant"
                onClick={() => set({ variants: form.variants.filter((_, j) => j !== i) })}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <div className="mt-space-2 grid grid-cols-3 gap-space-2">
            {ORDER_TYPES.map((t) => (
              <Input
                key={t.key}
                aria-label={`${v.name || "Variant"} ${t.label} price`}
                inputMode="decimal"
                placeholder={t.label}
                value={v[t.key]}
                disabled={ro}
                onChange={(e) => setVariant(i, { [t.key]: e.target.value } as Partial<VariantForm>)}
              />
            ))}
          </div>
        </div>
      ))}
      {!ro && (
        <Button
          type="button"
          variant="secondary"
          className="mb-space-4"
          onClick={() =>
            set({
              variants: [
                ...form.variants,
                {
                  name: "",
                  price: "",
                  dine_in_price_paise: "",
                  takeaway_price_paise: "",
                  delivery_price_paise: "",
                  is_active: true,
                },
              ],
            })
          }
        >
          <Plus size={14} /> Add variant
        </Button>
      )}

      <p className="mb-space-1 text-[12.5px] font-semibold text-ink-900">Add-on groups</p>
      {groups.data?.length ? (
        <div className="mb-space-4 flex flex-col gap-space-1">
          {groups.data.map((g) => (
            <CheckboxRow
              key={g.id}
              checked={form.modifier_group_ids.includes(g.id)}
              onChange={(on) =>
                !ro &&
                set({
                  modifier_group_ids: on
                    ? [...form.modifier_group_ids, g.id]
                    : form.modifier_group_ids.filter((x) => x !== g.id),
                })
              }
            >
              {g.name}
              <span className="ml-space-1 text-[12px] text-ink-500">
                ({g.options.map((o) => o.name).join(", ")})
              </span>
            </CheckboxRow>
          ))}
        </div>
      ) : (
        <p className="text-hint mb-space-4">
          No add-on groups yet. Make them in POS setup on the Menu page.
        </p>
      )}

      {canWrite && (
        <Button type="button" onClick={submit} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save POS details"}
        </Button>
      )}
    </div>
  );
}
