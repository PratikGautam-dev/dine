"use client";

import { useMemo, useState } from "react";
import { Armchair, CalendarDays, CircleCheck, CirclePause, Plus, Search, Users } from "lucide-react";
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
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useRestaurantTables } from "@/hooks/useRestaurantTables";
import { useTableBookingsToday } from "@/hooks/useTableBookingsToday";
import { cn } from "@/lib/cn";
import { formatTimeOnly } from "@/lib/formatDate";
import { usePermission } from "@/lib/staffAuth";

type StatusView = "all" | "active" | "inactive";

export default function PortalTablesPage() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a tenant
  // lacking manage_tables -- this is just a UI convenience, same "fails
  // open while hospital hasn't loaded" shape the Menu/Staff pages already use.
  // ...and the person's own role must be allowed to change tables too (Front of House and Kitchen only read them).
  const canWriteTables = usePermission("tables", "write");
  const canManage = (!hospital || hospital.admin_capabilities?.includes("manage_tables")) && canWriteTables;
  const {
    departments, sections, sectionBusy, tables, error,
    showForm, editingId, form, setForm, formError, saving, togglingId,
    openAddForm, openEditForm, cancelForm, handleSave, handleToggleActive,
    addSection, renameSection, moveSection, deleteSection,
  } = useRestaurantTables(ready);

  // Today's reservations per table, only for people who may see reservations.
  const canSeeReservations = usePermission("appointments", "view");
  const todayByTable = useTableBookingsToday(ready && canSeeReservations);

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusView, setStatusView] = useState<StatusView>("all");

  const stats = useMemo(() => {
    const active = tables.filter((t) => t.is_active);
    return {
      total: tables.length,
      active: active.length,
      inactive: tables.length - active.length,
      seats: active.reduce((sum, t) => sum + t.capacity, 0),
      bookedToday: todayByTable ? tables.filter((t) => (todayByTable[t.id] || []).length > 0).length : null,
    };
  }, [tables, todayByTable]);

  const visibleTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (sectionFilter !== "all" && t.department_id !== sectionFilter) return false;
      if (statusView === "active" && !t.is_active) return false;
      if (statusView === "inactive" && t.is_active) return false;
      return !q || t.name.toLowerCase().includes(q);
    });
  }, [tables, search, sectionFilter, statusView]);

  // Sections in their display order, each with its (filtered) tables; a section with no match is left out.
  const groups = useMemo(
    () =>
      sections
        .map((s) => ({ section: s, items: visibleTables.filter((t) => t.department_id === s.id) }))
        .filter((g) => g.items.length > 0),
    [sections, visibleTables],
  );

  return (
    <PortalShell hospital={hospital} active="tables">
      <PageHeader
        title="Tables"
        icon={<Armchair size={22} />}
        description="Set up your sections first, then add the physical tables guests get auto-assigned to when they book via WhatsApp."
        actions={
          canManage && departments && departments.length > 0 && (
            <Button size="md" onClick={openAddForm}><Plus size={14} /> Add table</Button>
          )
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!canManage && (
        <p className="mb-space-4 text-[13px] text-ink-400">
          Table management isn&apos;t available for your account type. Contact support if you need changes made.
        </p>
      )}

      {departments && (
        <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile icon={<Armchair size={22} />} label="Tables" value={stats.total} deltaPct={null} hint={`In ${sections.length} ${sections.length === 1 ? "section" : "sections"}`} />
          <StatTile icon={<CircleCheck size={22} />} label="Active" value={stats.active} deltaPct={null} hint="Bookable on WhatsApp" />
          <StatTile icon={<CirclePause size={22} />} label="Inactive" value={stats.inactive} deltaPct={null} hint="Switched off" />
          <StatTile icon={<Users size={22} />} label="Seats" value={stats.seats} deltaPct={null} hint="Across active tables" />
          {stats.bookedToday !== null && (
            <StatTile icon={<CalendarDays size={22} />} label="Booked today" value={stats.bookedToday} deltaPct={null} hint="Tables with a reservation" />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-space-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* On wide screens the sections list sits in the right column (like a details panel); on narrower ones it
            comes first, which is also the order to set things up in: sections, then tables. */}
        <div className="xl:col-start-2 xl:row-start-1">
          {showForm && (
            <Card className="mb-space-4 p-space-5">
              <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">{editingId ? "Edit table" : "Add table"}</h2>
              <form onSubmit={handleSave}>
                <Field label="Name" htmlFor="t-name" required>
                  <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2 xl:grid-cols-1">
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
          {departments && (
            <SectionsPanel
              sections={sections} canManage={canManage} busy={sectionBusy}
              onAdd={addSection} onRename={renameSection} onMove={moveSection} onDelete={deleteSection}
            />
          )}
        </div>

        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <div className="mb-space-3 flex items-baseline gap-space-2">
            <span className="text-eyebrow">Step 2</span>
            <h2 className="text-[15px] font-bold text-ink-900">Tables</h2>
          </div>

          {!departments ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : departments.length === 0 ? (
            <p className="text-[13px] text-ink-400">Add at least one section, then you can add tables to it.</p>
          ) : (
            <>
              <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
                {[{ id: "all", name: "All sections" }, ...sections.map((s) => ({ id: s.id, name: s.name }))].map((s) => (
                  <button
                    key={s.id} type="button" onClick={() => setSectionFilter(s.id)}
                    className={cn(
                      "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
                      sectionFilter === s.id
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="mb-space-4 flex flex-wrap items-center gap-space-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text" placeholder="Search tables…" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
                  />
                </div>
                <select
                  aria-label="Filter by status" value={statusView} onChange={(e) => setStatusView(e.target.value as StatusView)}
                  className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {tables.length === 0 ? (
                <p className="text-[13px] text-ink-400">No tables yet. Use Add table to create the first one.</p>
              ) : groups.length === 0 ? (
                <p className="text-[13px] text-ink-400">No tables match your search or filter.</p>
              ) : (
                groups.map(({ section, items }) => (
                  <section key={section.id} className="mb-space-5">
                    <div className="mb-space-2 flex items-baseline gap-space-2">
                      <h3 className="text-[14px] font-bold text-ink-900">{section.name}</h3>
                      <span className="text-hint">
                        {items.length} {items.length === 1 ? "table" : "tables"} · {items.reduce((n, t) => n + t.capacity, 0)} seats
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {items.map((table) => {
                        const times = todayByTable?.[table.id] || [];
                        return (
                          <Card key={table.id} className={cn("p-space-4", !table.is_active && "bg-paper")}>
                            <div className="mb-space-1 flex items-start justify-between gap-space-2">
                              <h4 className="text-body-lg font-semibold">{table.name}</h4>
                              <Badge tone={table.is_active ? "success" : "neutral"}>
                                {table.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-[13px] text-ink-600">Seats {table.capacity}</p>
                            {todayByTable && (
                              <p className="mt-space-1 text-[12px] text-ink-600">
                                {times.length === 0
                                  ? "Free today"
                                  : `${times.length} ${times.length === 1 ? "reservation" : "reservations"} today · ${times.map((t) => formatTimeOnly(t)).join(", ")}`}
                              </p>
                            )}
                            <div className="mt-space-3 flex items-center gap-space-3">
                              {canManage && (
                                <button
                                  type="button" onClick={() => openEditForm(table)}
                                  className="text-[13px] font-semibold text-brand-700 hover:underline"
                                >
                                  Edit
                                </button>
                              )}
                              <Switch
                                tone="success"
                                checked={table.is_active}
                                onChange={() => handleToggleActive(table)}
                                disabled={togglingId === table.id || !canManage}
                                aria-label={`Toggle ${table.name}`}
                              />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
