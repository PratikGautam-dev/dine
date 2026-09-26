import { Card } from "@/components/ui/Card";
import type { Matrix } from "@/hooks/usePortalRoles";

/** Page keys -> the names people see in the sidebar. Kept next to the roles grid's own labels. */
export const PAGE_LABEL: Record<string, string> = {
  dashboard: "Dashboard", appointments: "Reservations", patients: "Guests", tables: "Tables", food_menu: "Menu",
  food_orders: "Orders", messages: "Messages", doctors: "Team", settings: "Settings", staff: "Staff",
  roles: "Roles & Permissions", check_in_out: "Clock in / out", my_leave: "My Leave",
  leave_requests: "Leave Requests (review)", attendance: "Team Attendance", attendance_settings: "Attendance Settings",
  diagnostic_tests: "Tests",
};

/** The pages a role can change and the pages it can only look at, from the live permission matrix. */
export function summariseRole(matrix: Matrix, role: string) {
  const cells = matrix[role] || {};
  const label = (key: string) => PAGE_LABEL[key] || key;
  const change = Object.keys(cells).filter((k) => cells[k].write && PAGE_LABEL[k]).map(label);
  const viewOnly = Object.keys(cells).filter((k) => cells[k].view && !cells[k].write && PAGE_LABEL[k]).map(label);
  return { change, viewOnly, total: Object.keys(cells).filter((k) => cells[k].view && PAGE_LABEL[k]).length };
}

/** "What can they do?" for the selected staff member's role -- the real permissions, not a description of them. */
export function RolePermissionSummary({ matrix, role }: { matrix: Matrix; role: string }) {
  const { change, viewOnly } = summariseRole(matrix, role);
  return (
    <Card className="mt-space-4 p-space-4">
      <h3 className="mb-space-3 text-[14px] font-bold text-ink-900">What this role can do</h3>
      <div className="mb-space-3">
        <p className="mb-space-1 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">Can change</p>
        {change.length === 0 ? (
          <p className="text-[12.5px] text-ink-600">Nothing</p>
        ) : (
          <ul className="flex flex-wrap gap-space-1">
            {change.map((p) => (
              <li key={p} className="rounded-full bg-success-tint px-space-2 py-0.5 text-[12px] font-semibold text-success">{p}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-space-1 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">Can only view</p>
        {viewOnly.length === 0 ? (
          <p className="text-[12.5px] text-ink-600">Nothing</p>
        ) : (
          <ul className="flex flex-wrap gap-space-1">
            {viewOnly.map((p) => (
              <li key={p} className="rounded-full bg-paper px-space-2 py-0.5 text-[12px] font-semibold text-ink-600">{p}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
