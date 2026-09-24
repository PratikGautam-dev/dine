"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, Layers, Pencil, Plus, Search, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { DoctorScheduleForm } from "@/components/portal/DoctorScheduleForm";
import { DoctorLeaveManager } from "@/components/portal/DoctorLeaveManager";
import { DoctorSlotManager } from "@/components/portal/DoctorSlotManager";
import { DoctorTodayAppointments } from "@/components/portal/DoctorTodayAppointments";
import { DoctorCsvImport } from "@/components/portal/DoctorCsvImport";
import { cn } from "@/lib/cn";
import { useDoctors } from "@/hooks/useDoctors";

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

              <Card className="p-space-4">
                <h3 className="text-label mb-space-3 font-bold text-ink-900">Team</h3>
                {doctors.length > 0 && (
                  <div className="mb-space-3 flex flex-wrap gap-space-2">
                    <div className="relative min-w-[200px] flex-1">
                      <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      <input
                        type="text"
                        placeholder="Search name…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
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
                {doctors.length === 0 ? (
                  <p className="py-space-4 text-center text-[13px] text-ink-400">No team members yet.</p>
                ) : filteredDoctors.length === 0 ? (
                  <p className="py-space-4 text-center text-[13px] text-ink-400">No team members match your search/filter.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {filteredDoctors.map((doc) => {
                      const expanded = expandedId === doc.id;
                      return (
                        <li key={doc.id} className="py-space-3">
                          <div className="flex flex-col gap-space-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-space-3">
                              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(doc.name))}>
                                {doc.name.trim().charAt(0).toUpperCase() || "?"}
                              </div>
                              <div>
                                <p className="text-[13.5px] font-semibold text-ink-900">{doc.name}</p>
                                <p className="text-[12px] text-ink-600">{doc.department_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-space-3">
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
                              <Badge tone={doc.is_active ? "success" : "neutral"}>
                                {doc.is_active ? "Available" : "Unavailable"}
                              </Badge>
                              <Switch
                                checked={doc.is_active}
                                onChange={() => handleToggleActive(doc)}
                                disabled={togglingId === doc.id || !canManageDoctors}
                                aria-label={`Toggle ${doc.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : doc.id)}
                                className="text-ink-400 hover:text-ink-700"
                              >
                                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>
                          {expanded && (
                            <div className="mt-space-3 space-y-space-3">
                              <DoctorTodayAppointments doctorId={doc.id} />
                              <DoctorSlotManager doctorId={doc.id} />
                              <DoctorLeaveManager doctorId={doc.id} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
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
