"use client";

import { CalendarCheck, CalendarDays, CircleCheck, UserPlus, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { ActivityFeed } from "@/components/portal/ActivityFeed";
import { SectionDonut } from "@/components/portal/SectionDonut";
import { PortalShell } from "@/components/portal/PortalShell";
import { RecentAppointmentsTable } from "@/components/portal/RecentAppointmentsTable";
import { StatTile } from "@/components/portal/StatTile";
import { WeeklyTrendChart } from "@/components/portal/WeeklyTrendChart";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";
import { useBranchFilter } from "@/lib/branchContext";
import { DASHBOARD_PERIODS, formatRange, usePagePeriod } from "@/lib/globalFilter";
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
  const { ready } = usePortalGuard();
  // The header's period filter. "Today" is the original view (today against the same weekday last week, the last
  // 7 days of trend); any other period limits every number, chart and list below to those dates.
  const { period, range, label: periodLabel } = usePagePeriod(DASHBOARD_PERIODS);
  const isToday = period === "today";
  const periodText = `${periodLabel} · ${formatRange(range)}`;
  const { data, error, restaurant } = usePortalDashboard(
    ready,
    useBranchFilter().selectedBranchId,
    isToday ? null : range,
  );
  const session = useStaffSession();
  const firstName = session?.name.trim().split(/\s+/)[0];
  // "Today" compares with the same weekday last week; a longer period with the period right before it
  const compareHint = isToday ? "vs last week" : "vs previous period";

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-space-4">
        <p className="text-[14px] text-error">{error}</p>
      </div>
    );
  }

  return (
    <PortalShell restaurant={restaurant} active="dashboard">
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
        <DashboardSkeleton tiles={5} />
      ) : (
        <>
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile
              icon={<CalendarCheck size={22} />}
              label="Upcoming reservations"
              value={data.stats.upcoming_appointments}
              deltaPct={null}
              hint={isToday ? "Currently booked" : "Still to come in this period"}
            />
            <StatTile
              icon={<CalendarDays size={22} />}
              label={isToday ? "Today's reservations" : "Reservations"}
              value={data.stats.today_appointments}
              deltaPct={data.stats.today_appointments_delta_pct}
              hint={compareHint}
            />
            <StatTile
              icon={<CircleCheck size={22} />}
              label={isToday ? "Confirmed today" : "Confirmed"}
              value={data.stats.confirmed_today}
              deltaPct={data.stats.confirmed_today_delta_pct}
              hint={compareHint}
            />
            <StatTile
              icon={<UserPlus size={22} />}
              label={isToday ? "New guests today" : "New guests"}
              value={data.stats.new_patients_today}
              deltaPct={data.stats.new_patients_today_delta_pct}
              hint={compareHint}
            />
            <StatTile
              icon={<UserX size={22} />}
              label={isToday ? "No-shows today" : "No-shows"}
              value={data.stats.no_shows_today}
              deltaPct={data.stats.no_shows_today_delta_pct}
              upIsGood={false}
              hint={compareHint}
            />
          </div>

          <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklyTrendChart
                data={data.weekly_counts}
                periodLabel={isToday ? undefined : periodText}
              />
            </div>
            <SectionDonut
              data={data.department_breakdown}
              subtitle={isToday ? undefined : periodText}
              emptyText={isToday ? undefined : "No reservations in this period."}
            />
          </div>

          <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-3">
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
