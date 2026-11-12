"use client";

import Image from "next/image";
import {
  BarChart3,
  Tag,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  ChefHat,
  Clock,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Monitor,
  Radio,
  Settings,
  ShieldCheck,
  ClipboardList,
  FolderOpen,
  Soup,
  Undo2,
  Store,
  UserCheck,
  UtensilsCrossed,
  Users,
  Crown,
  Filter,
  Megaphone,
  X,
  Zap,
} from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { clearPortalSession, type PortalRestaurant } from "@/lib/portalAuth";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

// Staff/Branches/Reports/Calendar/Departments were removed (not just hidden)
// -- Calendar had no backend and no near-term plan to build one; Departments
// duplicated Doctors (same /portal/doctors page manages both) so it was a
// second sidebar entry pointing at a page already reachable via "Doctors."
//
// "Team" (the old /portal/doctors page, `doctors` table) was later merged
// INTO Staff & Access (now "Team & Access", /portal/settings/staff) rather
// than kept as its own entry: a restaurant person was two disconnected
// records -- a roster/schedule row here, a login there -- with no way to go
// from one to the other. staff_details.doctor_id (previously dead/legacy)
// now links a real login back to the roster entry it was granted access
// from. The `doctors` table/booking engine itself is untouched -- still real
// infrastructure other tenant types in this fork use -- only this portal's
// nav entry and dedicated page for it are gone.
type NavGroup = "Main" | "Catalog" | "Sales Channels" | "Workforce" | "Settings";
// "Main" holds what used to be the separate Orders and Customers groups; inside it the items keep
// the order they have in NAV_ITEMS below (the sort is stable), so the order items come first.
const GROUP_ORDER: NavGroup[] = ["Main", "Catalog", "Sales Channels", "Workforce", "Settings"];

