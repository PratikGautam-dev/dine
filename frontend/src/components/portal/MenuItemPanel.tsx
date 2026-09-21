"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { MenuItem, MenuItemFormState } from "@/hooks/useMenuItems";

const NEW_CATEGORY = "__new__";

type Props = {
  form: MenuItemFormState;
  setForm: (form: MenuItemFormState) => void;
  /** The item being edited, as it is right now on the server (null when adding). */
  item: MenuItem | null;
  categories: string[];
  formError: string | null;
  saving: boolean;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onRestock: (item: MenuItem, add: number) => void | Promise<void>;
  onAvailability: (item: MenuItem, isAvailable: boolean) => void | Promise<void>;
};

/** The add / edit panel: the item's details, plus (when editing) quick restock and the independent sold-out
 * switch, which act immediately rather than waiting for Save. Mount it with key={item id} so its own state
 * (the "new category" box, the restock amount) starts fresh for each item. */
export function MenuItemPanel({
  form, setForm, item, categories, formError, saving, busy, onSubmit, onCancel, onRestock, onAvailability,
}: Props) {
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [restockAmount, setRestockAmount] = useState("");
  const categoryKnown = form.category === "" || categories.includes(form.category);
  const showNewCategory = newCategoryMode || !categoryKnown;
  const amount = Math.floor(Number(restockAmount));

  return (
    <Card className="p-space-5">
      <div className="mb-space-4 flex items-center justify-between gap-space-2">
        <h2 className="text-[15px] font-bold text-ink-900">{item ? "Edit item" : "Add item"}</h2>
        <button
          type="button" onClick={onCancel} aria-label="Close panel"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-paper"
        >
          <X size={16} />
        </button>
      </div>

      {form.image_url.trim().startsWith("https://") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.image_url.trim()} alt="Photo preview"
          className="mb-space-3 h-36 w-full rounded-md object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          onLoad={(e) => { e.currentTarget.style.display = ""; }}
        />
      )}

      <form onSubmit={onSubmit}>
        <Field label="Name" htmlFor="mi-name" required>
          <Input id="mi-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="mi-description">
          <Textarea
            id="mi-description" value={form.description} rows={2}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2 xl:grid-cols-1">
          <Field label="Price (₹)" htmlFor="mi-price" required>
            <Input
              id="mi-price" type="number" min="0" step="0.01" value={form.price_rupees}
              onChange={(e) => setForm({ ...form, price_rupees: e.target.value })}
            />
          </Field>
          <Field label="Category" htmlFor="mi-category" hint="Guests see the menu grouped by category on WhatsApp.">
            <select
              id="mi-category" value={showNewCategory ? NEW_CATEGORY : form.category}
              onChange={(e) => {
                if (e.target.value === NEW_CATEGORY) {
                  setNewCategoryMode(true);
                  setForm({ ...form, category: "" });
                } else {
                  setNewCategoryMode(false);
                  setForm({ ...form, category: e.target.value });
                }
              }}
              className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
            >
              <option value="">No category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
            {showNewCategory && (
              <Input
                id="mi-category-new" className="mt-space-2" placeholder="New category name, e.g. Starters"
                aria-label="New category name" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field
          label={item ? "Stock count" : "Starting stock"} htmlFor="mi-stock"
          hint="Portions available. Leave blank for unlimited."
        >
          <Input
            id="mi-stock" type="number" min="0" value={form.stock_count}
            onChange={(e) => setForm({ ...form, stock_count: e.target.value })}
          />
        </Field>
        <Field
          label="Photo link" htmlFor="mi-image"
          hint="Optional. A public https:// link to a photo of the dish; guests see it when they open the item on WhatsApp."
        >
          <Input
            id="mi-image" type="url" inputMode="url" placeholder="https://…" value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
        </Field>
        <CheckboxRow checked={form.is_available} onChange={(checked) => setForm({ ...form, is_available: checked })}>
          Available for ordering
        </CheckboxRow>
        {formError && <p className="mt-space-2 text-[13px] text-error">{formError}</p>}
        <div className="mt-space-4 flex gap-space-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </form>

      {item && (
        <div className="mt-space-5 border-t border-line pt-space-4">
          <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">Stock and availability</h3>
          <p className="mb-space-3 text-[12px] text-ink-600">These take effect straight away; you don&apos;t need to press Save.</p>
          {item.stock_count !== null ? (
            <div className="mb-space-3">
              <p className="mb-space-2 text-[13px] text-ink-900">
                <span className="font-semibold">{item.stock_count}</span> in stock. Restock by:
              </p>
              <div className="flex flex-wrap items-center gap-space-2">
                {[5, 10].map((n) => (
                  <Button key={n} type="button" size="md" variant="secondary" disabled={busy} onClick={() => onRestock(item, n)}>
                    +{n}
                  </Button>
                ))}
                <Input
                  type="number" min="1" aria-label={`Restock ${item.name} by`} placeholder="+N"
                  className="h-10! w-20!" value={restockAmount} onChange={(e) => setRestockAmount(e.target.value)}
                />
                <Button
                  type="button" size="md" variant="secondary" disabled={busy || !(amount >= 1)}
                  onClick={async () => { await onRestock(item, amount); setRestockAmount(""); }}
                >
                  Restock
                </Button>
              </div>
            </div>
          ) : (
            <p className="mb-space-3 text-[12px] text-ink-600">Unlimited stock. Set a stock count above to track portions.</p>
          )}
          <label className="flex items-center justify-between gap-space-2 text-[13px] text-ink-900">
            <span>
              Sold out
              <span className="block text-[12px] text-ink-600">Hides it on WhatsApp without changing the stock count.</span>
            </span>
            <Switch
              checked={!item.is_available}
              onChange={() => onAvailability(item, !item.is_available)}
              disabled={busy}
              aria-label={`Mark ${item.name} sold out`}
            />
          </label>
        </div>
      )}
    </Card>
  );
}
