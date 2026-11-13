"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { ComboLinesEditor } from "@/components/portal/ComboLinesEditor";
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
  uploadingImage: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onImageUpload: (file: File) => void | Promise<void>;
  onRestock: (item: MenuItem, add: number) => void | Promise<void>;
  onAvailability: (item: MenuItem, isAvailable: boolean) => void | Promise<void>;
};

const _MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const _ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The add / edit panel: the item's details, plus (when editing) quick restock and the independent sold-out
 * switch, which act immediately rather than waiting for Save. Mount it with key={item id} so its own state
 * (the "new category" box, the restock amount) starts fresh for each item. */
export function MenuItemPanel({
  form,
  setForm,
  item,
  categories,
  formError,
  saving,
  busy,
  uploadingImage,
  onSubmit,
  onCancel,
  onImageUpload,
  onRestock,
  onAvailability,
}: Props) {
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [restockAmount, setRestockAmount] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const categoryKnown = form.category === "" || categories.includes(form.category);
  const showNewCategory = newCategoryMode || !categoryKnown;
  const amount = Math.floor(Number(restockAmount));
  const isCombo = form.is_combo;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the exact same file again re-fire onChange
    if (!file) return;
    if (!_ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Photo must be a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > _MAX_IMAGE_UPLOAD_BYTES) {
      setImageError("Photo must be 5 MB or smaller.");
      return;
    }
    setImageError(null);
    onImageUpload(file);
  }

  return (
    <>
      <div className="mb-space-4 border-b border-line pb-space-3">
        <h2 id="menu-item-title" className="text-[18px] font-bold text-ink-900">
          {item ? (isCombo ? "Edit combo" : "Edit item") : isCombo ? "Create combo" : "Add item"}
        </h2>
        <p className="text-hint mt-space-1">
          {isCombo
            ? "Bundle items you already sell into one deal."
            : "Add a dish guests can order on WhatsApp."}
        </p>
      </div>

      {(form.image_url.trim().startsWith("https://") ||
        form.image_url.trim().startsWith("/api/")) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.image_url.trim()}
          alt="Photo preview"
          className="mb-space-3 h-36 w-full rounded-md object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          onLoad={(e) => {
            e.currentTarget.style.display = "";
          }}
        />
      )}

      <form onSubmit={onSubmit}>
        <FormSection title="Basics">
          <Field label={isCombo ? "Combo name" : "Name"} htmlFor="mi-name" required>
            <Input
              id="mi-name"
              placeholder={isCombo ? "e.g. Family Feast Combo" : "e.g. Butter Chicken"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="mi-description">
            <Textarea
              id="mi-description"
              value={form.description}
              rows={2}
              placeholder={
                isCombo
                  ? "What makes this deal worth ordering"
                  : "Short description guests will read"
              }
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </FormSection>

        {isCombo && (
          <FormSection title="What's in the combo">
            <ComboLinesEditor
              lines={form.combo_lines}
              comboPricePaise={Math.round((Number(form.price_rupees) || 0) * 100)}
              onChange={(combo_lines) => setForm({ ...form, combo_lines })}
            />
          </FormSection>
        )}

        <FormSection title={isCombo ? "Price and category" : "Price, category and stock"}>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field label={isCombo ? "Combo price (₹)" : "Price (₹)"} htmlFor="mi-price" required>
              <Input
                id="mi-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price_rupees}
                onChange={(e) => setForm({ ...form, price_rupees: e.target.value })}
              />
            </Field>
            <Field label="Category" htmlFor="mi-category">
              <select
                id="mi-category"
                value={showNewCategory ? NEW_CATEGORY : form.category}
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY) {
                    setNewCategoryMode(true);
                    setForm({ ...form, category: "" });
                  } else {
                    setNewCategoryMode(false);
                    setForm({ ...form, category: e.target.value });
                  }
                }}
                className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 shadow-[var(--shadow-sm)]"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
              {showNewCategory && (
                <Input
                  id="mi-category-new"
                  className="mt-space-2"
                  placeholder="New category name, e.g. Starters"
                  aria-label="New category name"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              )}
            </Field>
            <Field
              label={item ? "Stock count" : "Starting stock"}
              htmlFor="mi-stock"
              hint="Portions available. Blank = unlimited."
            >
              <Input
                id="mi-stock"
                type="number"
                min="0"
                placeholder="Unlimited"
                value={form.stock_count}
                onChange={(e) => setForm({ ...form, stock_count: e.target.value })}
              />
            </Field>
            <Field
              label="Veg / Non-veg"
              htmlFor="mi-is-veg"
              hint="Used by the storefront veg filter."
            >
              <select
                id="mi-is-veg"
                value={form.is_veg}
                onChange={(e) =>
                  setForm({ ...form, is_veg: e.target.value as MenuItemFormState["is_veg"] })
                }
                className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 shadow-[var(--shadow-sm)]"
              >
                <option value="unset">Not set</option>
                <option value="veg">Veg</option>
                <option value="non_veg">Non-veg</option>
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Photo">
          <div className="rounded-md border border-dashed border-line bg-paper p-space-3">
            <div className="flex flex-wrap items-center gap-space-3">
              <input
                id="mi-image-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingImage}
                onChange={handleFileChange}
                aria-label="Upload photo"
                className="min-w-0 text-[13px] text-ink-700 file:mr-space-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-space-3 file:py-space-2 file:text-[12.5px] file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              />
              {uploadingImage && <span className="text-[12.5px] text-ink-500">Uploading…</span>}
            </div>
            {imageError && <p className="mt-space-1 text-[12.5px] text-error">{imageError}</p>}
            <Input
              id="mi-image"
              type="url"
              inputMode="url"
              placeholder="or paste a photo link"
              className="mt-space-2"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            <p className="text-hint mt-space-2">
              Optional. JPEG, PNG or WebP up to 5 MB. Guests see it on WhatsApp.
            </p>
          </div>
        </FormSection>

        <FormSection title="Options" last>
          {(item || !isCombo) && (
            <CheckboxRow
              checked={form.is_combo}
              onChange={(checked) =>
                setForm({
                  ...form,
                  is_combo: checked,
                  combo_lines: checked ? form.combo_lines : [],
                })
              }
            >
              This is a combo (bundles multiple menu items into one)
            </CheckboxRow>
          )}
          <CheckboxRow
            checked={form.is_available}
            onChange={(checked) => setForm({ ...form, is_available: checked })}
          >
            Available for ordering
          </CheckboxRow>
        </FormSection>

        {formError && (
          <p className="mb-space-3 rounded-md bg-red-50 px-space-3 py-space-2 text-[13px] text-error">
            {formError}
          </p>
        )}
        <div className="sticky -bottom-space-5 -mx-space-5 -mb-space-5 mt-space-2 flex justify-end gap-space-2 border-t border-line bg-card px-space-5 py-space-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : item ? "Save changes" : isCombo ? "Create combo" : "Add item"}
          </Button>
        </div>
      </form>

      {item && (
        <div className="mt-space-5 border-t border-line pt-space-4">
          <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">Stock and availability</h3>
          <p className="mb-space-3 text-[12px] text-ink-600">
            These take effect straight away; you don&apos;t need to press Save.
          </p>
          {item.stock_count !== null ? (
            <div className="mb-space-3">
              <p className="mb-space-2 text-[13px] text-ink-900">
                <span className="font-semibold">{item.stock_count}</span> in stock. Restock by:
              </p>
              <div className="flex flex-wrap items-center gap-space-2">
                {[5, 10].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="md"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onRestock(item, n)}
                  >
                    +{n}
                  </Button>
                ))}
                <Input
                  type="number"
                  min="1"
                  aria-label={`Restock ${item.name} by`}
                  placeholder="+N"
                  className="h-10! w-20!"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                />
                <Button
                  type="button"
                  size="md"
                  variant="secondary"
                  disabled={busy || !(amount >= 1)}
                  onClick={async () => {
                    await onRestock(item, amount);
                    setRestockAmount("");
                  }}
                >
                  Restock
                </Button>
              </div>
            </div>
          ) : (
            <p className="mb-space-3 text-[12px] text-ink-600">
              Unlimited stock. Set a stock count above to track portions.
            </p>
          )}
          <label className="flex items-center justify-between gap-space-2 text-[13px] text-ink-900">
            <span>
              Sold out
              <span className="block text-[12px] text-ink-600">
                Hides it on WhatsApp without changing the stock count.
              </span>
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
    </>
  );
}

function FormSection({
  title,
  last,
  children,
}: {
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={last ? "mb-space-3" : "mb-space-4 border-b border-line pb-space-1"}>
      <h3 className="text-label mb-space-3 font-bold uppercase tracking-wide text-ink-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
