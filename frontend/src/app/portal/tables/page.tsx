"use client";

import { useMemo, useState } from "react";
import {
  Armchair, CircleCheck, CircleSlash, Clock3, Plus, Search, Sparkles, UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { FloorMap } from "@/components/portal/FloorMap";
import { PortalShell } from "@/components/portal/PortalShell";
import { SectionsPanel } from "@/components/portal/SectionsPanel";
import { StatTile } from "@/components/portal/StatTile";
import { TableDetailsPanel } from "@/components/portal/TableDetailsPanel";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { type RestaurantTable, useRestaurantTables } from "@/hooks/useRestaurantTables";
import { cn } from "@/lib/cn";
import { usePermission } from "@/lib/staffAuth";

type StatusView = "all" | "free" | "occupied" | "needs_cleaning" | "blocked";

const STATUS_BADGE: Record<RestaurantTable["status"], "success" | "brand" | "violet"> = {
  free: "success", occupied: "brand", needs_cleaning: "violet", blocked: "violet",
};

function statusLabel(t: RestaurantTable): string {
  if (t.status === "free" && t.is_reserved_soon) return "Reserved";
  if (t.status === "free") return "Available";
  if (t.status === "occupied") return "Occupied";
  if (t.status === "needs_cleaning") return "Cleaning";
  return "Blocked";
}

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
    statusActingId, setTableStatus, updatePosition,
    addSection, renameSection, moveSection, deleteSection,
  } = useRestaurantTables(ready);

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusView, setStatusView] = useState<StatusView>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeTables = useMemo(() => tables.filter((t) => t.is_active), [tables]);
  const stats = useMemo(() => ({
    total: activeTables.length,
    available: activeTables.filter((t) => t.status === "free" && !t.is_reserved_soon).length,
    reserved: activeTables.filter((t) => t.status === "free" && t.is_reserved_soon).length,
    occupied: activeTables.filter((t) => t.status === "occupied").length,
    cleaningBlocked: activeTables.filter((t) => t.status === "needs_cleaning" || t.status === "blocked").length,
  }), [activeTables]);

  const visibleTables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (sectionFilter !== "all" && t.department_id !== sectionFilter) return false;
      if (statusView !== "all" && t.status !== statusView) return false;
      return !q || t.name.toLowerCase().includes(q);
    });
  }, [tables, search, sectionFilter, statusView]);

  const selectedTable = tables.find((t) => t.id === selectedId) || null;

  return (
    <PortalShell hospital={hospital} active="tables">
      <PageHeader
        title="Tables"
        icon={<Armchair size={22} />}
        description="Manage your dining area, track table status and handle reservations in real-time."
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
          <StatTile tone="success" filled icon={<Armchair size={22} />} label="Total Tables" value={stats.total} deltaPct={null} hint={`Across ${sections.length} ${sections.length === 1 ? "zone" : "zones"}`} />
          <StatTile tone="info" filled icon={<CircleCheck size={22} />} label="Available" value={stats.available} deltaPct={null} hint={stats.total ? `${Math.round((stats.available / stats.total) * 100)}% of total` : "—"} />
          <StatTile tone="warning" filled icon={<Clock3 size={22} />} label="Reserved" value={stats.reserved} deltaPct={null} hint="Booked in the next 2h" />
          <StatTile tone="brand" filled icon={<UtensilsCrossed size={22} />} label="Occupied" value={stats.occupied} deltaPct={null} hint={stats.total ? `${Math.round((stats.occupied / stats.total) * 100)}% of total` : "—"} />
          <StatTile tone="violet" filled icon={<Sparkles size={22} />} label="Cleaning / Blocked" value={stats.cleaningBlocked} deltaPct={null} hint={stats.total ? `${Math.round((stats.cleaningBlocked / stats.total) * 100)}% of total` : "—"} />
        </div>
      )}

      <div className="mb-space-4 grid grid-cols-1 items-start gap-space-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FloorMap tables={tables} selectedId={selectedId} onSelect={(t) => setSelectedId(t.id)} onMove={updatePosition} />
        <TableDetailsPanel
          table={selectedTable}
          canWrite={canManage}
          statusActingId={statusActingId}
          onSeat={(id) => setTableStatus(id, "seat")}
          onNeedsCleaning={(id) => setTableStatus(id, "needs_cleaning")}
          onClear={(id) => setTableStatus(id, "clear")}
          onBlock={(id) => setTableStatus(id, "block")}
          onUnblock={(id) => setTableStatus(id, "unblock")}
          onEdit={(t) => openEditForm(t)}
        />
      </div>

      {showForm && (
        <Card className="mb-space-4 p-space-5">
          <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">{editingId ? "Edit table" : "Add table"}</h2>
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="t-name" required>
                <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
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
              <Field label="Shape on floor map" htmlFor="t-shape">
                <select
                  id="t-shape" value={form.shape}
                  onChange={(e) => setForm({ ...form, shape: e.target.value as "rect" | "round" })}
                  className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
                >
                  <option value="rect">Square / rectangular</option>
                  <option value="round">Round</option>
                </select>
              </Field>
            </div>
            <Field label="Notes (optional)" htmlFor="t-notes" hint="e.g. near entrance, good for families">
              <Input id="t-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
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

      {departments && <SectionsPanel sections={sections} canManage={canManage} busy={sectionBusy} onAdd={addSection} onRename={renameSection} onMove={moveSection} onDelete={deleteSection} />}

      <Card className="mt-space-4 p-space-4">
        <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-2">
          <h3 className="text-[15px] font-bold text-ink-900">All Tables ({tables.length})</h3>
          <div className="flex flex-wrap items-center gap-space-2">
            <select
              aria-label="Filter by zone" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}
              className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
            >
              <option value="all">All Zones</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              aria-label="Filter by status" value={statusView} onChange={(e) => setStatusView(e.target.value as StatusView)}
              className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
            >
              <option value="all">All Status</option>
              <option value="free">Available</option>
              <option value="occupied">Occupied</option>
              <option value="needs_cleaning">Needs cleaning</option>
              <option value="blocked">Blocked</option>
            </select>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text" placeholder="Search tables…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-56 rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
              />
            </div>
          </div>
        </div>

        {!departments ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
        ) : visibleTables.length === 0 ? (
          <p className="py-space-4 text-center text-[13px] text-ink-400">No tables match your search or filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
                  <th className="py-space-2 pr-space-2">#</th>
                  <th className="py-space-2 pr-space-2">Table</th>
                  <th className="py-space-2 pr-space-2">Capacity</th>
                  <th className="py-space-2 pr-space-2">Zone</th>
                  <th className="py-space-2 pr-space-2">Status</th>
                  <th className="py-space-2 pr-space-2">Current Guest</th>
                  <th className="py-space-2 pr-space-2">Assigned Booking</th>
                  <th className="py-space-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTables.map((t, i) => (
                  <tr key={t.id} className={cn("border-b border-line last:border-0", !t.is_active && "opacity-60")}>
                    <td className="py-space-2 pr-space-2 tabular-nums text-ink-600">{i + 1}</td>
                    <td className="py-space-2 pr-space-2 font-semibold text-ink-900">{t.name}</td>
                    <td className="py-space-2 pr-space-2 tabular-nums text-ink-600">{t.capacity}</td>
                    <td className="py-space-2 pr-space-2 text-ink-600">{t.department_name}</td>
                    <td className="py-space-2 pr-space-2"><Badge tone={t.status === "free" && t.is_reserved_soon ? "warning" : STATUS_BADGE[t.status]}>{statusLabel(t)}</Badge></td>
                    <td className="py-space-2 pr-space-2 text-ink-600">
                      {t.current_occupant ? `${t.current_occupant.guest_name || "Guest"} · ${t.current_occupant.party_size ?? "—"}p` : "—"}
                    </td>
                    <td className="py-space-2 pr-space-2 text-ink-600">{t.current_occupant?.reference_id || "—"}</td>
                    <td className="py-space-2 text-right">
                      <div className="flex items-center justify-end gap-space-2">
                        <button type="button" onClick={() => setSelectedId(t.id)} className="rounded-md border border-line bg-card px-space-3 py-1 text-[12px] font-semibold text-ink-900 hover:bg-paper">
                          View
                        </button>
                        {canManage && (
                          <button type="button" onClick={() => handleToggleActive(t)} disabled={togglingId === t.id} aria-label={`Toggle ${t.name}`} className="text-ink-400 hover:text-brand-600 disabled:opacity-50">
                            <CircleSlash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}
