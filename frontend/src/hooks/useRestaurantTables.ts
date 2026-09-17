import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Department = { id: string; name: string };
export type RestaurantTable = {
  id: string;
  name: string;
  department_id: string;
  department_name?: string;
  capacity: number;
  is_active: boolean;
};

export type TableFormState = {
  name: string;
  department_id: string;
  capacity: string;
  is_active: boolean;
};

export function emptyTableForm(departments: Department[]): TableFormState {
  return { name: "", department_id: departments[0]?.id ?? "", capacity: "2", is_active: true };
}

/** Loads + owns every mutation on the /portal/tables page -- the REAL
 * tables (physical dining tables, migration 0030) CRUD surface. Not to be
 * confused with /portal/doctors ("Staff & sections"), which manages the
 * doctors entity kept as this product's staff/schedule concept -- see
 * PortalSidebar.tsx's own comment on why both pages exist. */
export function useRestaurantTables(ready: boolean) {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TableFormState>({ name: "", department_id: "", capacity: "2", is_active: true });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/tables");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    const data = result.data as { departments: Department[]; tables: RestaurantTable[] };
    setDepartments(data.departments);
    const byId = new Map(data.departments.map((d) => [d.id, d.name]));
    setTables(data.tables.map((t) => ({ ...t, department_name: byId.get(t.department_id) })));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyTableForm(departments ?? []));
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(table: RestaurantTable) {
    setEditingId(table.id);
    setForm({
      name: table.name, department_id: table.department_id,
      capacity: String(table.capacity), is_active: table.is_active,
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
      setFormError("Table name is required.");
      return;
    }
    if (!form.department_id) {
      setFormError("Choose a section.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const path = editingId ? `/api/portal/tables/${editingId}` : "/api/portal/tables";
    const result = await portalFetch(path, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(), department_id: form.department_id,
        capacity: Number(form.capacity) || 1, is_active: form.is_active,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      if (result.unauthorized) setFormError("Session expired — please log in again.");
      else setFormError(result.error);
      return;
    }
    toast.success(editingId ? "Table updated" : "Table added");
    setShowForm(false);
    setEditingId(null);
    load();
  }

  async function handleToggleActive(table: RestaurantTable) {
    setTogglingId(table.id);
    const result = await portalFetch(`/api/portal/tables/${table.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: table.name, department_id: table.department_id,
        capacity: table.capacity, is_active: !table.is_active,
      }),
    });
    setTogglingId(null);
    if (!result.ok) {
      toast.error("Couldn't update table", result.unauthorized ? "Session expired — please log in again." : result.error);
      return;
    }
    toast.success(table.is_active ? `${table.name} deactivated` : `${table.name} activated`);
    load();
  }

  return {
    departments, tables, error,
    showForm, editingId, form, setForm, formError, saving, togglingId,
    openAddForm, openEditForm, cancelForm, handleSave, handleToggleActive,
  };
}
