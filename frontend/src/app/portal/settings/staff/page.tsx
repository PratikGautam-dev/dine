"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChefHat, CircleCheck, KeyRound, Pencil, Plus, Power, Search, ShieldCheck, Users, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { ResetStaffPasswordDialog } from "@/components/portal/ResetStaffPasswordDialog";
import { RolePermissionSummary } from "@/components/portal/RolePermissionSummary";
import { StaffActivityCard } from "@/components/portal/StaffActivityCard";
import { StatTile } from "@/components/portal/StatTile";
import { StaffFormDialog } from "@/components/portal/StaffFormDialog";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { ROLE_LABEL, ROLE_OPTIONS, ROLE_TONE } from "@/lib/staffRoles";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement, type StaffMember } from "@/hooks/useStaffManagement";

const SELECT_CLASS = "h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

const columns: ColumnDef<StaffMember, unknown>[] = [
  { id: "employee_id", header: "ID", cell: ({ row }) => <span className="text-[12px] text-ink-600">{row.original.employee_id ?? "—"}</span> },
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-space-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
          {initials(row.original.name)}
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-ink-900">{row.original.name}</p>
          <p className="text-[12px] text-ink-600">{row.original.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: "role",
    header: "Role",
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <Badge tone={ROLE_TONE[row.original.role]}>{ROLE_LABEL[row.original.role]}</Badge>
      </div>
    ),
  },
  { id: "section", header: "Section", cell: ({ row }) => <span className="text-[13px] text-ink-700">{row.original.department_name ?? "—"}</span> },
  { id: "phone", header: "Phone", cell: ({ row }) => <span className="text-[13px] text-ink-700">{row.original.phone ?? "—"}</span> },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <Badge tone={row.original.is_active ? "success" : "neutral"}>{row.original.is_active ? "Active" : "Deactivated"}</Badge>
      </div>
    ),
  },
];

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-label mb-0.5 font-medium text-ink-600">{label}</p>
      <p className="text-[13.5px] text-ink-900">{value || "—"}</p>
    </div>
  );
}

