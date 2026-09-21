"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { PortalShell } from "@/components/portal/PortalShell";
import { SectionsPanel } from "@/components/portal/SectionsPanel";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";

export default function PortalTablesPage() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a tenant
  // lacking manage_tables -- this is just a UI convenience, same "fails
  // open while hospital hasn't loaded" shape the Menu/Staff pages already use.
  const canManage = !hospital || hospital.admin_capabilities?.includes("manage_tables");
  const {
    departments, sections, sectionBusy, tables, error,
    showForm, editingId, form, setForm, formError, saving, togglingId,
    openAddForm, openEditForm, cancelForm, handleSave, handleToggleActive,
    addSection, renameSection, moveSection, deleteSection,
  } = useRestaurantTables(ready);

  return (
    <PortalShell hospital={hospital} active="tables">
      <PageHeader
        title="Tables"
        description="Set up your sections first, then add the physical tables guests get auto-assigned to when they book via WhatsApp."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!canManage && (
        <p className="mb-space-4 text-[13px] text-ink-400">
          Table management isn&apos;t available for your account type. Contact support if you need changes made.
        </p>
      )}
      {departments && (
        <SectionsPanel
          sections={sections} canManage={canManage} busy={sectionBusy}
          onAdd={addSection} onRename={renameSection} onMove={moveSection} onDelete={deleteSection}
        />
      )}

      <div className="mb-space-3 flex items-center justify-between gap-space-3">
        <div className="flex items-baseline gap-space-2">
          <span className="text-eyebrow">Step 2</span>
          <h2 className="text-[15px] font-bold text-ink-900">Tables</h2>
        </div>
        {canManage && departments && departments.length > 0 && (
          <Button size="md" onClick={openAddForm}><Plus size={14} /> Add table</Button>
        )}
      </div>
      {departments && departments.length === 0 && (
        <p className="mb-space-4 text-[13px] text-ink-400">Add at least one section above, then you can add tables to it.</p>
      )}

      {showForm && (
        <Card className="mb-space-5 p-space-5">
          <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">{editingId ? "Edit table" : "Add table"}</h2>
          <form onSubmit={handleSave}>
            <Field label="Name" htmlFor="t-name" required>
              <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
              <Field label="Section" htmlFor="t-department">
                <select
                  id="t-department" value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
                >
                  {(departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity" htmlFor="t-capacity" required>
                <Input
                  id="t-capacity" type="number" min="1" value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </Field>
            </div>
            <CheckboxRow checked={form.is_active} onChange={(checked) => setForm({ ...form, is_active: checked })}>
              Active (bookable via WhatsApp)
            </CheckboxRow>
            {formError && <p className="mt-space-2 text-[13px] text-error">{formError}</p>}
            <div className="mt-space-4 flex gap-space-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {!departments ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : tables.length === 0 ? (
        departments.length > 0 && <p className="text-[13px] text-ink-400">No tables yet. Use Add table to create the first one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <Card key={table.id} className="p-space-4">
              <div className="mb-space-2 flex items-start justify-between gap-space-2">
                <h3 className="text-body-lg font-semibold">{table.name}</h3>
                <Badge tone={table.is_active ? "success" : "neutral"}>
                  {table.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mb-space-1 text-[12px] text-ink-400">{table.department_name}</p>
              <p className="mb-space-3 text-[13px] text-ink-600">Seats {table.capacity}</p>
              <div className="flex items-center gap-space-3">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openEditForm(table)}
                    className="text-[13px] font-semibold text-brand-700 hover:underline"
                  >
                    Edit
                  </button>
                )}
                <Switch
                  checked={table.is_active}
                  onChange={() => handleToggleActive(table)}
                  disabled={togglingId === table.id || !canManage}
                  aria-label={`Toggle ${table.name}`}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
