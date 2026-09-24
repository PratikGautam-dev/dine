"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CircleCheck, CircleX, Layers, Pencil, Plus, Search, UserRound, Upload, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { DoctorScheduleForm } from "@/components/portal/DoctorScheduleForm";
import { DoctorLeaveManager } from "@/components/portal/DoctorLeaveManager";
import { DoctorSlotManager } from "@/components/portal/DoctorSlotManager";
import { DoctorTodayAppointments } from "@/components/portal/DoctorTodayAppointments";
import { DoctorCsvImport } from "@/components/portal/DoctorCsvImport";
import { cn } from "@/lib/cn";
import { useDoctors, type Doctor } from "@/hooks/useDoctors";

// Same deterministic hash → color-cycle approach used across the Customers/WhatsApp Inbox pages.
const AVATAR_TONES = [
  "bg-brand-50 text-brand-700", "bg-info-tint text-info", "bg-success-tint text-success",
  "bg-warning-tint text-warning", "bg-accent-violet-tint text-accent-violet", "bg-clay-100 text-clay-700",
];
function avatarTone(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export default function PortalDoctorsPage() {
  const { hospital, ready } = usePortalGuard();
  const [activeTab, setActiveTab] = useState<"doctors" | "departments">("doctors");
  // Backend route guards already 403 the actual mutations for clinic tenants
  // lacking manage_doctors -- this is just a UI convenience so those staff
  // don't hit an error after filling out a form. Fails open (keeps the
  // controls) while hospital hasn't loaded yet, matching PortalSidebar.
  const canManageDoctors = !hospital || hospital.admin_capabilities?.includes("manage_doctors");
  const {
    departments, doctors, error, load,
    newDeptName, setNewDeptName, addingDept, handleAddDepartment,
    showDoctorForm, showCsvImport, doctorForm, setDoctorForm, doctorErrors, savingDoctor,
    editingDoctorId, loadingDoctorForEdit,
    openAddDoctorForm, toggleCsvImport, cancelDoctorForm, handleSaveDoctor, handleEditDoctor, handleToggleActive,
    expandedId, setExpandedId, togglingId,
    searchQuery, setSearchQuery, activeFilter, setActiveFilter, filteredDoctors,
  } = useDoctors(ready);

  const selected = doctors.find((d) => d.id === expandedId) ?? null;

  const sectionCounts = useMemo(() => {
    const byId = new Map<string, { department_name: string; count: number }>();
    for (const d of doctors) {
      const key = d.department_id;
      const existing = byId.get(key);
      if (existing) existing.count += 1;
      else byId.set(key, { department_name: d.department_name, count: 1 });
    }
    return Array.from(byId.values());
  }, [doctors]);

  const columns = useMemo<ColumnDef<Doctor>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div className="flex min-w-[170px] items-center gap-space-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(doc.name))}>
                {doc.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="font-semibold text-ink-900">{doc.name}</span>
            </div>
          );
        },
      },
      { id: "department", header: "Section", cell: ({ row }) => <span className="text-ink-600">{row.original.department_name}</span> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <Badge tone={row.original.is_active ? "success" : "neutral"}>{row.original.is_active ? "Available" : "Unavailable"}</Badge>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const doc = row.original;
          return (
            <div className="flex items-center justify-end gap-space-3" onClick={(e) => e.stopPropagation()}>
              {canManageDoctors && (
                <Switch
                  checked={doc.is_active}
                  onChange={() => handleToggleActive(doc)}
                  disabled={togglingId === doc.id}
                  aria-label={`Toggle ${doc.name}`}
                />
              )}
              {canManageDoctors && (
                <button
                  type="button"
                  onClick={() => handleEditDoctor(doc)}
                  disabled={loadingDoctorForEdit === doc.id}
                  className="text-ink-400 hover:text-ink-700 disabled:opacity-50"
                  title="Edit team member"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManageDoctors, togglingId, loadingDoctorForEdit],
  );

  return (
    <PortalShell hospital={hospital} active="doctors">
        <PageHeader
          title="Team & sections"
          actions={
            canManageDoctors && departments && departments.length > 0 && (
              <>
                <Button variant="secondary" size="md" onClick={toggleCsvImport}>
                  <Upload size={14} /> Bulk import
                </Button>
                <Button size="md" onClick={openAddDoctorForm}>
                  <Plus size={14} /> Add team member
                </Button>
              </>
            )
          }
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
        {!canManageDoctors && (
          <p className="mb-space-4 text-[13px] text-ink-400">
            Team and section management isn&apos;t available for your account type. Contact support if you need
            changes made.
          </p>
        )}

        {!departments ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : (
          <>
            <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={<Users size={22} />} label="Team members" value={doctors.length} deltaPct={null} hint="Total on record" tone="brand" filled />
              <StatTile icon={<CircleCheck size={22} />} label="Available" value={doctors.filter((d) => d.is_active).length} deltaPct={null} hint="Can be booked" tone="info" filled />
              <StatTile icon={<CircleX size={22} />} label="Unavailable" value={doctors.filter((d) => !d.is_active).length} deltaPct={null} hint="Currently off" tone="warning" filled />
              <StatTile icon={<Layers size={22} />} label="Sections" value={departments.length} deltaPct={null} hint="Departments in use" tone="violet" filled />
            </div>

            <div className="mb-space-4 flex flex-wrap gap-space-5 border-b border-line">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "doctors"}
                onClick={() => setActiveTab("doctors")}
                className={cn(
                  "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
                  activeTab === "doctors" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-600 hover:text-ink-900",
                )}
              >
                Team
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "departments"}
                onClick={() => setActiveTab("departments")}
                className={cn(
                  "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
                  activeTab === "departments" ? "border-brand-600 text-brand-600" : "border-transparent text-ink-600 hover:text-ink-900",
                )}
              >
                Sections
              </button>
            </div>

          {activeTab === "doctors" ? (
            <div className="space-y-space-4">
              {departments.length === 0 && (
                <Card className="p-space-4">
                  <p className="text-[12.5px] text-ink-400">Add a section first, then you can add team members to it.</p>
                </Card>
              )}

              {showCsvImport && <DoctorCsvImport onImported={() => { load(); }} />}

              {showDoctorForm && (
                <>
                  <p className="text-label -mb-space-2 font-bold text-ink-900">
                    {editingDoctorId ? "Edit team member" : "Add team member"}
                  </p>
                  <DoctorScheduleForm
                    departments={departments}
                    value={doctorForm}
                    onChange={setDoctorForm}
                    onSave={handleSaveDoctor}
                    onCancel={cancelDoctorForm}
                    saving={savingDoctor}
                    errors={doctorErrors}
                  />
                </>
              )}

              <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_360px]">
                <div className="min-w-0">
                  {doctors.length > 0 && (
                    <div className="mb-space-3 flex flex-wrap gap-space-2">
                      <div className="relative min-w-[200px] flex-1">
                        <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <Input
                          placeholder="Search name…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <select
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                        className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
                      >
                        <option value="all">All team members</option>
                        <option value="active">Available only</option>
                        <option value="inactive">Unavailable only</option>
                      </select>
                    </div>
                  )}
                  <Card className="p-space-2">
                    {doctors.length === 0 ? (
                      <p className="py-space-4 text-center text-[13px] text-ink-400">No team members yet.</p>
                    ) : filteredDoctors.length === 0 ? (
                      <p className="py-space-4 text-center text-[13px] text-ink-400">No team members match your search/filter.</p>
                    ) : (
                      <DataTable
                        columns={columns}
                        data={filteredDoctors}
                        getRowId={(d) => d.id}
                        onRowClick={(d) => setExpandedId(d.id)}
                        rowClassName={(d) => cn("cursor-pointer", selected?.id === d.id && "bg-brand-50/60")}
                      />
                    )}
                  </Card>
                </div>

                <div className="min-w-0">
                  {!selected ? (
                    <Card className="flex h-full min-h-[240px] flex-col items-center justify-center p-space-4 text-center">
                      <UserRound size={26} className="mb-space-2 text-ink-300" />
                      <p className="text-[13px] text-ink-400">Select a team member to see their schedule.</p>
                    </Card>
                  ) : (
                    <Card className="p-space-4">
                      <div className="mb-space-4 flex items-center justify-between">
                        <h3 className="text-[15px] font-bold text-ink-900">Team Member Profile</h3>
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="rounded-md p-1 text-ink-400 hover:bg-black/4 hover:text-ink-900"
                          aria-label="Close"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="mb-space-4 flex items-center gap-space-3">
                        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold", avatarTone(selected.name))}>
                          {selected.name.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-ink-900">{selected.name}</p>
                          <p className="text-[12.5px] text-ink-600">{selected.department_name}</p>
                        </div>
                      </div>
                      <div className="mb-space-4 flex items-center gap-space-2">
                        <Badge tone={selected.is_active ? "success" : "neutral"}>{selected.is_active ? "Available" : "Unavailable"}</Badge>
                      </div>
                      {canManageDoctors && (
                        <div className="mb-space-4 flex flex-wrap gap-space-2">
                          <Button variant="secondary" size="md" onClick={() => handleEditDoctor(selected)} disabled={loadingDoctorForEdit === selected.id}>
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            variant="secondary" size="md" onClick={() => handleToggleActive(selected)} disabled={togglingId === selected.id}
                          >
                            {selected.is_active ? "Mark unavailable" : "Mark available"}
                          </Button>
                        </div>
                      )}
                      <div className="space-y-space-3 border-t border-line pt-space-3">
                        <DoctorTodayAppointments doctorId={selected.id} />
                        <DoctorSlotManager doctorId={selected.id} />
                        <DoctorLeaveManager doctorId={selected.id} />
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              {sectionCounts.length > 0 && (
                <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-2">
                  <DepartmentDonut
                    data={sectionCounts}
                    title="Team by section"
                    subtitle="How your team is distributed"
                    unit="members"
                    emptyText="No team members yet."
                  />
                  <Card className="p-space-4">
                    <div className="mb-space-3">
                      <h3 className="text-[15px] font-bold text-ink-900">Sections</h3>
                      <p className="text-hint">Headcount per section</p>
                    </div>
                    <ol className="divide-y divide-line">
                      {sectionCounts.map((s, i) => (
                        <li key={s.department_name} className="flex items-center gap-space-3 py-space-2">
                          <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">{s.department_name}</span>
                          <span className="text-right text-[12.5px] tabular-nums text-ink-600">{s.count} member{s.count === 1 ? "" : "s"}</span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <Card className="h-fit p-space-4">
              <h3 className="text-label mb-space-3 font-bold text-ink-900">Sections</h3>
              {canManageDoctors && (
                <form onSubmit={handleAddDepartment} className="mb-space-3 flex gap-space-2">
                  <Input placeholder="New section" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                  <Button type="submit" size="md" disabled={addingDept || !newDeptName.trim()}>
                    <Plus size={14} />
                  </Button>
                </form>
              )}
              {departments.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No sections yet.</p>
              ) : (
                <ul className="space-y-space-1">
                  {departments.map((d) => (
                    <li key={d.id} className="rounded-md bg-paper px-space-3 py-space-2 text-[13px] text-ink-900">
                      {d.name}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          </>
        )}
    </PortalShell>
  );
}
