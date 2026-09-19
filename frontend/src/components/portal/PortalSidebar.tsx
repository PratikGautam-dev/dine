"use client";

import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Soup,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { clearPortalSession, type PortalHospital } from "@/lib/portalAuth";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

// Staff/Branches/Reports/Calendar/Departments were removed (not just hidden)
// -- Calendar had no backend and no near-term plan to build one; Departments
// duplicated Doctors (same /portal/doctors page manages both) so it was a
// second sidebar entry pointing at a page already reachable via "Doctors."
//
// Table reservations, portal follow-up: the "doctors" entry below used to be
// labeled "Tables" (Stage 2's vocabulary-only remap, before real tables
// existed) -- relabeled "Team" now that /portal/tables is a genuine, separate
// interface to the `tables` table (physical dining tables, migration 0030).
// "doctors" itself was deliberately NOT deleted: it's still the live
// staff/schedule entity (working hours/breaks/leave, RBAC's own "doctor"
// role, appointment_reminders/staff_details FKs) -- just functionally
// unused by the actual guest-facing table-reservation/food-ordering flows,
// which never reference doctor_id. "Team" avoids colliding with the
// existing "Staff" entry below (/portal/settings/staff, login ACCOUNTS --
// a different concept from a scheduled team member/doctor row).
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/portal/dashboard", pageKey: "dashboard" },
  { key: "appointments", label: "Reservations", icon: CalendarCheck, href: "/portal/appointments", pageKey: "appointments" },
  { key: "patients", label: "Guests", icon: Users, href: "/portal/patients", pageKey: "patients" },
  { key: "schedule", label: "Schedule", icon: CalendarClock, href: "/portal/schedule", pageKey: "schedule" },
  { key: "tables", label: "Tables", icon: UtensilsCrossed, href: "/portal/tables", pageKey: "tables" },
  { key: "doctors", label: "Team", icon: Users, href: "/portal/doctors", pageKey: "doctors" },
  // Food ordering plan, Sub-stage 4: separate pageKeys (food_menu/food_orders,
  // portal/permissions.py) since a role reasonably might need one without
  // the other -- same split PAGE_DOCTORS/PAGE_SCHEDULE already use.
  { key: "food-menu", label: "Menu", icon: Soup, href: "/portal/food-menu", pageKey: "food_menu" },
  { key: "food-orders", label: "Orders", icon: ClipboardList, href: "/portal/food-orders", pageKey: "food_orders" },
  { key: "messages", label: "Messages", icon: MessageCircle, href: "/portal/messages", pageKey: "messages" },
  { key: "settings", label: "Settings", icon: Settings, href: "/portal/settings", pageKey: "settings" },
  { key: "staff", label: "Staff", icon: Users, href: "/portal/settings/staff", pageKey: "staff" },
  { key: "roles", label: "Roles & Permissions", icon: ShieldCheck, href: "/portal/settings/roles", pageKey: "roles" },
];

type Props = {
  hospital: PortalHospital | null;
  active: string;
  /** Mobile drawer state -- undefined/false renders the sidebar off-canvas
   * below the `lg` breakpoint (PortalShell owns the toggle); at `lg` and up
   * the sidebar is always statically visible regardless of this prop. */
  open?: boolean;
  onClose?: () => void;
};

export function PortalSidebar({ hospital, active, open = false, onClose }: Props) {
  const router = useRouter();
  // Resolved once, here, via the real hook -- hasPermission below is a
  // plain function taking this value, safe to call inside .filter() (a real
  // hook can't be called in a loop). null on the server and on the client's
  // own first render pass (same value both places -- no hydration mismatch),
  // then the real session an instant later.
  const session = useStaffSession();

  function handleLogout() {
    clearPortalSession();
    router.push("/");
  }

  return (
    <>
      {/* Backdrop, mobile drawer only */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 -translate-x-full flex-col bg-brand-700 px-space-3 py-space-4 text-white transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="mb-space-5 flex items-center gap-space-2 px-space-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15 font-display text-[14px] font-extrabold">
            D
          </div>
          <span className="truncate text-[14px] font-bold">{hospital?.name || "Restaurant"}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(
            // Per-page-key permission check (hasPermission is a plain
            // function here, not the usePermission hook, since it's called
            // once per item inside this loop). Fails OPEN the same way the
            // old hardcoded "doctors" capability check did -- this is only a
            // UI convenience, the backend's 403 is the real enforcement.
            (item) => hasPermission(session, item.pageKey, "view"),
          ).map(({ key, label, icon: Icon, href }) => {
            const isActive = key === active;
            const itemClasses = cn(
              "flex w-full items-center gap-space-3 rounded-md px-space-3 py-space-2 text-left text-[13.5px] font-medium transition-colors duration-150",
              isActive && "bg-white text-brand-700",
              !isActive && href && "text-white/85 hover:bg-white/10 hover:text-white",
              !href && "cursor-not-allowed text-white/40",
            );
            if (!href) {
              return (
                <button key={key} type="button" disabled title="Coming soon" className={itemClasses}>
                  <Icon size={16} strokeWidth={2} className="shrink-0" />
                  {label}
                </button>
              );
            }
            return (
              <Link key={key} href={href} onClick={onClose} className={itemClasses}>
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-space-3 rounded-md px-space-3 py-space-2 text-left text-[13.5px] font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} strokeWidth={2} className="shrink-0" />
          Log out
        </button>
      </aside>
    </>
  );
}
