"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2, ChefHat, CircleCheck, KeyRound, Mail, MoreHorizontal, Pencil, Phone, Plus, Power, Search, ShieldCheck,
  UserPlus, Users, UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { EditStaffBranchesDialog } from "@/components/portal/EditStaffBranchesDialog";
import { ResetStaffPasswordDialog } from "@/components/portal/ResetStaffPasswordDialog";
import { RolePermissionSummary, summariseRole } from "@/components/portal/RolePermissionSummary";
import { StaffActivityCard } from "@/components/portal/StaffActivityCard";
import { StatTile } from "@/components/portal/StatTile";
import { StaffFormDialog } from "@/components/portal/StaffFormDialog";
import { usePortalAuditLog } from "@/hooks/usePortalAuditLog";
import { cn } from "@/lib/cn";
import { formatOrderTime } from "@/lib/foodOrders";
import { toast } from "@/lib/toast";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { BUILT_IN_ROLES, orderedRoles, roleLabel, roleTone } from "@/lib/staffRoles";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement, type MergedRow, type StaffMember } from "@/hooks/useStaffManagement";
import { useBranchFilter } from "@/lib/branchContext";

const SELECT_CLASS = "h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

// Derived from the real permission matrix (how many pages this role can change), not a separate
// invented field -- "Full Access"/"Standard"/"Limited" are just readable buckets over that real count.
function accessLevel(changeCount: number): { label: string; tone: "success" | "brand" | "warning" | "neutral" } {
  if (changeCount >= 8) return { label: "Full Access", tone: "success" };
  if (changeCount >= 3) return { label: "Standard", tone: "brand" };
  if (changeCount > 0) return { label: "Limited", tone: "warning" };
  return { label: "View only", tone: "neutral" };
}

function columnsFor(matrix: ReturnType<typeof usePortalRoles>["matrix"]): ColumnDef<MergedRow, unknown>[] {
  return [
    {
      id: "employee_id",
      header: "ID",
      cell: ({ row }) => <span className="text-[12px] text-ink-600">{row.original.has_login ? row.original.staff.employee_id ?? "—" : "—"}</span>,
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const name = row.original.has_login ? row.original.staff.name : row.original.roster.name;
        const sub = row.original.has_login ? row.original.staff.email : "No portal login yet";
        return (
          <div className="flex items-center gap-space-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
              {initials(name)}
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-ink-900">{name}</p>
              <p className={cn("text-[12px]", row.original.has_login ? "text-ink-600" : "text-ink-400 italic")}>{sub}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) =>
        row.original.has_login ? (
          <div className="whitespace-nowrap">
            <Badge tone={roleTone(row.original.staff.role)}>{roleLabel(row.original.staff.role)}</Badge>
          </div>
        ) : (
          <Badge tone="neutral">Roster only</Badge>
        ),
    },
    {
      id: "section",
      header: "Section",
      cell: ({ row }) => (
        <span className="text-[13px] text-ink-700">
          {(row.original.has_login ? row.original.staff.department_name : row.original.roster.department_name) ?? "—"}
        </span>
      ),
    },
    {
      id: "phone",
      header: "Contact",
      cell: ({ row }) => <span className="text-[13px] text-ink-700">{(row.original.has_login && row.original.staff.phone) || "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.has_login ? row.original.staff.is_active : row.original.roster.is_active;
        return (
          <div className="whitespace-nowrap">
            <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Deactivated"}</Badge>
          </div>
        );
      },
    },
    {
      id: "access",
      header: "Access",
      cell: ({ row }) => {
        if (!row.original.has_login) return <span className="text-ink-400">No login</span>;
        if (!matrix) return <span className="text-ink-400">—</span>;
        const { change } = summariseRole(matrix, row.original.staff.role);
        const level = accessLevel(change.length);
        return (
          <span className={cn("inline-flex rounded-full px-space-2 py-0.5 text-[11px] font-bold",
            level.tone === "success" && "bg-success-tint text-success",
            level.tone === "brand" && "bg-brand-50 text-brand-700",
            level.tone === "warning" && "bg-warning-tint text-warning",
            level.tone === "neutral" && "bg-black/4 text-ink-600",
          )}>
            {level.label}
          </span>
        );
      },
    },
  ];
}

