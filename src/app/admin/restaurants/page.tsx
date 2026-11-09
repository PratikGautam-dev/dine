"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTileSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/portal/StatTile";
import { useAdminTenantsList, useTotalBookingsStat } from "@/hooks/useAdminTenants";

// Modeled on /admin/platform-offers/page.tsx's list layout (search input +
// Card-wrapped table) -- simpler than that page: no KPIs, no create flow
// (onboarding a NEW restaurant is a separate, already-existing flow), just
// browse-and-drill-into an existing tenant to edit it.
export default function AdminRestaurantsPage() {
  const { tenants, loading, error } = useAdminTenantsList();
  const { totalBookings, loading: bookingsLoading } = useTotalBookingsStat();
  const [search, setSearch] = useState("");

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = tenants ?? [];
    if (!q) return all;
    return all.filter((t) => [t.name, t.whatsapp_phone_number_id].some((v) => v.toLowerCase().includes(q)));
  }, [tenants, search]);

  return (
    <>
      <PageHeader
        title="Restaurants"
        icon={<Store size={22} />}
        description="Every onboarded restaurant on the platform — click one to view or edit it."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:max-w-[320px]">
        {bookingsLoading ? (
          <StatTileSkeleton />
        ) : (
          <StatTile
            icon={<CalendarCheck size={22} />}
            label="Total bookings across the platform"
            value={totalBookings ?? 0}
            deltaPct={null}
            hint="All time, every restaurant"
            tone="brand"
          />
        )}
      </div>

      <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">Restaurants{tenants ? ` (${tenants.length})` : ""}</h3>
        <Input placeholder="Search by name or WhatsApp phone ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[280px]" />
      </div>

      <Card className="overflow-x-auto p-space-2">
        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : filteredTenants.length === 0 ? (
          <p className="p-space-4 text-center text-[13px] text-ink-400">
            {search ? "No restaurants match that search." : "No restaurants onboarded yet."}
          </p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-label border-b border-line text-ink-600">
                <th className="px-space-3 py-space-2 font-medium">Name</th>
                <th className="px-space-3 py-space-2 font-medium">WhatsApp Phone ID</th>
                <th className="px-space-3 py-space-2 font-medium">Data Tier</th>
                <th className="px-space-3 py-space-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-space-3 py-space-2">
                    <Link href={`/admin/restaurants/${t.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-space-3 py-space-2 font-mono text-[12px] text-ink-600">{t.whatsapp_phone_number_id}</td>
                  <td className="px-space-3 py-space-2 text-ink-600">{t.data_tier}</td>
                  <td className="px-space-3 py-space-2">
                    <Badge tone={t.is_active ? "success" : "neutral"}>{t.is_active ? "Active" : "Inactive"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