// Grouped so a long list scans quickly; a group whose items the person can't see is hidden entirely.
// Order inside a group is array order (the sort below is stable). Returns reuses the food_orders
// page key and Collections reuses food_menu -- the permission model has no separate keys for them.
const NAV_ITEMS: {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  pageKey: string;
  group: NavGroup;
  /** Key of the item this one is nested under. A child has no row of its own at the top level: it is
   * listed under its parent, and only while the parent is open (see the renderer below). */
  parent?: string;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/portal/dashboard",
    pageKey: "dashboard",
    group: "Main",
  },
  {
    key: "sales-online",
    label: "Website",
    icon: Globe,
    href: "/portal/food-orders?source=web",
    pageKey: "food_orders",
    group: "Sales Channels",
  },
  {
    key: "sales-daap-website",
    label: "Daap App",
    icon: Monitor,
    href: "/portal/channels/daap-website",
    pageKey: "food_orders",
    group: "Sales Channels",
  },
  {
    key: "sales-whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    href: "/portal/food-orders?source=whatsapp",
    pageKey: "food_orders",
    group: "Sales Channels",
  },
  {
    key: "sales-pos",
    label: "POS",
    icon: CreditCard,
    href: "/portal/channels/pos",
    pageKey: "food_orders",
    group: "Sales Channels",
  },
  {
    key: "live-operations",
    label: "Live Operations",
    icon: Radio,
    href: "/portal/live-operations",
    pageKey: "live_operations",
    group: "Main",
  },
  {
    key: "appointments",
    label: "Table Bookings",
    icon: CalendarCheck,
    href: "/portal/appointments",
    pageKey: "appointments",
    group: "Main",
  },
  {
    key: "food-orders",
    label: "Food Orders",
    icon: ClipboardList,
    href: "/portal/food-orders",
    pageKey: "food_orders",
    group: "Main",
  },
  {
    key: "returns",
    label: "Returns",
    icon: Undo2,
    href: "/portal/returns",
    pageKey: "food_orders",
    group: "Main",
  },
  {
    key: "kitchen-orders",
    label: "Kitchen Orders",
    icon: ChefHat,
    href: "/portal/kitchen-orders",
    pageKey: "food_orders",
    group: "Main",
  },
  {
    key: "tables",
    label: "Tables",
    icon: UtensilsCrossed,
    href: "/portal/tables",
    pageKey: "tables",
    group: "Catalog",
  },
  {
    key: "food-menu",
    label: "Menu",
    icon: Soup,
    href: "/portal/food-menu",
    pageKey: "food_menu",
    group: "Catalog",
  },
  {
    key: "collections",
    label: "Collections",
    icon: FolderOpen,
    href: "/portal/collections",
    pageKey: "food_menu",
    group: "Catalog",
  },
  {
    key: "offers",
    label: "Offers",
    icon: Tag,
    href: "/portal/offers",
    pageKey: "offers",
    group: "Catalog",
  },
  // "Customers" is a parent row with its own sub-pages nested under it, like the ERP's sidebar. Its page is the
  // first child's (All Customers); the sub-pages show while any of them is the open page.
  {
    key: "customers-group",
    label: "Customers",
    icon: Users,
    href: "/portal/customers",
    pageKey: "customers",
    group: "Main",
  },
  {
    key: "customers",
    label: "All Customers",
    icon: Users,
    href: "/portal/customers",
    pageKey: "customers",
    group: "Main",
    parent: "customers-group",
  },
  {
    key: "customers-membership",
    label: "Membership",
    icon: Crown,
    href: "/portal/customers/membership",
    pageKey: "customers",
    group: "Main",
    parent: "customers-group",
  },
  {
    key: "customers-tags",
    label: "Tags",
    icon: Tag,
    href: "/portal/customers/tags",
    pageKey: "customers",
    group: "Main",
    parent: "customers-group",
  },
  {
    key: "customers-segments",
    label: "Segments",
    icon: Filter,
    href: "/portal/customers/segments",
    pageKey: "customers",
    group: "Main",
    parent: "customers-group",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
    href: "/portal/campaigns",
    pageKey: "customers",
    group: "Main",
    parent: "customers-group",
  },
  {
    key: "messages",
    label: "WhatsApp Inbox",
    icon: MessageCircle,
    href: "/portal/messages",
    pageKey: "messages",
    group: "Main",
  },
  {
    key: "messages-automations",
    label: "Messages & Automations",
    icon: Zap,
    href: "/portal/settings/messages-automations",
    pageKey: "settings",
    group: "Main",
  },
  {
    key: "reports",
    label: "Analytics",
    icon: BarChart3,
    href: "/portal/reports",
    pageKey: "reports",
    group: "Main",
  },
  {
    key: "feedback",
    label: "Feedback",
    icon: MessageSquareText,
    href: "/portal/feedback",
    pageKey: "feedback",
    group: "Main",
  },
  {
    key: "my-attendance",
    label: "Attendance",
    icon: Clock,
    href: "/portal/attendance",
    pageKey: "check_in_out",
    group: "Workforce",
  },
  {
    key: "check-in-out",
    label: "Check-in / Check-out",
    icon: LogIn,
    href: "/portal/check-in-out",
    pageKey: "check_in_out",
    group: "Workforce",
  },
  {
    key: "leave",
    label: "My Leave",
    icon: CalendarOff,
    href: "/portal/leave",
    pageKey: "my_leave",
    group: "Workforce",
  },
  {
    key: "team-attendance",
    label: "Team Attendance",
    icon: UserCheck,
    href: "/portal/attendance-overview",
    pageKey: "attendance",
    group: "Workforce",
  },
  {
    key: "leave-requests",
    label: "Leave Requests",
    icon: CalendarDays,
    href: "/portal/leave-requests",
    pageKey: "leave_requests",
    group: "Workforce",
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    href: "/portal/settings",
    pageKey: "settings",
    group: "Settings",
  },
  {
    key: "storefront",
    label: "Online Storefront",
    icon: Globe,
    href: "/portal/settings/storefront",
    pageKey: "settings",
    group: "Settings",
  },
  {
    key: "branches",
    label: "Branches",
    icon: Store,
    href: "/portal/settings/branches",
    pageKey: "settings",
    group: "Settings",
  },
  {
    key: "staff",
    label: "Team & Access",
    icon: Users,
    href: "/portal/settings/staff",
    pageKey: "staff",
    group: "Settings",
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    icon: ShieldCheck,
    href: "/portal/settings/roles",
    pageKey: "roles",
    group: "Settings",
  },
];

