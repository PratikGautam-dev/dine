"use client";

import { CalendarCheck, CalendarDays, CircleCheck, UserPlus, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivityFeed } from "@/components/portal/ActivityFeed";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { RecentAppointmentsTable } from "@/components/portal/RecentAppointmentsTable";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";
import { useStaffSession } from "@/lib/staffAuth";

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Everyone signed in sees the same restaurant-wide dashboard (the doctor self-service dashboard went away with
// the doctor portal). Only real numbers are shown: reservations, guests, sections and recent activity.
export default function PortalDashboardPage() {
  return <RestaurantDashboard />;
}

function RestaurantDashboard() {
  const { data, error, hospital } = usePortalDashboard();
  const session = useStaffSession();
  const firstName = session?.name.trim().split(/\s+/)[0];

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
          // the browser's clock decides the greeting, so the server-rendered text may differ for a moment
          <span suppressHydrationWarning>
            {greetingFor(new Date().getHours())}
            {firstName ? `, ${firstName}` : ""}!
          </span>
        }
        description="Here's what's happening at your restaurant."
      />

      {!data ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : (
        <>
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile icon={<CalendarCheck size={22} />} label="Upcoming reservations" value={data.stats.upcoming_appointments} deltaPct={null} hint="Currently booked" />
            <StatTile icon={<CalendarDays size={22} />} label="Today's reservations" value={data.stats.today_appointments} deltaPct={data.stats.today_appointments_delta_pct} />
            <StatTile icon={<CircleCheck size={22} />} label="Confirmed today" value={data.stats.confirmed_today} deltaPct={data.stats.confirmed_today_delta_pct} />
            <StatTile icon={<UserPlus size={22} />} label="New guests today" value={data.stats.new_patients_today} deltaPct={data.stats.new_patients_today_delta_pct} />
            <StatTile icon={<UserX size={22} />} label="No-shows today" value={data.stats.no_shows_today} deltaPct={data.stats.no_shows_today_delta_pct} upIsGood={false} />
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklyTrendChart data={data.weekly_counts} />
            </div>
            <DepartmentDonut data={data.department_breakdown} />
          </div>

          <div className="grid grid-cols-1 items-start gap-space-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <RecentAppointmentsTable appointments={data.recent_appointments} />
            </div>
            <ActivityFeed items={data.activity_feed} />
          </div>
        </>
      )}
    </PortalShell>
  );
}
