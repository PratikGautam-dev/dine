"use client";

import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { summariseRole } from "@/components/portal/RolePermissionSummary";
import { StatTile } from "@/components/portal/StatTile";
import { usePermission, useStaffSession, type StaffRole } from "@/lib/staffAuth";
import { ROLE_LABEL } from "@/lib/staffRoles";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { createRoleColumns } from "./_components/role-columns";

// Kept in step with backend/portal/permissions.py's ALL_PAGES -- the pages a restaurant actually has.
const PAGE_KEYS = [
  "dashboard", "appointments", "patients", "tables", "food_menu", "food_orders", "messages",
  "doctors", "settings", "staff", "roles",
  "check_in_out", "my_leave", "leave_requests", "attendance", "attendance_settings",
];
const PAGE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  appointments: "Reservations",
  patients: "Guests",
  tables: "Tables",
  food_menu: "Menu",
  food_orders: "Orders",
  messages: "Messages",
  doctors: "Team",
  settings: "Settings",
  staff: "Staff",
  roles: "Roles & Permissions",
  check_in_out: "Clock in / out",
  my_leave: "My Leave",
  leave_requests: "Leave Requests (review)",
  attendance: "Team Attendance",
  attendance_settings: "Attendance Settings",
};
const ROLES: StaffRole[] = ["admin", "receptionist", "kitchen"];

export default function RolesPermissionsPage() {
  // useStaffSession (not getStaffSession directly): null on the server AND
  // on the client's own first render, so PortalShell/PortalSidebar render
  // the same "Hospital" placeholder both places -- getStaffSession() itself
  // returns the real session immediately client-side (synchronous
  // localStorage), which used to disagree with the server's render and
  // throw a hydration-mismatch error the instant the real hospital name
  // reached the DOM.
  const session = useStaffSession();
  const canView = usePermission("roles", "view");
  const canWrite = usePermission("roles", "write");

  const { matrix, error, savingCell, handleToggle } = usePortalRoles(canView);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="roles">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Roles &amp; Permissions.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="roles">
      <PageHeader
        title="Roles & Permissions"
        icon={<ShieldCheck size={22} />}
        description={
          <>
            Configure what each role can view, edit, and delete across the portal.
            {!canWrite && " You have view-only access to this page."}
          </>
        }
      />

      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {!matrix ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : (
        <div className="space-y-space-5">
          <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-3">
            {ROLES.map((role) => {
              const summary = summariseRole(matrix, role);
              return (
                <StatTile
                  key={role} icon={<ShieldCheck size={22} />} label={ROLE_LABEL[role]} value={summary.total} deltaPct={null}
                  hint={`pages it can open, ${summary.change.length} it can change`}
                />
              );
            })}
          </div>
          {ROLES.map((role) => {
            const columns = createRoleColumns({
              pageLabel: PAGE_LABEL,
              cellFor: (pageKey) => matrix[role]?.[pageKey] || { view: false, write: false, delete: false },
              canWrite,
              isSaving: (pageKey, action) => savingCell === `${role}:${pageKey}:${action}`,
              onToggle: (pageKey, action, next) => handleToggle(role, pageKey, action, next),
            });
            return (
              <Card key={role} className="p-space-4">
                <h3 className="text-label mb-space-3 font-bold text-ink-900">{ROLE_LABEL[role]}</h3>
                <DataTable columns={columns} data={PAGE_KEYS} getRowId={(pageKey) => pageKey} />
              </Card>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
