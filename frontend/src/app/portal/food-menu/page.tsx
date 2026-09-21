"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useMenuItems } from "@/hooks/useMenuItems";

const NEW_CATEGORY = "__new__";

export default function PortalFoodMenuPage() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a tenant
  // lacking manage_food_ordering -- this is just a UI convenience, same
  // "fails open while hospital hasn't loaded" shape the Tables page's own
  // canManageDoctors check already uses.
  const canManage = !hospital || hospital.admin_capabilities?.includes("manage_food_ordering");
  const {
    items, categories, error, busyId,
    showForm, editingId, form, setForm, formError, saving,
    openAddForm, openEditForm, cancelForm, handleSave, handleRestock, handleAvailability,
  } = useMenuItems(ready);
  // "New category…" reveals a text box; picking an existing category (or "No category") hides it again.
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [restockAmounts, setRestockAmounts] = useState<Record<string, string>>({});
  const categoryKnown = form.category === "" || categories.includes(form.category);
  const showNewCategory = newCategoryMode || !categoryKnown;

  function openForm(open: () => void) {
    setNewCategoryMode(false);
    open();
  }

  return (
    <PortalShell hospital={hospital} active="food-menu">
      <PageHeader
        title="Menu"
        description="What guests can order for takeaway or delivery through WhatsApp."
        actions={canManage && <Button size="md" onClick={() => openForm(openAddForm)}><Plus size={14} /> Add item</Button>}
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!canManage && (
        <p className="mb-space-4 text-[13px] text-ink-400">
          Menu management isn&apos;t available for your account type. Contact support if you need changes made.
        </p>
      )}

      {showForm && (
        <Card className="mb-space-5 p-space-5">
          <h2 className="text-body-lg mb-space-4 font-semibold">{editingId ? "Edit item" : "Add item"}</h2>
          <form onSubmit={handleSave}>
            <Field label="Name" htmlFor="mi-name" required>
              <Input
                id="mi-name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Description" htmlFor="mi-description">
              <Textarea
                id="mi-description" value={form.description} rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-space-4 sm:grid-cols-2">
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
              label={editingId ? "Stock count" : "Starting stock"} htmlFor="mi-stock"
              hint="Portions available. Leave blank for unlimited. Use Restock on the item to add more later."
            >
              <Input
                id="mi-stock" type="number" min="0" value={form.stock_count}
                onChange={(e) => setForm({ ...form, stock_count: e.target.value })}
              />
            </Field>
            <Field
              label="Photo link" htmlFor="mi-image"
              hint="Optional. Paste a public https:// link to a photo of the dish; guests see it when they open the item on WhatsApp."
            >
              <Input
                id="mi-image" type="url" inputMode="url" placeholder="https://…" value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </Field>
            {form.image_url.trim().startsWith("https://") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.image_url.trim()} alt="Photo preview"
                className="mb-space-3 h-32 w-32 rounded-md object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                onLoad={(e) => { e.currentTarget.style.display = ""; }}
              />
            )}
            <CheckboxRow
              checked={form.is_available}
              onChange={(checked) => setForm({ ...form, is_available: checked })}
            >
              Available for ordering (untick to mark sold out without changing the stock count)
            </CheckboxRow>
            {formError && <p className="mt-space-2 text-[13px] text-error">{formError}</p>}
            <div className="mt-space-4 flex gap-space-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {!items ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-ink-400">No menu items yet. Add your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const soldOut = !item.is_available;
            const outOfStock = item.stock_count === 0;
            const restockAmount = Math.floor(Number(restockAmounts[item.id]));
            return (
              <Card
                key={item.id} elevation="interactive"
                onClick={() => canManage && openForm(() => openEditForm(item))} className="p-space-4"
              >
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url} alt={item.name} loading="lazy"
                    className="mb-space-2 h-28 w-full rounded-md object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div className="mb-space-2 flex items-start justify-between gap-space-2">
                  <h3 className="text-body-lg font-semibold">{item.name}</h3>
                  <Badge tone={soldOut ? "neutral" : outOfStock ? "clay" : "success"}>
                    {soldOut ? "Sold out" : outOfStock ? "Out of stock" : "Available"}
                  </Badge>
                </div>
                {item.category && <p className="mb-space-1 text-[12px] text-ink-400">{item.category}</p>}
                {item.description && <p className="mb-space-2 text-[13px] text-ink-600">{item.description}</p>}
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold">₹{(item.price_paise / 100).toFixed(2)}</span>
                  <span className="text-ink-400">
                    {item.stock_count === null ? "Unlimited stock" : `${item.stock_count} in stock`}
                  </span>
                </div>
                {canManage && (
                  <div
                    className="mt-space-3 flex flex-wrap items-center gap-space-2 border-t border-line pt-space-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.stock_count !== null && (
                      <>
                        {[5, 10].map((n) => (
                          <Button
                            key={n} size="md" variant="secondary" disabled={busyId === item.id}
                            onClick={() => handleRestock(item, n)}
                          >
                            +{n}
                          </Button>
                        ))}
                        <Input
                          type="number" min="1" aria-label={`Restock ${item.name} by`} placeholder="+N"
                          className="h-10! w-20!" value={restockAmounts[item.id] ?? ""}
                          onChange={(e) => setRestockAmounts({ ...restockAmounts, [item.id]: e.target.value })}
                        />
                        <Button
                          size="md" variant="secondary"
                          disabled={busyId === item.id || !(restockAmount >= 1)}
                          onClick={async () => {
                            await handleRestock(item, restockAmount);
                            setRestockAmounts((prev) => ({ ...prev, [item.id]: "" }));
                          }}
                        >
                          Restock
                        </Button>
                      </>
                    )}
                    <label className="ml-auto flex items-center gap-space-2 text-[12px] text-ink-600">
                      Sold out
                      <Switch
                        checked={soldOut}
                        onChange={() => handleAvailability(item, soldOut)}
                        disabled={busyId === item.id}
                        aria-label={`Mark ${item.name} sold out`}
                      />
                    </label>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
