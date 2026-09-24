"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check, ChefHat, CircleCheck, KeyRound, Mail, MoreHorizontal, Pencil, Phone, Plus, Power, Search, ShieldCheck,
  Users, UtensilsCrossed, X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { ResetStaffPasswordDialog } from "@/components/portal/ResetStaffPasswordDialog";
import { PAGE_LABEL, RolePermissionSummary, summariseRole } from "@/components/portal/RolePermissionSummary";
import { StaffActivityCard } from "@/components/portal/StaffActivityCard";
import { StatTile } from "@/components/portal/StatTile";
import { StaffFormDialog } from "@/components/portal/StaffFormDialog";
import { usePortalAuditLog } from "@/hooks/usePortalAuditLog";
import { cn } from "@/lib/cn";
import { formatOrderTime } from "@/lib/foodOrders";
import { toast } from "@/lib/toast";
import { usePermission, useStaffSession, type StaffRole } from "@/lib/staffAuth";
import { ROLE_LABEL, ROLE_OPTIONS, ROLE_TONE } from "@/lib/staffRoles";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement, type StaffMember } from "@/hooks/useStaffManagement";

const SELECT_CLASS = "h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";

// A handful of representative pages for the compact matrix card -- the full grid (every page key)
// lives on /portal/settings/roles; this is a glance-and-click-through summary, not a duplicate editor.
const MATRIX_PREVIEW_KEYS = ["appointments", "tables", "food_menu", "food_orders", "staff", "roles"];
const MATRIX_ROLES: StaffRole[] = ["admin", "receptionist", "kitchen"];

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

function columnsFor(matrix: ReturnType<typeof usePortalRoles>["matrix"]): ColumnDef<StaffMember, unknown>[] {
  return [
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
    { id: "section", header: "Department", cell: ({ row }) => <span className="text-[13px] text-ink-700">{row.original.department_name ?? "—"}</span> },
    { id: "phone", header: "Contact", cell: ({ row }) => <span className="text-[13px] text-ink-700">{row.original.phone ?? "—"}</span> },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <Badge tone={row.original.is_active ? "success" : "neutral"}>{row.original.is_active ? "Active" : "Deactivated"}</Badge>
        </div>
      ),
    },
    {
      id: "access",
      header: "Access",
      cell: ({ row }) => {
        if (!matrix) return <span className="text-ink-400">—</span>;
        const { change } = summariseRole(matrix, row.original.role);
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

function StaffRowActions({
  member, selfId, onEdit, onResetPassword, onToggle,
}: { member: StaffMember; selfId: number | null; onEdit: () => void; onResetPassword: () => void; onToggle: () => void }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/4 hover:text-ink-900"
          aria-label={`Actions for ${member.name}`}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onEdit}><Pencil size={14} /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onResetPassword}><KeyRound size={14} /> Reset password</DropdownMenuItem>
            {member.id !== selfId && (
              <DropdownMenuItem variant={member.is_active ? "destructive" : undefined} onClick={onToggle}>
                <Power size={14} /> {member.is_active ? "Deactivate" : "Reactivate"}
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
    staff, visible, counts, sections, error, selected, setSelectedId, dialog, setDialog,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    addStaff, editStaff, setActive, resetPassword,
  } = useStaffManagement(canView);
  // The real permission matrix, for the "what this role can do" summary (only people who may see Roles get it).
  const canSeeRoles = usePermission("roles", "view");
  const { matrix } = usePortalRoles(canSeeRoles);
  const { entries: auditEntries } = usePortalAuditLog(canView);
  const selfId = session?.id ?? null;
  async function reactivate(member: StaffMember) {
    const problem = await setActive(member, true);
    if (problem) toast.error("Couldn't reactivate", problem);
  }
  const columns = useMemo<ColumnDef<StaffMember, unknown>[]>(
    () => [
      ...columnsFor(matrix),
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="text-right">
            <StaffRowActions
              member={row.original}
              selfId={selfId}
              onEdit={() => setDialog({ kind: "edit", member: row.original })}
              onResetPassword={() => setDialog({ kind: "password", member: row.original })}
              onToggle={() => (row.original.is_active ? setDialog({ kind: "toggle", member: row.original }) : reactivate(row.original))}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix, selfId],
  );

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
        title="Staff & Access"
        icon={<Users size={22} />}
        description="Manage your team members, roles, permissions and account access."
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
          hint={`${counts.total - counts.active} deactivated`} tone="brand" filled
        />
        <StatTile icon={<CircleCheck size={22} />} label="Active" value={counts.active} deltaPct={null} hint="Can sign in" tone="info" filled />
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
                aria-label="Search staff"
                placeholder="Search name, role, department…"
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
            <h2 className="px-space-2 pt-space-1 pb-space-2 text-[15px] font-bold text-ink-900">Staff Directory ({counts.total})</h2>
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

          <div className="mt-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
            {canSeeRoles && matrix && (
              <Card className="p-space-4">
                <div className="mb-space-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-ink-900">Roles & Permissions Matrix</h3>
                  <Button href="/portal/settings/roles" variant="secondary" size="md">View All</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-line text-left text-ink-600">
                        <th className="py-space-2 pr-space-2 font-semibold">Permission</th>
                        {MATRIX_ROLES.map((r) => (
                          <th key={r} className="px-space-2 py-space-2 text-center font-semibold whitespace-nowrap">{ROLE_LABEL[r]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MATRIX_PREVIEW_KEYS.map((key) => (
                        <tr key={key} className="border-b border-line last:border-0">
                          <td className="py-space-2 pr-space-2 font-medium text-ink-900 whitespace-nowrap">{PAGE_LABEL[key] || key}</td>
                          {MATRIX_ROLES.map((r) => {
                            const cell = matrix[r]?.[key];
                            return (
                              <td key={r} className="px-space-2 py-space-2 text-center">
                                {cell?.write ? (
                                  <Check size={15} className="mx-auto text-success" />
                                ) : cell?.view ? (
                                  <Check size={15} className="mx-auto text-warning" />
                                ) : (
                                  <X size={15} className="mx-auto text-ink-300" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
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
                <h2 className="text-[15px] font-bold text-ink-900">Staff Profile</h2>
              </div>
              <div className="mb-space-4 flex items-center gap-space-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-[16px] font-bold text-brand-700">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-space-1">
                    <h3 className="truncate text-[15px] font-bold text-ink-900">{selected.name}</h3>
                    <Badge tone={selected.is_active ? "success" : "neutral"}>{selected.is_active ? "Active" : "Deactivated"}</Badge>
                  </div>
                  <p className="text-[12.5px] text-ink-600">{ROLE_LABEL[selected.role]}</p>
                </div>
              </div>
              <div className="mb-space-4 space-y-space-2 text-[13px]">
                {selected.phone && (
                  <p className="flex items-center gap-space-2 text-ink-700"><Phone size={14} className="text-ink-400" /> {selected.phone}</p>
                )}
                <p className="flex items-center gap-space-2 text-ink-700"><Mail size={14} className="text-ink-400" /> {selected.email}</p>
                {selected.department_name && (
                  <p className="flex items-center gap-space-2 text-ink-700"><UtensilsCrossed size={14} className="text-ink-400" /> {selected.department_name}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-space-3">
                <Detail label="Employee ID" value={selected.employee_id} />
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

              {auditEntries && auditEntries.length > 0 && (() => {
                const personLogs = auditEntries.filter((e) => e.entity_id === String(selected.id)).slice(0, 4);
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
