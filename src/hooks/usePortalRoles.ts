import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type Action = "view" | "write" | "delete";
export type PagePerms = Record<Action, boolean>;
// A plain string role key, not the fixed StaffRole union -- a restaurant-created custom role
// (Staff & Access's "Add Role") shows up here as just another key, same as the 3 built-in roles.
export type Matrix = Record<string, Record<string, PagePerms>>;

/** Loads + owns every mutation on the /portal/settings/roles permission
 * matrix -- one optimistic-update PUT per checkbox toggle, rolled back on
 * failure. */
export function usePortalRoles(canView: boolean) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks the single cell currently in flight, e.g. "admin:staff:write", so
  // only that checkbox shows a pending state while its PUT resolves.
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/roles/permissions");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setMatrix((result.data as { permissions: Matrix }).permissions);
  }, [router]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  /** Adds a custom role (every page unticked). Returns its key, or null if it couldn't be added. */
  async function createRole(name: string, quiet = false): Promise<string | null> {
    setCreatingRole(true);
    const result = await staffFetch("/api/portal/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreatingRole(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't add role", result.error);
      return null;
    }
    const data = result.data as { role_key: string; permissions: Matrix };
    if (!quiet) toast.success(`"${name}" added`);
    setMatrix(data.permissions);
    return data.role_key;
  }

  /** Writes a whole role's grid in one request (the role editor's Save). Returns an error message, or null on success. */
  async function saveGrid(role: string, grid: Record<string, PagePerms>): Promise<string | null> {
    const updates = Object.entries(grid).map(([page_key, p]) => ({
      role,
      page_key,
      can_view: p.view,
      can_write: p.write,
      can_delete: p.delete,
    }));
    const result = await staffFetch("/api/portal/roles/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (!result.ok) {
      if (result.unauthorized) {
        router.push("/portal/login");
        return null;
      }
      return result.error;
    }
    setMatrix((result.data as { permissions: Matrix }).permissions);
    return null;
  }

  /** Only succeeds for a custom role with nobody currently assigned (the backend enforces this too --
   * see portal/routes/roles.py's DELETE handler). Returns an error string to show, or null on success. */
  async function deleteRole(roleKey: string): Promise<string | null> {
    setDeletingRole(roleKey);
    const result = await staffFetch(`/api/portal/roles/${roleKey}`, { method: "DELETE" });
    setDeletingRole(null);
    if (!result.ok) {
      if (result.unauthorized) {
        router.push("/portal/login");
        return null;
      }
      return result.error;
    }
    if (matrix) {
      const rest = { ...matrix };
      delete rest[roleKey];
      setMatrix(rest);
    }
    return null;
  }

  async function handleToggle(role: string, pageKey: string, action: Action, next: boolean) {
    if (!matrix) return;
    const cellKey = `${role}:${pageKey}:${action}`;
    const prevCell = matrix[role][pageKey];
    const nextCell = { ...prevCell, [action]: next };
    setMatrix({ ...matrix, [role]: { ...matrix[role], [pageKey]: nextCell } });
    setSavingCell(cellKey);
    const result = await staffFetch("/api/portal/roles/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Backend contract (portal/routes/roles.py's PermissionsUpdatePayload)
      // is a batch of updates, even for a single-cell toggle like this one --
      // an earlier version of this call sent the fields flat/unwrapped,
      // which parsed fine (Pydantic ignores unknown fields) but always hit
      // the route's "no updates provided" 400, since `updates` defaulted to
      // an empty list.
      body: JSON.stringify({
        updates: [
          {
            role,
            page_key: pageKey,
            can_view: nextCell.view,
            can_write: nextCell.write,
            can_delete: nextCell.delete,
          },
        ],
      }),
    });
    setSavingCell(null);
    if (!result.ok) {
      // Roll back on failure -- optimistic update kept the UI responsive
      // (this can be a lot of clicking through a 8x9 grid) but must not
      // silently drift from what the backend actually has stored.
      setMatrix({ ...matrix, [role]: { ...matrix[role], [pageKey]: prevCell } });
      if (result.unauthorized) {
        router.push("/portal/login");
      } else {
        setError(result.error);
        toast.error("Couldn't update permission", result.error);
      }
    }
  }

  return {
    matrix,
    error,
    savingCell,
    handleToggle,
    creatingRole,
    createRole,
    saveGrid,
    deletingRole,
    deleteRole,
  };
}
