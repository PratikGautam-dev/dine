"use client";

import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePermission } from "@/lib/staffAuth";

// A doctor-role account used to get a self-service schedule/leave editor
// here (DoctorScheduleView), self-fetching /api/doctor/schedule +
// /api/doctor/leave -- removed along with the rest of the doctor
// self-service portal, which had no backing API left in the backend. A
// doctor's schedule is now only editable by staff with manage_doctors, from
// Doctors & departments.
export default function PortalSchedulePage() {
  const { hospital, ready } = usePortalGuard();
  const canView = usePermission("schedule", "view");

  if (!ready) return null;

  if (!canView) {
    return (
      <PortalShell hospital={hospital} active="schedule">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Schedule.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={hospital} active="schedule">
      <p className="text-[13px] text-ink-400">
        Self-service schedule editing isn&apos;t available here. Ask your restaurant administrator to update your
        schedule from Tables &amp; sections.
      </p>
    </PortalShell>
  );
}
