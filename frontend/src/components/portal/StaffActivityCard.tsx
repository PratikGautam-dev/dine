"use client";

import { KeyRound, ShieldCheck, UserCog, UserPlus, UserRoundCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePortalAuditLog } from "@/hooks/usePortalAuditLog";
import type { StaffMember } from "@/hooks/useStaffManagement";
import { formatOrderTime } from "@/lib/foodOrders";
import { roleLabel } from "@/lib/staffRoles";
import { usePermission } from "@/lib/staffAuth";

type Icon = typeof UserPlus;

/** "Olive Owner <staff:1>" -> "Olive Owner" (the audit log appends the account id for traceability). */
const who = (label: string | undefined) => (label || "Someone").replace(/\s*<[^>]*>\s*$/, "").trim() || "Someone";

function describe(action: string, person: string, after: Record<string, unknown> | null): { text: string; icon: Icon } | null {
  switch (action) {
    case "staff.create": {
      const role = after?.role as string | undefined;
      return { text: `Added ${person}${role ? ` as ${roleLabel(role)}` : ""}`, icon: UserPlus };
    }
    case "staff.change_role": return { text: `Changed the role of ${person}`, icon: UserCog };
    case "staff.reset_password": return { text: `Reset the password of ${person}`, icon: KeyRound };
    case "staff.deactivate": return { text: `Deactivated ${person}`, icon: UserRoundCheck };
    case "staff.reactivate": return { text: `Reactivated ${person}`, icon: UserRoundCheck };
    case "staff.update": return { text: `Updated the details of ${person}`, icon: UserCog };
    case "roles.update_permissions": return { text: "Changed role permissions", icon: ShieldCheck };
    default: return action.startsWith("staff.") ? { text: `Staff change: ${action.slice(6).replace(/_/g, " ")} (${person})`, icon: UserCog } : null;
  }
}

/** The latest staff and permission changes, from this restaurant's own audit log. Only shown to people who may see
 * the activity log (Settings), and only when the log is available. */
export function StaffActivityCard({ ready, staff }: { ready: boolean; staff: StaffMember[] | null }) {
  const canSee = usePermission("settings", "view");
  const { entries } = usePortalAuditLog(ready && canSee);
  if (!canSee || !entries) return null;

  const nameOf = (id: string | null) => staff?.find((m) => String(m.id) === id)?.name ?? "a staff member";
  const rows = entries
    .map((e) => ({ e, d: describe(e.action, nameOf(e.entity_id), e.after_value) }))
    .filter((r): r is { e: typeof r.e; d: { text: string; icon: Icon } } => r.d !== null)
    .slice(0, 6);

  return (
    <Card className="mt-space-4 p-space-4">
      <div className="mb-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">Recent staff activity</h3>
        <p className="text-hint">Who was added, changed or had access changed</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-space-4 text-center text-[13px] text-ink-400">No staff changes yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ e, d }) => {
            const Icon = d.icon;
            return (
              <li key={e.id} className="flex items-start gap-space-3 py-space-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink-900">{d.text}</p>
                  <p className="text-[12px] text-ink-600">by {who((e as { actor_label?: string }).actor_label)}</p>
                </div>
                <span className="shrink-0 text-[12px] text-ink-400">{formatOrderTime(e.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
