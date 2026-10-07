"use client";

import { useMemo, useState } from "react";
import {
  Check,
  FileClock,
  KeyRound,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { ALL_PAGE_KEYS, PAGE_LABEL } from "@/components/portal/RolePermissionSummary";
import { createRoleColumns } from "@/components/portal/RolePermissionColumns";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement } from "@/hooks/useStaffManagement";
import { toast } from "@/lib/toast";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import {
  BUILT_IN_ROLES,
  orderedRoles,
  roleDescription,
  roleLabel,
  roleTone,
} from "@/lib/staffRoles";

export default function RolesAndPermissionsPage() {
  const session = useStaffSession();
  const canView = usePermission("roles", "view");
  const canWrite = usePermission("roles", "write");
  const { matrix, savingCell, handleToggle, creatingRole, createRole, deletingRole, deleteRole } =
    usePortalRoles(canView);
  // Only the staff list -- how many real people hold each role -- not the full Staff & Access page's
  // own filters/dialogs/etc.
  const { staff } = useStaffManagement(canView);

  const roles = useMemo(() => (matrix ? orderedRoles(matrix) : []), [matrix]);
  const usersByRole = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of staff ?? []) {
      if (s.is_active) counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
    }
    return counts;
  }, [staff]);

  const stats = useMemo(() => {
    if (!matrix) return null;
    const totalUsers = (staff ?? []).length;
    const activeRoles = roles.filter((r) => (usersByRole.get(r) ?? 0) > 0).length;
    const totalPermissions = roles.reduce(
      (sum, r) => sum + ALL_PAGE_KEYS.filter((p) => matrix[r]?.[p]?.view).length,
      0,
    );
    return { totalRoles: roles.length, totalUsers, activeRoles, totalPermissions };
  }, [matrix, roles, staff, usersByRole]);

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [addRoleError, setAddRoleError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleAddRole(e: React.FormEvent) {
    e.preventDefault();
    setAddRoleError(null);
    if (!newRoleName.trim()) {
      setAddRoleError("Role name is required.");
      return;
    }
    const ok = await createRole(newRoleName.trim());
    if (ok) {
      setNewRoleName("");
      setAddRoleOpen(false);
    }
  }

  async function handleDelete(role: string) {
    setPendingDelete(null);
    const err = await deleteRole(role);
    if (err) toast.error("Couldn't delete role", err);
    else toast.success(`"${roleLabel(role)}" deleted`);
  }

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="roles">
        <p className="text-[13px] text-ink-400">
          You don&apos;t have access to Roles &amp; Permissions.
        </p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="roles">
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles, permissions and access across the portal."
      />

      {stats && (
        <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Users size={22} />}
            label="Total Roles"
            value={stats.totalRoles}
            deltaPct={null}
            hint="Roles at this hospital"
            tone="brand"
          />
          <StatTile
            icon={<Users size={22} />}
            label="Total Users"
            value={stats.totalUsers}
            deltaPct={null}
            hint="Across all roles"
            tone="info"
          />
          <StatTile
            icon={<ShieldCheck size={22} />}
            label="Active Roles"
            value={stats.activeRoles}
            deltaPct={null}
            hint={`of ${stats.totalRoles} have an active user`}
            tone="success"
          />
          <StatTile
            icon={<KeyRound size={22} />}
            label="Total Permissions"
            value={stats.totalPermissions}
            deltaPct={null}
            hint="Role x module combinations"
            tone="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 p-space-4">
          <div className="mb-space-3">
            <h2 className="text-[15px] font-bold text-ink-900">Role Management</h2>
            <p className="text-hint">
              {roles.length} role{roles.length === 1 ? "" : "s"} at this hospital.
            </p>
          </div>
          {!matrix ? (
            <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
          ) : (
            <div className="divide-y divide-line">
              {roles.map((role) => {
                const isBuiltIn = (BUILT_IN_ROLES as readonly string[]).includes(role);
                const userCount = usersByRole.get(role) ?? 0;
                const columns = createRoleColumns({
                  pageLabel: PAGE_LABEL,
                  cellFor: (pageKey) =>
                    matrix[role]?.[pageKey] || { view: false, write: false, delete: false },
                  canWrite,
                  isSaving: (pageKey, action) => savingCell === `${role}:${pageKey}:${action}`,
                  onToggle: (pageKey, action, next) => handleToggle(role, pageKey, action, next),
                });
                return (
                  <div key={role} className="py-space-3">
                    <div className="flex flex-wrap items-center gap-space-3">
                      <div className="min-w-[160px] flex-1">
                        <div className="flex items-center gap-space-2">
                          <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>
                          {!isBuiltIn && <span className="text-[11px] text-ink-400">Custom</span>}
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-600">{roleDescription(role)}</p>
                      </div>
                      <div className="w-24 shrink-0 text-[13px] text-ink-700">
                        {userCount} user{userCount === 1 ? "" : "s"}
                      </div>
                      <div className="w-20 shrink-0">
                        <Badge tone={userCount > 0 ? "success" : "neutral"}>
                          {userCount > 0 ? "Active" : "Unused"}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 items-center gap-space-2">
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setExpandedRole(expandedRole === role ? null : role)}
                        >
                          {expandedRole === role ? "Hide Permissions" : "Edit Permissions"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="md"
                          href={`/portal/settings/staff?role=${role}`}
                        >
                          <Users size={14} /> Manage Users
                        </Button>
                        {!isBuiltIn && (
                          <PermissionGate page="roles" action="write">
                            <button
                              type="button"
                              disabled={userCount > 0 || deletingRole === role}
                              onClick={() => setPendingDelete(role)}
                              title={
                                userCount > 0
                                  ? "Reassign its staff before deleting this role."
                                  : "Delete this role"
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                    {expandedRole === role && (
                      <div className="mt-space-3">
                        <DataTable
                          columns={columns}
                          data={ALL_PAGE_KEYS}
                          getRowId={(pageKey) => pageKey}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-space-4">
          <div className="mb-space-3">
            <h2 className="text-[15px] font-bold text-ink-900">Module Access Overview</h2>
            <p className="text-hint">
              Whether each role can view a module (its own real view permission).
            </p>
          </div>
          {!matrix ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="text-label border-b border-line text-ink-600">
                    <th className="py-space-2 pr-space-2 font-medium">Module</th>
                    {roles.map((r) => (
                      <th key={r} className="px-space-1 py-space-2 text-center font-medium">
                        {roleLabel(r)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_PAGE_KEYS.filter((p) => PAGE_LABEL[p]).map((pageKey) => (
                    <tr key={pageKey} className="border-b border-line last:border-0">
                      <td className="py-space-2 pr-space-2 text-ink-900">{PAGE_LABEL[pageKey]}</td>
                      {roles.map((r) => (
                        <td key={r} className="px-space-1 py-space-2 text-center">
                          {matrix[r]?.[pageKey]?.view ? (
                            <Check size={14} className="mx-auto text-success" />
                          ) : (
                            <Minus size={14} className="mx-auto text-ink-300" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <PermissionGate page="roles" action="write">
        <Card className="mt-space-4 p-space-4">
          <div className="mb-space-3">
            <h2 className="text-[15px] font-bold text-ink-900">Quick Actions</h2>
            <p className="text-hint">Common role and permission management tasks.</p>
          </div>
          <div className="flex flex-wrap gap-space-3">
            <button
              type="button"
              onClick={() => setAddRoleOpen(true)}
              className="flex flex-1 items-center justify-center gap-space-2 rounded-md border border-brand-300 px-space-4 py-space-3 text-[13.5px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Plus size={16} /> Add New Role
            </button>
            <a
              href="/portal/settings/activity"
              className="flex flex-1 items-center justify-center gap-space-2 rounded-md border border-brand-300 px-space-4 py-space-3 text-[13.5px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              <FileClock size={16} /> Audit Logs
            </a>
          </div>
        </Card>
      </PermissionGate>

      {addRoleOpen && (
        <Modal
          onClose={() => setAddRoleOpen(false)}
          labelledBy="add-role-title"
          maxWidthClass="max-w-[380px]"
        >
          <div className="mb-space-4 flex items-center justify-between">
            <h2 id="add-role-title" className="text-[16px] font-semibold text-ink-900">
              Add Role
            </h2>
            <button
              type="button"
              onClick={() => setAddRoleOpen(false)}
              className="text-ink-400 hover:text-ink-900"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAddRole}>
            <Field
              label="Role name"
              htmlFor="new-role-name"
              required
              hint='e.g. "Cashier" -- starts with no access; grant it what it needs from the matrix.'
            >
              <Input
                id="new-role-name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Cashier"
                autoFocus
              />
            </Field>
            {addRoleError && (
              <p className="mb-space-3 text-[12.5px] font-medium text-error">{addRoleError}</p>
            )}
            <div className="flex justify-end gap-space-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAddRoleOpen(false)}
                disabled={creatingRole}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingRole || !newRoleName.trim()}>
                {creatingRole ? "Adding…" : "Add Role"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete "${roleLabel(pendingDelete)}"?` : ""}
        message="This role's permission grid is removed for good. Only possible while nobody currently holds it."
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </PortalShell>
  );
}