export default function StaffManagementPage() {
  const session = useStaffSession();
  const canView = usePermission("staff", "view");
  const {
    staff, visible, counts, sections, error, selected, setSelectedId, dialog, setDialog,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    addStaff, editStaff, setActive, resetPassword,
  } = useStaffManagement(canView);
  // The real permission matrix, for the "what this role can do" summary (only people who may see Roles get it).
  const canSeeRoles = usePermission("roles", "view");
  const { matrix } = usePortalRoles(canSeeRoles);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="staff">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Staff Management.</p>
      </PortalShell>
    );
  }

  const selfId = session?.id ?? null;
  async function reactivate(member: StaffMember) {
    const problem = await setActive(member, true);
    if (problem) toast.error("Couldn't reactivate", problem);
  }
  const managersFor = (personId: number | null) =>
    (staff ?? []).filter((m) => m.is_active && m.id !== personId).map((m) => ({ id: m.id, name: m.name }));

  return (
    <PortalShell hospital={session?.hospital || null} active="staff">
      <PageHeader
        title="Staff"
        icon={<Users size={22} />}
        description="Everyone who signs in to this restaurant's portal, and what they can do."
        actions={
          <PermissionGate page="staff" action="write">
            <Button size="md" onClick={() => setDialog({ kind: "add" })}>
              <Plus size={14} /> Add staff member
            </Button>
          </PermissionGate>
        }
      />

      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          icon={<Users size={22} />} label="Total staff" value={counts.total} deltaPct={null}
          hint={`${counts.total - counts.active} deactivated`}
        />
        <StatTile icon={<CircleCheck size={22} />} label="Active" value={counts.active} deltaPct={null} hint="Can sign in" />
        <StatTile
          icon={<ShieldCheck size={22} />} label="Owners & Managers"
          value={(staff ?? []).filter((m) => m.role === "admin" && m.is_active).length} deltaPct={null} hint="Full access"
        />
        <StatTile icon={<UtensilsCrossed size={22} />} label="Front of House" value={counts.frontOfHouse} deltaPct={null} hint="Host and floor team" />
        <StatTile icon={<ChefHat size={22} />} label="Kitchen" value={counts.kitchen} deltaPct={null} hint="Kitchen staff" />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                aria-label="Search staff"
                placeholder="Search name, email, phone, section or ID"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select aria-label="Filter by role" className={SELECT_CLASS} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select aria-label="Filter by status" className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">Active and deactivated</option>
              <option value="active">Active only</option>
              <option value="inactive">Deactivated only</option>
            </select>
          </div>

          <Card className="p-space-2">
            {!staff ? (
              <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
            ) : (
              <DataTable
                columns={columns}
                data={visible}
                getRowId={(m) => String(m.id)}
                pageSize={10}
                onRowClick={(m) => setSelectedId(m.id)}
                rowClassName={(m) => cn("cursor-pointer", selected?.id === m.id && "bg-brand-50/60")}
                emptyMessage={staff.length === 0 ? "No staff yet." : "No one matches these filters."}
              />
            )}
          </Card>
          <StaffActivityCard ready={canView} staff={staff} />
        </div>

        <div>
        <Card className="h-fit p-space-5">
          {!selected ? (
            <p className="text-[13px] text-ink-400">Select someone to see their details.</p>
          ) : (
            <>
              <div className="mb-space-4 flex items-center gap-space-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-700">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-ink-900">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-space-1">
                    <Badge tone={ROLE_TONE[selected.role]}>{ROLE_LABEL[selected.role]}</Badge>
                    <Badge tone={selected.is_active ? "success" : "neutral"}>{selected.is_active ? "Active" : "Deactivated"}</Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-space-3">
                <Detail label="Employee ID" value={selected.employee_id} />
                <Detail label="Email" value={selected.email} />
                <Detail label="Phone" value={selected.phone} />
                <Detail label="Section" value={selected.department_name} />
                <Detail label="Reports to" value={selected.reports_to_name} />
                <Detail label="Working days" value={selected.working_days?.length ? selected.working_days.join(", ") : null} />
                <Detail label="Shift" value={selected.shift_start && selected.shift_end ? `${selected.shift_start}–${selected.shift_end}` : null} />
                <Detail label="Address" value={selected.address} />
              </div>
              <PermissionGate page="staff" action="write">
                <div className="mt-space-5 flex flex-wrap gap-space-2">
                  <Button variant="secondary" onClick={() => setDialog({ kind: "edit", member: selected })}>
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog({ kind: "password", member: selected })}>
                    <KeyRound size={14} /> Reset password
                  </Button>
                  {selected.id !== selfId && (
                    <Button variant={selected.is_active ? "destructive" : "secondary"} onClick={() => (selected.is_active ? setDialog({ kind: "toggle", member: selected }) : reactivate(selected))}>
                      <Power size={14} /> {selected.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              </PermissionGate>
            </>
          )}
        </Card>
        {selected && canSeeRoles && matrix && <RolePermissionSummary matrix={matrix} role={selected.role} />}
        </div>
      </div>

      {dialog?.kind === "add" && (
        <StaffFormDialog member={null} isSelf={false} sections={sections} managers={managersFor(null)} onSubmit={addStaff} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "edit" && (
        <StaffFormDialog
          member={dialog.member}
          isSelf={dialog.member.id === selfId}
          sections={sections}
          managers={managersFor(dialog.member.id)}
          onSubmit={(values) => editStaff(dialog.member, values)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "password" && (
        <ResetStaffPasswordDialog name={dialog.member.name} onSubmit={(pw) => resetPassword(dialog.member, pw)} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={dialog?.kind === "toggle"}
        title={dialog?.kind === "toggle" ? `Deactivate ${dialog.member.name}?` : ""}
        message="They will be signed out immediately and can't sign in again until you reactivate them. Their history stays."
        confirmLabel="Deactivate"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "toggle") return;
          const problem = await setActive(dialog.member, false);
          setDialog(null);
          if (problem) toast.error("Couldn't deactivate", problem);
        }}
      />
    </PortalShell>
  );
}
