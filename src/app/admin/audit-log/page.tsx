"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/formatDate";
import { useAdminTenantsList } from "@/hooks/useAdminTenants";
import { usePlatformAuditLog, type PlatformAuditLogFilters } from "@/hooks/useAdminAuditLog";

// Cross-tenant "what's happening across the whole platform" view --
// admin/tenants_api.py's get_platform_audit_log(). Optional restaurant_id/
// actor_level filters mirror the ones that route accepts; the restaurant_id
// dropdown is populated from useAdminTenantsList() rather than duplicating
// a second restaurant-name lookup here.
export default function AdminAuditLogPage() {
  const { tenants } = useAdminTenantsList();
  const [filters, setFilters] = useState<PlatformAuditLogFilters>({ restaurantId: null, actorLevel: null });
  const { entries, loading, error } = usePlatformAuditLog(filters);

  const tenantOptions = useMemo(() => tenants ?? [], [tenants]);

  return (
    <>
      <PageHeader
        title="Audit Log"
        icon={<ScrollText size={22} />}
        description="Platform-admin and restaurant-portal activity across every restaurant."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 flex flex-wrap items-center gap-space-3">
        <select
          value={filters.restaurantId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, restaurantId: e.target.value ? Number(e.target.value) : null }))}
          className="h-11 rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
        >
          <option value="">All restaurants</option>
          {tenantOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filters.actorLevel ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              actorLevel: (e.target.value || null) as PlatformAuditLogFilters["actorLevel"],
            }))
          }
          className="h-11 rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
        >
          <option value="">All actors</option>
          <option value="platform_admin">Platform Admin</option>
          <option value="portal">Portal</option>
        </select>
      </div>

      <Card className="overflow-x-auto p-space-2">
        {loading ? (
          <TableSkeleton rows={8} columns={4} />
        ) : !entries || entries.length === 0 ? (
          <p className="p-space-4 text-center text-[13px] text-ink-400">No activity recorded yet.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-label border-b border-line text-ink-600">
                <th className="px-space-3 py-space-2 font-medium">Timestamp</th>
                <th className="px-space-3 py-space-2 font-medium">Restaurant</th>
                <th className="px-space-3 py-space-2 font-medium">Actor</th>
                <th className="px-space-3 py-space-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line last:border-0">
                  <td className="px-space-3 py-space-2 whitespace-nowrap text-ink-600">{formatDateTime(entry.created_at)}</td>
                  <td className="px-space-3 py-space-2">
                    {entry.restaurant_name && entry.restaurant_id ? (
                      <Link href={`/admin/restaurants/${entry.restaurant_id}`} className="font-medium text-brand-700 hover:underline">
                        {entry.restaurant_name}
                      </Link>
                    ) : (
                      <span className="text-ink-500">Platform</span>
                    )}
                  </td>
                  <td className="px-space-3 py-space-2">
                    <div className="flex items-center gap-space-2">
                      <Badge tone={entry.actor_level === "platform_admin" ? "brand" : "neutral"}>
                        {entry.actor_level === "platform_admin" ? "Platform Admin" : "Portal"}
                      </Badge>
                      <span className="text-ink-700">{entry.actor_label}</span>
                    </div>
                  </td>
                  <td className="px-space-3 py-space-2 font-semibold text-ink-900">{entry.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
