"use client";

import { UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/formatDate";
import { useAdminStalledSignups } from "@/hooks/useAdminTenants";

// Read-only list of Google-signed-in users who never finished onboarding a
// restaurant (admin/tenants_api.py's list_stalled_signups()) -- the natural
// next action, "help them onboard," is out of scope for now, so no actions
// here, just a browse view mirroring /admin/restaurants' list layout.
export default function AdminStalledSignupsPage() {
  const { users, loading, error } = useAdminStalledSignups();

  return (
    <>
      <PageHeader
        title="Stalled Signups"
        icon={<UserX size={22} />}
        description="Google accounts that signed in but never finished onboarding a restaurant."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Signups{users ? ` (${users.length})` : ""}</h3>

      <Card className="overflow-x-auto p-space-2">
        {loading ? (
          <TableSkeleton rows={6} columns={3} />
        ) : !users || users.length === 0 ? (
          <p className="p-space-4 text-center text-[13px] text-ink-400">No stalled signups.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-label border-b border-line text-ink-600">
                <th className="px-space-3 py-space-2 font-medium">Email</th>
                <th className="px-space-3 py-space-2 font-medium">Name</th>
                <th className="px-space-3 py-space-2 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-space-3 py-space-2 font-medium text-ink-900">{u.email}</td>
                  <td className="px-space-3 py-space-2 text-ink-600">{u.name || "—"}</td>
                  <td className="px-space-3 py-space-2 text-ink-600">{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
