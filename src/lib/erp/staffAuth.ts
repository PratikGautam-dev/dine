// Adapter: the ERP's permission helpers (lib/staffAuth.ts) on Dine's role model. Dine grants per page as view / write / delete;
// the ERP's `module:action` grants fold onto those: view -> view, delete -> delete, everything else (create, update, send_campaigns,
// manage...) -> write. Dine has no per-branch grants, so "tenant-wide" and "any branch" are the same check.
import { hasPermission as dinePermission, useStaffSession, type StaffSession } from "@/lib/staffAuth";

export { useStaffSession };
export type { StaffSession };

/** The ERP's CRM sub-areas (tags, segments, membership, campaigns) all sit on Dine's one `customers` page. */
const CUSTOMER_AREAS = new Set(["tags", "segments", "membership", "campaigns"]);

export function hasPermission(session: StaffSession | null, pageKey: string, action: "view" | "write" | "delete"): boolean {
  return dinePermission(session, CUSTOMER_AREAS.has(pageKey) ? "customers" : pageKey, action);
}

export function hasGrant(session: StaffSession | null, permission: string): boolean {
  if (!session) return true; // before the session loads; the API enforces regardless
  const [page, action = "view"] = permission.split(":");
  const kind = action === "view" ? "view" : action === "delete" ? "delete" : "write";
  return hasPermission(session, page, kind);
}

export const hasTenantWide = hasGrant;
