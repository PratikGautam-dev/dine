"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { RecentAppointmentsTable } from "@/components/portal/RecentAppointmentsTable";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";

const TIER_LABELS: Record<string, string> = { tier1: "Tier 1", tier2: "Tier 2", tier3: "Tier 3" };

// A doctor-role account used to get its own self-service dashboard content
// here (today's appointments, their own stats) via DoctorDashboardView --
// removed along with the rest of the doctor self-service portal, which had
// no backing API (/api/doctor/dashboard) left in the backend. Every role
// now sees the same hospital-wide dashboard below.
export default function PortalDashboardPage() {
  return <HospitalDashboard />;
}

function HospitalDashboard() {
  const { data, error, hospital } = usePortalDashboard();

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-space-4">
        <p className="text-[14px] text-error">{error}</p>
      </div>
    );
  }

  return (
    <PortalShell hospital={hospital} active="dashboard">
        <PageHeader
          title={
            <>
              Restaurant Dashboard
              {data && (
                <span className="ml-space-2 text-[15px] font-medium text-ink-400">
                  ({TIER_LABELS[data.hospital.data_tier] || data.hospital.data_tier})
                </span>
              )}
            </>
          }
          actions={
            <select
              disabled
              title="Coming soon"
              className="h-9 cursor-not-allowed rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-600"
            >
              <option>Today</option>
            </select>
          }
        />

        {!data ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : (
          <>
            <div className="mb-space-4 grid grid-cols-1 gap-space-4 md:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Upcoming reservations" value={data.stats.upcoming_appointments} deltaPct={null} hint="Currently booked" />
              <StatTile label="Today's reservations" value={data.stats.today_appointments} deltaPct={data.stats.today_appointments_delta_pct} />
              <StatTile label="Confirmed" value={data.stats.confirmed_today} deltaPct={data.stats.confirmed_today_delta_pct} />
              <StatTile label="New guests" value={data.stats.new_patients_today} deltaPct={data.stats.new_patients_today_delta_pct} />
              <StatTile label="No-shows" value={data.stats.no_shows_today} deltaPct={data.stats.no_shows_today_delta_pct} upIsGood={false} />
            </div>

            <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
              <WeeklyTrendChart data={data.weekly_counts} />
              <DepartmentDonut data={data.department_breakdown} />
            </div>

            <div className="mb-space-4">
              <RecentAppointmentsTable appointments={data.recent_appointments} />
            </div>
          </>
        )}
    </PortalShell>
  );
}