function RowActions({
  row, selfId, showBranches, onEdit, onResetPassword, onEditBranches, onToggle, onGrantAccess,
}: {
  row: MergedRow; selfId: number | null; showBranches: boolean;
  onEdit: () => void; onResetPassword: () => void; onEditBranches: () => void; onToggle: () => void; onGrantAccess: () => void;
}) {
  const name = row.has_login ? row.staff.name : row.roster.name;
  const isActive = row.has_login ? row.staff.is_active : row.roster.is_active;
  const isSelf = row.has_login && row.staff.id === selfId;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/4 hover:text-ink-900"
          aria-label={`Actions for ${name}`}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {!row.has_login && (
              <DropdownMenuItem onClick={onGrantAccess}><UserPlus size={14} /> Give portal access</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}><Pencil size={14} /> Edit</DropdownMenuItem>
            {row.has_login && (
              <DropdownMenuItem onClick={onResetPassword}><KeyRound size={14} /> Reset password</DropdownMenuItem>
            )}
            {row.has_login && showBranches && (
              <DropdownMenuItem onClick={onEditBranches}><Building2 size={14} /> Branch access</DropdownMenuItem>
            )}
            {!isSelf && (
              <DropdownMenuItem variant={isActive ? "destructive" : undefined} onClick={onToggle}>
                <Power size={14} /> {isActive ? "Deactivate" : "Reactivate"}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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
    staff, roster, merged, visible, counts, sections, error, selected, setSelectedKey, dialog, setDialog,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    addStaff, editStaff, setActive, resetPassword, setStaffBranches, addRosterMember, setRosterActive, addSection,
  } = useStaffManagement(canView);
  const { multiBranchEnabled, branches } = useBranchFilter();
  // The real permission matrix, for the "what this role can do" summary and the role filter/Add-staff
  // dropdowns -- editing it lives on its own Roles & Permissions page now (only people who may see
  // Roles get it here at all).
  const canSeeRoles = usePermission("roles", "view");
  const { matrix } = usePortalRoles(canSeeRoles);
  const { entries: auditEntries } = usePortalAuditLog(canView);
  const selfId = session?.id ?? null;
  // Falls back to just the 3 built-ins if this viewer can't see the roles matrix (canSeeRoles
  // false, so `matrix` never loads) -- the role filter/Add-staff dropdowns must still work.
  const roles = useMemo(() => (matrix ? orderedRoles(matrix) : BUILT_IN_ROLES), [matrix]);

  // Roles & Permissions' "Manage Users" link (?role=cashier) lands here pre-filtered. Read directly
  // off window.location rather than next/navigation's useSearchParams(), which would force this
  // whole page out of static prerendering unless wrapped in its own <Suspense> boundary.
  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    if (role) setRoleFilter(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState("");
  const [newRosterDept, setNewRosterDept] = useState("");
  const [rosterError, setRosterError] = useState<string | null>(null);

  async function reactivateStaff(member: StaffMember) {
    const problem = await setActive(member, true);
    if (problem) toast.error("Couldn't reactivate", problem);
  }

  function toggleRow(row: MergedRow) {
    if (row.has_login) {
      if (row.staff.is_active) setDialog({ kind: "toggle", member: row.staff });
      else reactivateStaff(row.staff);
    } else {
      setRosterActive(row.roster, !row.roster.is_active).then((problem) => {
        if (problem) toast.error("Couldn't update", problem);
      });
    }
  }

  const columns = useMemo<ColumnDef<MergedRow, unknown>[]>(
    () => [
      ...columnsFor(matrix),
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="text-right">
            <RowActions
              row={row.original}
              selfId={selfId}
              showBranches={multiBranchEnabled && branches.length > 1}
              onEdit={() => (row.original.has_login ? setDialog({ kind: "edit", member: row.original.staff }) : setDialog({ kind: "grant", member: row.original.roster }))}
              onResetPassword={() => row.original.has_login && setDialog({ kind: "password", member: row.original.staff })}
              onEditBranches={() => row.original.has_login && setDialog({ kind: "branches", member: row.original.staff })}
              onToggle={() => toggleRow(row.original)}
              onGrantAccess={() => !row.original.has_login && setDialog({ kind: "grant", member: row.original.roster })}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, selfId],
  );

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setAddingSection(true);
    const err = await addSection(newSectionName.trim());
    setAddingSection(false);
    if (err) {
      toast.error("Couldn't add section", err);
      return;
    }
    setNewSectionName("");
    setSectionDialogOpen(false);
  }

  async function handleAddRoster(e: React.FormEvent) {
    e.preventDefault();
    setRosterError(null);
    if (!newRosterName.trim()) {
      setRosterError("Name is required.");
      return;
    }
    if (!newRosterDept) {
      setRosterError("Choose a section.");
      return;
    }
    const err = await addRosterMember(newRosterName.trim(), newRosterDept);
    if (err) {
      setRosterError(err);
      return;
    }
    setNewRosterName("");
    setNewRosterDept("");
    setDialog(null);
  }

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="staff">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Staff Management.</p>
      </PortalShell>
    );
  }

  const managersFor = (personId: number | null) =>
    (staff ?? []).filter((m) => m.is_active && m.id !== personId).map((m) => ({ id: m.id, name: m.name }));

  return (
    <PortalShell hospital={session?.hospital || null} active="staff">
      <PageHeader
        title="Team & Access"
        icon={<Users size={22} />}
        description="Everyone who works here -- who has a portal login, their role, permissions and account access."
        actions={
          <PermissionGate page="staff" action="write">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 items-center gap-space-2 rounded-md bg-brand-600 px-space-4 text-[14px] font-semibold text-white hover:bg-brand-700">
                <Plus size={14} /> Add team member
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setDialog({ kind: "add" })}><UserPlus size={14} /> With portal login</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog({ kind: "addRoster" })}><Users size={14} /> Roster only (no login)</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </PermissionGate>
        }
      />

      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          icon={<Users size={22} />} label="Total team" value={counts.total} deltaPct={null}
          hint={`${counts.withLogin} with login, ${counts.rosterOnly} roster-only`} tone="brand" filled
        />
        <StatTile icon={<CircleCheck size={22} />} label="Active" value={counts.active} deltaPct={null} hint={`${counts.total - counts.active} deactivated`} tone="info" filled />
        <StatTile
          icon={<ShieldCheck size={22} />} label="Owners & Managers"
          value={(staff ?? []).filter((m) => m.role === "admin" && m.is_active).length} deltaPct={null} hint="Full access"
          tone="warning" filled
        />
        <StatTile icon={<UtensilsCrossed size={22} />} label="Front of House" value={counts.frontOfHouse} deltaPct={null} hint="Host and floor team" tone="violet" filled />
        <StatTile icon={<ChefHat size={22} />} label="Kitchen" value={counts.kitchen} deltaPct={null} hint="Kitchen staff" tone="clay" filled />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                aria-label="Search team"
                placeholder="Search name, role, section…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select aria-label="Filter by role" className={SELECT_CLASS} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <select aria-label="Filter by status" className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">Active and deactivated</option>
              <option value="active">Active only</option>
              <option value="inactive">Deactivated only</option>
            </select>
          </div>

          <Card className="p-space-2">
            <h2 className="px-space-2 pt-space-1 pb-space-2 text-[15px] font-bold text-ink-900">Team Directory ({counts.total})</h2>
            {!staff || !roster ? (
              <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
            ) : (
              <DataTable
                columns={columns}
                data={visible}
                getRowId={(r) => r.key}
                pageSize={10}
                onRowClick={(r) => setSelectedKey(r.key)}
                rowClassName={(r) => cn("cursor-pointer", selected?.key === r.key && "bg-brand-50/60")}
                emptyMessage={merged.length === 0 ? "No team members yet." : "No one matches these filters."}
              />
            )}
          </Card>

          <Card className="mt-space-4 p-space-4">
            <div className="mb-space-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-ink-900">Sections</h3>
                <p className="text-hint">{sections.length} section{sections.length === 1 ? "" : "s"} guests and staff are organized by.</p>
              </div>
              <PermissionGate page="staff" action="write">
                <Button type="button" variant="secondary" size="md" onClick={() => setSectionDialogOpen(true)}>
                  <Plus size={14} /> Add section
                </Button>
              </PermissionGate>
            </div>
            <ul className="flex flex-wrap gap-space-2">
              {sections.map((s) => (
                <li key={s.id} className="rounded-full bg-paper px-space-3 py-1 text-[12.5px] font-semibold text-ink-700">{s.name}</li>
              ))}
              {sections.length === 0 && <li className="text-[13px] text-ink-400">No sections yet.</li>}
            </ul>
          </Card>

          {canSeeRoles && (
            <Card className="mt-space-4 flex items-center justify-between p-space-4">
              <div>
                <h3 className="text-[15px] font-bold text-ink-900">Roles &amp; Permissions</h3>
                <p className="text-hint">{roles.length} role{roles.length === 1 ? "" : "s"} -- what each can view, change, and delete across the portal.</p>
              </div>
              <Button variant="secondary" size="md" href="/portal/settings/roles">Manage roles →</Button>
            </Card>
          )}

          <div className="mt-space-4">
            <StaffActivityCard ready={canView} staff={staff} />
          </div>
        </div>

        <div>
        <Card className="h-fit p-space-5">
          {!selected ? (
            <p className="text-[13px] text-ink-400">Select someone to see their details.</p>
          ) : (
            <>
              <div className="mb-space-3 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink-900">{selected.has_login ? "Staff Profile" : "Roster Profile"}</h2>
              </div>
              <div className="mb-space-4 flex items-center gap-space-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-[16px] font-bold text-brand-700">
                  {initials(selected.has_login ? selected.staff.name : selected.roster.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-space-1">
                    <h3 className="truncate text-[15px] font-bold text-ink-900">{selected.has_login ? selected.staff.name : selected.roster.name}</h3>
                    <Badge tone={(selected.has_login ? selected.staff.is_active : selected.roster.is_active) ? "success" : "neutral"}>
                      {(selected.has_login ? selected.staff.is_active : selected.roster.is_active) ? "Active" : "Deactivated"}
                    </Badge>
                  </div>
                  <p className="text-[12.5px] text-ink-600">{selected.has_login ? roleLabel(selected.staff.role) : "No portal login yet"}</p>
                </div>
              </div>
              <div className="mb-space-4 space-y-space-2 text-[13px]">
                {selected.has_login && selected.staff.phone && (
                  <p className="flex items-center gap-space-2 text-ink-700"><Phone size={14} className="text-ink-400" /> {selected.staff.phone}</p>
                )}
                {selected.has_login && (
                  <p className="flex items-center gap-space-2 text-ink-700"><Mail size={14} className="text-ink-400" /> {selected.staff.email}</p>
                )}
                {(selected.has_login ? selected.staff.department_name : selected.roster.department_name) && (
                  <p className="flex items-center gap-space-2 text-ink-700">
                    <UtensilsCrossed size={14} className="text-ink-400" />
                    {selected.has_login ? selected.staff.department_name : selected.roster.department_name}
                  </p>
                )}
              </div>
              {selected.has_login ? (
                <div className="grid grid-cols-1 gap-space-3">
                  <Detail label="Employee ID" value={selected.staff.employee_id} />
                  <Detail label="Reports to" value={selected.staff.reports_to_name} />
                  <Detail label="Working days" value={selected.staff.working_days?.length ? selected.staff.working_days.join(", ") : null} />
                  <Detail label="Shift" value={selected.staff.shift_start && selected.staff.shift_end ? `${selected.staff.shift_start}–${selected.staff.shift_end}` : null} />
                  <Detail label="Address" value={selected.staff.address} />
                </div>
              ) : (
                <p className="rounded-md bg-paper px-space-3 py-space-3 text-[12.5px] text-ink-600">
                  On the roster, no portal account. Give them portal access to set a role, schedule and login.
                </p>
              )}
              <PermissionGate page="staff" action="write">
                <div className="mt-space-5 flex flex-wrap gap-space-2">
                  {!selected.has_login && (
                    <Button onClick={() => setDialog({ kind: "grant", member: selected.roster })}>
                      <UserPlus size={14} /> Give portal access
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => (selected.has_login ? setDialog({ kind: "edit", member: selected.staff }) : setDialog({ kind: "grant", member: selected.roster }))}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  {selected.has_login && (
                    <Button variant="secondary" onClick={() => setDialog({ kind: "password", member: selected.staff })}>
                      <KeyRound size={14} /> Reset password
                    </Button>
                  )}
                  {!(selected.has_login && selected.staff.id === selfId) && (
                    <Button variant={(selected.has_login ? selected.staff.is_active : selected.roster.is_active) ? "destructive" : "secondary"} onClick={() => toggleRow(selected)}>
                      <Power size={14} /> {(selected.has_login ? selected.staff.is_active : selected.roster.is_active) ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              </PermissionGate>

              {selected.has_login && auditEntries && auditEntries.length > 0 && (() => {
                const personLogs = auditEntries.filter((e) => e.entity_id === String(selected.staff.id)).slice(0, 4);
                if (personLogs.length === 0) return null;
                return (
                  <div className="mt-space-5 border-t border-line pt-space-3">
                    <p className="mb-space-2 text-[12px] font-semibold text-ink-600">RECENT ACTIVITY</p>
                    <ul className="space-y-space-2">
                      {personLogs.map((e) => (
                        <li key={e.id} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-ink-700">{e.action.replace(/_/g, " ")}</span>
                          <span className="text-ink-400">{formatOrderTime(e.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </>
          )}
        </Card>
        {selected?.has_login && canSeeRoles && matrix && <RolePermissionSummary matrix={matrix} role={selected.staff.role} />}
        </div>
      </div>

      {dialog?.kind === "add" && (
        <StaffFormDialog
          member={null} isSelf={false} sections={sections} managers={managersFor(null)}
          customRoles={roles.filter((r) => !(BUILT_IN_ROLES as readonly string[]).includes(r))}
          onSubmit={(values) => addStaff(values)} onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "grant" && (
        <StaffFormDialog
          member={null} isSelf={false} sections={sections} managers={managersFor(null)}
          customRoles={roles.filter((r) => !(BUILT_IN_ROLES as readonly string[]).includes(r))}
          initialValues={{ name: dialog.member.name, department_id: dialog.member.department_id }}
          addTitle="Give portal access"
          onSubmit={(values) => addStaff(values, dialog.member.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "edit" && (
        <StaffFormDialog
          member={dialog.member}
          isSelf={dialog.member.id === selfId}
          sections={sections}
          managers={managersFor(dialog.member.id)}
          customRoles={roles.filter((r) => !(BUILT_IN_ROLES as readonly string[]).includes(r))}
          onSubmit={(values) => editStaff(dialog.member, values)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "password" && (
        <ResetStaffPasswordDialog name={dialog.member.name} onSubmit={(pw) => resetPassword(dialog.member, pw)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "branches" && (
        <EditStaffBranchesDialog
          name={dialog.member.name}
          branches={branches}
          initialBranchIds={dialog.member.branch_ids}
          onSubmit={(branchIds) => setStaffBranches(dialog.member, branchIds)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "addRoster" && (
        <Modal onClose={() => setDialog(null)} labelledBy="add-roster-title" maxWidthClass="max-w-[400px]">
            <h2 id="add-roster-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">Add to roster</h2>
            <form onSubmit={handleAddRoster}>
              <Field label="Full name" htmlFor="roster-name" required>
                <Input id="roster-name" value={newRosterName} onChange={(e) => setNewRosterName(e.target.value)} autoFocus />
              </Field>
              <Field label="Section" htmlFor="roster-section" required hint="They can be given a portal login later, any time.">
                <select id="roster-section" className={SELECT_CLASS} value={newRosterDept} onChange={(e) => setNewRosterDept(e.target.value)}>
                  <option value="">Choose…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              {rosterError && <p className="mb-space-3 text-[12.5px] font-medium text-error">{rosterError}</p>}
              <div className="flex justify-end gap-space-2">
                <Button type="button" variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
                <Button type="submit" disabled={!newRosterName.trim() || !newRosterDept}>Add to roster</Button>
              </div>
            </form>
        </Modal>
      )}
      {sectionDialogOpen && (
        <Modal onClose={() => setSectionDialogOpen(false)} labelledBy="add-section-title" maxWidthClass="max-w-[380px]">
            <h2 id="add-section-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">Add section</h2>
            <form onSubmit={handleAddSection}>
              <Field label="Section name" htmlFor="new-section-name" required>
                <Input
                  id="new-section-name" placeholder="e.g. Kitchen, Front of House" value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)} autoFocus
                />
              </Field>
              <div className="mt-space-2 flex justify-end gap-space-2">
                <Button type="button" variant="secondary" onClick={() => setSectionDialogOpen(false)} disabled={addingSection}>Cancel</Button>
                <Button type="submit" disabled={addingSection || !newSectionName.trim()}>{addingSection ? "Adding…" : "Add section"}</Button>
              </div>
            </form>
        </Modal>
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