type Props = {
  restaurant: PortalRestaurant | null;
  active: string;
  /** Mobile drawer state -- undefined/false renders the sidebar off-canvas
   * below the `lg` breakpoint (PortalShell owns the toggle); at `lg` and up
   * the sidebar is always statically visible regardless of this prop. */
  open?: boolean;
  onClose?: () => void;
};

// Every portal page mounts its own PortalShell, so the sidebar is rebuilt on each navigation and its
// nav list would snap back to the top. A module-level value survives client-side navigation, so the
// last scroll position is kept here and restored on mount.
let savedNavScroll = 0;

export function PortalSidebar({ restaurant, active, open = false, onClose }: Props) {
  const router = useRouter();
  // Resolved once, here, via the real hook -- hasPermission below is a
  // plain function taking this value, safe to call inside .filter() (a real
  // hook can't be called in a loop). null on the server and on the client's
  // own first render pass (same value both places -- no hydration mismatch),
  // then the real session an instant later.
  const session = useStaffSession();
  const navRef = useRef<HTMLElement>(null);

  // The nav items only render once the session has loaded, so restore after that (before paint).
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = savedNavScroll;
  }, [session]);

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
            <span className="block truncate text-[15px] font-bold">
              {restaurant?.name || "Restaurant"}
            </span>
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

        <nav
          ref={navRef}
          onScroll={(e) => {
            savedNavScroll = e.currentTarget.scrollTop;
          }}
          className="no-scrollbar flex-1 overflow-y-auto px-space-3"
        >
          {(() => {
            // Per-page-key permission check (hasPermission is a plain function here, not the usePermission
            // hook, since it's called once per item). Fails OPEN the same way the old hardcoded "doctors"
            // capability check did -- this is only a UI convenience, the backend's 403 is the real enforcement.
            // Nothing until the session has loaded: before it, hasPermission fails open and would flash admin-only
            // items at a Kitchen or Front of House login for a moment.
            const visible = session
              ? NAV_ITEMS.filter((item) => hasPermission(session, item.pageKey, "view")).sort(
                  (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
                )
              : [];
            // Children are not rows of their own: they sit under their parent. A parent shows only if the
            // person may open at least one child, which the filter above already guarantees.
            const topLevel = visible.filter((item) => !item.parent);
            return topLevel.map(({ key, label, icon: Icon, href, group }, index) => {
              const children = visible.filter((item) => item.parent === key);
              const hasChildren = children.length > 0;
              const childActive = children.some((c) => c.key === active);
              const isActive = key === active || childActive;
              // sub-pages are listed while the parent (or any of them) is the open page
              const isOpen = hasChildren && isActive;
              const startsGroup = index === 0 || topLevel[index - 1].group !== group;
              return (
                <div key={key}>
                  {startsGroup && (
                    <p
                      className={cn(
                        "px-space-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-white/50 uppercase",
                        index === 0 ? "pt-space-2" : "pt-space-3",
                      )}
                    >
                      {group}
                    </p>
                  )}
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={isActive && !hasChildren ? "page" : undefined}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    className={cn(
                      "flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] transition-colors duration-150",
                      isActive
                        ? "bg-white font-semibold text-brand-700 shadow-[var(--shadow-sm)]"
                        : "font-medium text-white/85 hover:bg-white/10 hover:text-white",
                      // a parent whose sub-page is open keeps a ring, so the open section reads as one block
                      hasChildren && isActive && "ring-2 ring-white/70 ring-offset-0",
                    )}
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    {label}
                  </Link>
                  {isOpen && (
                    <ul className="mt-1 mb-1 ml-[22px] space-y-0.5 border-l border-white/20 pl-space-3">
                      {children.map((child) => {
                        const childIsActive = child.key === active;
                        return (
                          <li key={child.key}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              aria-current={childIsActive ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-space-3 py-2 text-[13.5px] transition-colors duration-150",
                                childIsActive
                                  ? "bg-white/20 font-semibold text-white"
                                  : "font-medium text-white/70 hover:bg-white/10 hover:text-white",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
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
          <p className="px-space-3 pt-space-2 text-[11.5px] leading-snug text-white/55">
            Better Dining. Stronger Connection.
          </p>
        </div>
      </aside>
    </>
  );
}
