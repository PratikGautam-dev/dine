"use client";

import { useMemo, useState } from "react";
import { CalendarHeart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { PortalShell } from "@/components/portal/PortalShell";
import { cn } from "@/lib/cn";
import { LEAVE_TYPE_LABEL, fmtDate } from "@/lib/hr";
import { useStaffSession } from "@/lib/staffAuth";
import { useLeaveCalendar, type LeaveCalendar } from "@/hooks/useHr";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const HEAD = ["M", "T", "W", "T", "F", "S", "S"];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type DayInfo = {
  holiday?: string;
  leave?: { type: string; pending: boolean; half: boolean };
};

/** date -> what that day is for me, from the calendar call. */
function dayMap(cal: LeaveCalendar): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const h of cal.holidays) map.set(h.date, { ...map.get(h.date), holiday: h.name });
  for (const lv of cal.leave) {
    const d = new Date(`${lv.from_date}T00:00:00`);
    const end = new Date(`${lv.to_date}T00:00:00`);
    while (d <= end) {
      const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(key, {
        ...map.get(key),
        leave: {
          type: lv.leave_type,
          pending: lv.status === "pending",
          half: lv.is_half_day,
        },
      });
      d.setDate(d.getDate() + 1);
    }
  }
  return map;
}

function Month({
  year,
  month,
  days,
  weeklyOff,
  todayIso,
}: {
  year: number;
  month: number;
  days: Map<string, DayInfo>;
  weeklyOff: number[];
  todayIso: string;
}) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const count = new Date(year, month + 1, 0).getDate();
  return (
    <Card className="min-w-0 p-space-3">
      <h3 className="mb-space-2 text-[13.5px] font-bold text-ink-900">{MONTHS[month]}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11.5px]">
        {HEAD.map((h, i) => (
          <span key={i} className="py-0.5 font-semibold text-ink-400">
            {h}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = i + 1;
          const key = iso(year, month, d);
          const info = days.get(key);
          const off = weeklyOff.includes(new Date(year, month, d).getDay());
          const title = [
            info?.holiday,
            info?.leave &&
              `${LEAVE_TYPE_LABEL[info.leave.type] ?? info.leave.type} leave${info.leave.half ? " (half day)" : ""}${info.leave.pending ? " -- waiting for approval" : ""}`,
            off && !info ? "Weekly off" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <span
              key={key}
              title={title || undefined}
              aria-label={title ? `${fmtDate(key)}: ${title}` : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md",
                info?.holiday && "bg-warning font-bold text-white",
                !info?.holiday &&
                  info?.leave &&
                  !info.leave.pending &&
                  "bg-brand-600 font-bold text-white",
                !info?.holiday &&
                  info?.leave?.pending &&
                  "border border-dashed border-brand-600 font-semibold text-brand-700",
                !info && off && "bg-black/[0.04] text-ink-400",
                !info && !off && "text-ink-700",
                key === todayIso && "ring-2 ring-ink-900 ring-offset-1",
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/** My holidays and leave for the year: the company's holidays at my branch, my approved and waiting leave, my weekly offs. */
export default function HolidaysPage() {
  const session = useStaffSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { calendar, error } = useLeaveCalendar(Boolean(session), year);
  const days = useMemo(() => (calendar ? dayMap(calendar) : new Map()), [calendar]);
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = (calendar?.holidays ?? []).filter((h) => h.date >= todayIso).slice(0, 6);
  const leaveDays = (calendar?.leave ?? [])
    .filter((l) => l.status === "approved")
    .reduce((n, l) => n + l.days, 0);

  return (
    <PortalShell restaurant={session?.restaurant ?? null} active="holidays">
      <PageHeader
        icon={<CalendarHeart size={20} />}
        title="Holidays"
        description={
          calendar
            ? `Holidays at ${calendar.branch_name}, and the days you're on leave.`
            : "Your company's holidays and the days you're on leave."
        }
        actions={
          <div className="flex items-center gap-space-1">
            <Button
              variant="secondary"
              aria-label="Previous year"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-14 text-center text-[15px] font-bold text-ink-900">{year}</span>
            <Button
              variant="secondary"
              aria-label="Next year"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!calendar ? (
        <SkeletonLines rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3">
            {MONTHS.map((_, m) => (
              <Month
                key={m}
                year={year}
                month={m}
                days={days}
                weeklyOff={calendar.weekly_off}
                todayIso={todayIso}
              />
            ))}
          </div>
          <div className="space-y-space-4">
            <Card className="p-space-4">
              <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Key</h3>
              <ul className="space-y-space-2 text-[13px] text-ink-700">
                <li className="flex items-center gap-space-2">
                  <span className="h-4 w-4 rounded bg-warning" /> Holiday
                </li>
                <li className="flex items-center gap-space-2">
                  <span className="h-4 w-4 rounded bg-brand-600" /> My leave
                </li>
                <li className="flex items-center gap-space-2">
                  <span className="h-4 w-4 rounded border border-dashed border-brand-600" /> Leave
                  waiting for approval
                </li>
                <li className="flex items-center gap-space-2">
                  <span className="h-4 w-4 rounded bg-black/[0.06]" /> Weekly off
                </li>
              </ul>
              <p className="mt-space-3 text-hint">
                {leaveDays} day{leaveDays === 1 ? "" : "s"} of approved leave in {year}.
              </p>
            </Card>
            <Card className="p-space-4">
              <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Coming up</h3>
              {upcoming.length === 0 ? (
                <p className="text-[13px] text-ink-400">No more holidays this year.</p>
              ) : (
                <ul className="space-y-space-2">
                  {upcoming.map((h) => (
                    <li key={h.id}>
                      <p className="text-[13.5px] font-semibold text-ink-900">{h.name}</p>
                      <p className="text-hint">{fmtDate(h.date)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Button href="/portal/leave" variant="secondary" className="mt-space-3 w-full">
                Apply for leave
              </Button>
            </Card>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
