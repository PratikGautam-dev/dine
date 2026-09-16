"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useMenuItems } from "@/hooks/useMenuItems";

export default function PortalFoodMenuPage() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a tenant
  // lacking manage_food_ordering -- this is just a UI convenience, same
  // "fails open while hospital hasn't loaded" shape the Tables page's own
  // canManageDoctors check already uses.
  const canManage = !hospital || hospital.admin_capabilities?.includes("manage_food_ordering");
  const {
    items, error,
    showForm, editingId, form, setForm, formError, saving,
    openAddForm, openEditForm, cancelForm, handleSave,
  } = useMenuItems(ready);

  return (
    <PortalShell hospital={hospital} active="food-menu">
      <PageHeader
        title="Menu"
        description="What guests can order for pickup or delivery through WhatsApp."
        actions={canManage && <Button size="md" onClick={openAddForm}><Plus size={14} /> Add item</Button>}
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
              <Field label="Category" htmlFor="mi-category" hint="e.g. Starters, Mains, Beverages">
                <Input
                  id="mi-category" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label="Stock count" htmlFor="mi-stock"
              hint="Leave blank for unlimited. Editing this each day is how you reset today's stock."
            >
              <Input
                id="mi-stock" type="number" min="0" value={form.stock_count}
                onChange={(e) => setForm({ ...form, stock_count: e.target.value })}
              />
            </Field>
            <CheckboxRow
              checked={form.is_available}
              onChange={(checked) => setForm({ ...form, is_available: checked })}
            >
              Available for ordering
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
          {items.map((item) => (
            <Card key={item.id} elevation="interactive" onClick={() => canManage && openEditForm(item)} className="p-space-4">
              <div className="mb-space-2 flex items-start justify-between gap-space-2">
                <h3 className="text-body-lg font-semibold">{item.name}</h3>
                <Badge tone={item.is_available ? "success" : "neutral"}>
                  {item.is_available ? "Available" : "Unavailable"}
                </Badge>
              </div>
              {item.category && <p className="mb-space-1 text-[12px] text-ink-400">{item.category}</p>}
              {item.description && <p className="mb-space-2 text-[13px] text-ink-600">{item.description}</p>}
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">₹{(item.price_paise / 100).toFixed(2)}</span>
                <span className="text-ink-400">
                  {item.stock_count === null ? "Unlimited stock" : `${item.stock_count} left today`}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
