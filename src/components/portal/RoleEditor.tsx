"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PermissionGrid } from "@/components/portal/PermissionGrid";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePortalRoles, type PagePerms } from "@/hooks/usePortalRoles";
import { useStaffManagement } from "@/hooks/useStaffManagement";
import { ROLE_PAGES } from "@/lib/rolePages";
import { usePermission } from "@/lib/staffAuth";
import { BUILT_IN_ROLES, roleLabel } from "@/lib/staffRoles";
import { toast } from "@/lib/toast";

/** The built-in Owner / Manager has every permission, always: it opens read-only. */
export const isAdministrator = (role: string) => role === "admin";

/** Add a role (no `roleKey`) or edit one. The Administrator opens read-only. */
export function RoleEditor({ roleKey }: { roleKey?: string }) {
  const router = useRouter();
  const canView = usePermission("roles", "view");
  const roles = usePortalRoles(canView);
  const { staff } = useStaffManagement(canView);
  const canWrite = usePermission("roles", "write") && !(roleKey && isAdministrator(roleKey));
  const builtIn = !!roleKey && (BUILT_IN_ROLES as readonly string[]).includes(roleKey);
  const canDelete = usePermission("roles", "delete") && !!roleKey && !builtIn;
  const userCount = (staff ?? []).filter((s) => s.role === roleKey && s.is_active).length;

  const [name, setName] = useState("");
  // null = untouched: the grid then shows what is saved
  const [edited, setEdited] = useState<Record<string, PagePerms> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const missing = !!roleKey && !!roles.matrix && !roles.matrix[roleKey];
  const saved = roleKey ? roles.matrix?.[roleKey] : {};
  const grid = edited ?? saved ?? {};
  const ticked = ROLE_PAGES.filter((p) => grid[p.key]?.view).length;

  async function save() {
    if (!roleKey && !name.trim()) return toast.error("Give the role a name.");
    if (ticked === 0) return toast.error("Pick at least one page to give this role.");
    setBusy(true);
    try {
      const key = roleKey ?? (await roles.createRole(name.trim(), true));
      if (!key) return;
      const problem = await roles.saveGrid(key, grid);
      if (problem) return toast.error("Couldn't save the role", problem);
      toast.success(roleKey ? "Role saved" : "Role created");
      router.push("/portal/settings/roles");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!roleKey) return;
    setBusy(true);
    const problem = await roles.deleteRole(roleKey);
    setBusy(false);
    setConfirmDelete(false);
    if (problem) return toast.error("Couldn't delete the role", problem);
    toast.success("Role deleted");
    router.push("/portal/settings/roles");
  }

  if (missing) return <p className="text-[14px] text-ink-600">That role no longer exists.</p>;

  return (
    <>
      <Link
        href="/portal/settings/roles"
        className="mb-space-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={14} /> Roles
      </Link>
      <h1 className="mb-space-4 text-[22px] font-bold text-ink-900">{roleKey ? roleLabel(roleKey) : "Add role"}</h1>
      {roleKey && isAdministrator(roleKey) && (
        <p className="mb-space-3 rounded-md border border-line bg-paper px-space-3 py-space-2 text-[13px] text-ink-600">
          The Owner / Manager role has every permission, always. It cannot be changed.
        </p>
      )}

      {!roleKey && (
        <Card className="mb-space-5 p-space-4">
          <Field
            label="Name"
            htmlFor="role_name"
            className="mb-0"
            hint="A new role starts with no access. Tick what it needs below."
          >
            <Input id="role_name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cashier" />
          </Field>
        </Card>
      )}

      <h2 className="text-[15px] font-bold text-ink-900">Permissions ({ticked})</h2>
      <p className="mb-space-2 text-[13px] text-ink-600">
        Each page can be given View, Create &amp; edit and Delete. Giving Create &amp; edit or Delete also gives View.
      </p>
      <Card className="mb-space-5 p-space-4">
        {roleKey && !roles.matrix ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <PermissionGrid pages={ROLE_PAGES} value={grid} onChange={setEdited} readOnly={!canWrite} />
        )}
      </Card>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-space-2">
          <Button onClick={save} disabled={busy}>
            {roleKey ? "Save changes" : "Create role"}
          </Button>
          <Button href="/portal/settings/roles" variant="secondary">
            Cancel
          </Button>
          {canDelete && (
            <Button variant="destructive" className="ml-auto" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete role
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this role?"
        message={
          userCount > 0
            ? `${userCount} user(s) still hold it. Move them to another role first.`
            : "The role will be removed. This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={del}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
