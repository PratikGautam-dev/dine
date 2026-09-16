import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  category: string | null;
  is_available: boolean;
  stock_count: number | null;
};

export type MenuItemFormState = {
  name: string;
  description: string;
  price_rupees: string;
  category: string;
  is_available: boolean;
  stock_count: string; // "" means unlimited (null)
};

export function emptyMenuItemForm(): MenuItemFormState {
  return { name: "", description: "", price_rupees: "", category: "", is_available: true, stock_count: "" };
}

function formToPayload(form: MenuItemFormState) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    price_rupees: Number(form.price_rupees) || 0,
    category: form.category.trim() || null,
    is_available: form.is_available,
    stock_count: form.stock_count.trim() === "" ? null : Number(form.stock_count),
  };
}

/** Loads + owns every mutation on the /portal/food-menu page -- add/edit a
 * menu item, including "daily stock reset" (Sub-stage 1's own v1 design
 * decision: no separate bulk-reset endpoint, stock_count is just another
 * field on this same edit form, the same way a price correction is). */
export function useMenuItems(ready: boolean) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuItemFormState>(emptyMenuItemForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/menu-items");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setItems((result.data as { menu_items: MenuItem[] }).menu_items);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyMenuItemForm());
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price_rupees: (item.price_paise / 100).toString(),
      category: item.category ?? "",
      is_available: item.is_available,
      stock_count: item.stock_count === null ? "" : item.stock_count.toString(),
    });
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Item name is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const path = editingId ? `/api/portal/menu-items/${editingId}` : "/api/portal/menu-items";
    const result = await portalFetch(path, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    setSaving(false);
    if (!result.ok) {
      if (result.unauthorized) {
        setFormError("Session expired — please log in again.");
      } else {
        setFormError(result.error);
      }
      return;
    }
    toast.success(editingId ? "Menu item updated" : "Menu item added");
    setShowForm(false);
    setEditingId(null);
    load();
  }

  return {
    items, error, load,
    showForm, editingId, form, setForm, formError, saving,
    openAddForm, openEditForm, cancelForm, handleSave,
  };
}
