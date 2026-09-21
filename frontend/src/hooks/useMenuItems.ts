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
  image_url: string | null;
};

export type MenuItemFormState = {
  name: string;
  description: string;
  price_rupees: string;
  category: string;
  is_available: boolean;
  stock_count: string; // "" means unlimited (null)
  stock_original: string; // what the count was when the form opened -- the count is only sent when changed
  image_url: string; // a public https link to a photo; "" means text-only
};

export function emptyMenuItemForm(): MenuItemFormState {
  return {
    name: "", description: "", price_rupees: "", category: "", is_available: true,
    stock_count: "", stock_original: "", image_url: "",
  };
}

function formToPayload(form: MenuItemFormState, editing: boolean) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    price_rupees: Number(form.price_rupees) || 0,
    category: form.category.trim() || null,
    is_available: form.is_available,
    image_url: form.image_url.trim() || null,
  };
  // An edit form loaded a while ago must not write its stale count over orders that have since used stock,
  // so on edit the count is only sent when staff actually changed it.
  if (!editing || form.stock_count.trim() !== form.stock_original.trim()) {
    payload.stock_count = form.stock_count.trim() === "" ? null : Number(form.stock_count);
  }
  return payload;
}

/** Loads + owns every mutation on the /portal/food-menu page -- add/edit a menu item, quick "restock +N",
 * and the sold-out switch (independent of the stock count). */
export function useMenuItems(ready: boolean) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    const data = result.data as { menu_items: MenuItem[]; categories?: string[] };
    setItems(data.menu_items);
    setCategories(data.categories ?? []);
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
      stock_original: item.stock_count === null ? "" : item.stock_count.toString(),
      image_url: item.image_url ?? "",
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
      body: JSON.stringify(formToPayload(form, editingId !== null)),
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

  async function handleRestock(item: MenuItem, add: number) {
    setBusyId(item.id);
    const result = await portalFetch(`/api/portal/menu-items/${item.id}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add }),
    });
    setBusyId(null);
    if (!result.ok) {
      toast.error("Couldn't restock", result.unauthorized ? "Session expired — please log in again." : result.error);
      return;
    }
    toast.success(`${item.name}: +${add} added`);
    // an open edit form for this item shows the new count, so saving can't write the old one back
    const updated = (result.data as { menu_item: MenuItem }).menu_item;
    if (editingId === item.id && updated) {
      const count = updated.stock_count === null ? "" : String(updated.stock_count);
      setForm((f) => ({ ...f, stock_count: count, stock_original: count }));
    }
    load();
  }

  async function handleAvailability(item: MenuItem, isAvailable: boolean) {
    setBusyId(item.id);
    const result = await portalFetch(`/api/portal/menu-items/${item.id}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: isAvailable }),
    });
    setBusyId(null);
    if (!result.ok) {
      toast.error("Couldn't update item", result.unauthorized ? "Session expired — please log in again." : result.error);
      return;
    }
    toast.success(isAvailable ? `${item.name} is back on the menu` : `${item.name} marked sold out`);
    if (editingId === item.id) setForm((f) => ({ ...f, is_available: isAvailable }));
    load();
  }

  return {
    items, categories, error, load, busyId,
    showForm, editingId, form, setForm, formError, saving,
    openAddForm, openEditForm, cancelForm, handleSave, handleRestock, handleAvailability,
  };
}
