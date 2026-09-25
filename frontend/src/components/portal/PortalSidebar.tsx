"use client";

import Image from "next/image";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  ChefHat,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Radio,
  Settings,
  ShieldCheck,
  Soup,
  UserCheck,
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
type NavGroup = "Operations" | "Workforce" | "Admin";

// Grouped so a long list scans quickly; a group whose items the person can't see is hidden entirely.
const NAV_ITEMS: { key: string; label: string; icon: typeof LayoutDashboard; href: string; pageKey: string; group: NavGroup }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/portal/dashboard", pageKey: "dashboard", group: "Operations" },
  // A read-only composite view over bookings/orders/handoffs/tables -- own page key (portal/permissions.py's
  // PAGE_LIVE_OPERATIONS) so it can be shown/hidden per role independently of the four pages it draws from.
  { key: "live-operations", label: "Live Operations", icon: Radio, href: "/portal/live-operations", pageKey: "live_operations", group: "Operations" },
  { key: "appointments", label: "Table Bookings", icon: CalendarCheck, href: "/portal/appointments", pageKey: "appointments", group: "Operations" },
  { key: "tables", label: "Tables", icon: UtensilsCrossed, href: "/portal/tables", pageKey: "tables", group: "Operations" },
  // Food ordering plan, Sub-stage 4: separate pageKeys (food_menu/food_orders,
  // portal/permissions.py) since a role reasonably might need one without
  // the other -- same split PAGE_DOCTORS/PAGE_SCHEDULE already use.
  { key: "food-orders", label: "Food Orders", icon: ClipboardList, href: "/portal/food-orders", pageKey: "food_orders", group: "Operations" },
  // Same food_orders permission as Food Orders above -- a leaner, auto-refreshing kitchen-display
  // view over the same real orders, not a separate data domain, so it needs no new page key.
  { key: "kitchen-orders", label: "Kitchen Orders", icon: ChefHat, href: "/portal/kitchen-orders", pageKey: "food_orders", group: "Operations" },
  { key: "food-menu", label: "Menu", icon: Soup, href: "/portal/food-menu", pageKey: "food_menu", group: "Operations" },
  { key: "patients", label: "Customers", icon: Users, href: "/portal/patients", pageKey: "patients", group: "Operations" },
  { key: "messages", label: "WhatsApp Inbox", icon: MessageCircle, href: "/portal/messages", pageKey: "messages", group: "Operations" },
  { key: "feedback", label: "Feedback", icon: MessageSquareText, href: "/portal/feedback", pageKey: "feedback", group: "Operations" },
  { key: "reports", label: "Reports", icon: BarChart3, href: "/portal/reports", pageKey: "reports", group: "Operations" },
  { key: "doctors", label: "Team", icon: Users, href: "/portal/doctors", pageKey: "doctors", group: "Workforce" },
  // Staff HR: everyone clocks in and applies for their own leave; the review queue and the team's
  // attendance are Owner/Manager pages (permissions.py: my_leave, check_in_out, leave_requests, attendance).
  // Clock in/out lives on this same page now (My Attendance) -- no separate nav entry for it any more.
  { key: "my-attendance", label: "My Attendance", icon: Clock, href: "/portal/attendance", pageKey: "check_in_out", group: "Workforce" },
  { key: "leave", label: "My Leave", icon: CalendarOff, href: "/portal/leave", pageKey: "my_leave", group: "Workforce" },
  { key: "team-attendance", label: "Team Attendance", icon: UserCheck, href: "/portal/attendance-overview", pageKey: "attendance", group: "Workforce" },
  { key: "leave-requests", label: "Leave Requests", icon: CalendarDays, href: "/portal/leave-requests", pageKey: "leave_requests", group: "Workforce" },
  { key: "settings", label: "Settings", icon: Settings, href: "/portal/settings", pageKey: "settings", group: "Admin" },
  { key: "staff", label: "Staff", icon: Users, href: "/portal/settings/staff", pageKey: "staff", group: "Admin" },
  { key: "roles", label: "Roles & Permissions", icon: ShieldCheck, href: "/portal/settings/roles", pageKey: "roles", group: "Admin" },
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 -translate-x-full flex-col bg-brand-700 py-space-4 text-white transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="mb-space-4 flex items-center gap-space-3 px-space-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
            <Image src="/logo-mark.png" alt="Dine Connect" width={30} height={30} />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-bold">{hospital?.name || "Restaurant"}</span>
            <span className="block text-[11.5px] text-white/60">DAAP DineConnect</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="mx-space-4 mb-space-2 border-t border-white/10" />

        <nav className="scrollbar-dark flex-1 overflow-y-auto px-space-3">
          {(() => {
            // Per-page-key permission check (hasPermission is a plain function here, not the usePermission
            // hook, since it's called once per item). Fails OPEN the same way the old hardcoded "doctors"
            // capability check did -- this is only a UI convenience, the backend's 403 is the real enforcement.
            // Nothing until the session has loaded: before it, hasPermission fails open and would flash admin-only
            // items at a Kitchen or Front of House login for a moment.
            const visible = session ? NAV_ITEMS.filter((item) => hasPermission(session, item.pageKey, "view")) : [];
            return visible.map(({ key, label, icon: Icon, href, group }, index) => {
              const isActive = key === active;
              const startsGroup = index === 0 || visible[index - 1].group !== group;
              return (
                <div key={key}>
                  {startsGroup && (
                    <p className={cn("px-space-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-white/50 uppercase", index === 0 ? "pt-space-2" : "pt-space-3")}>
                      {group}
                    </p>
                  )}
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] transition-colors duration-150",
                      isActive ? "bg-white font-semibold text-brand-700 shadow-[var(--shadow-sm)]" : "font-medium text-white/85 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    {label}
                  </Link>
                </div>
              );
            });
          })()}
        </nav>

        <div className="mx-space-4 mt-space-2 border-t border-white/10" />
        <div className="px-space-3 pt-space-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] font-medium text-white/80 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut size={18} strokeWidth={2} className="shrink-0" />
            Log out
          </button>
          <p className="px-space-3 pt-space-2 text-[11.5px] leading-snug text-white/55">Better Dining. Stronger Connection.</p>
        </div>
      </aside>
    </>
  );
}
