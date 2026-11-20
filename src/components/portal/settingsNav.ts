import {
  Activity,
  Banknote,
  Bot,
  CalendarClock,
  Clock,
  Plug,
  ListChecks,
  MapPin,
  Bell,
  Palette,
  Percent,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SettingsNavItem = {
  slug: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** The permission area whose View permission opens it (same keys the main sidebar used). */
  pageKey?: string;
  /** Hidden unless the restaurant has this admin capability (restaurant.admin_capabilities). */
  capability?: string;
};

/** The second-level settings menu (shown on every /portal/settings/* page, in place of the main sidebar). */
export const SETTINGS_NAV: SettingsNavItem[] = [
  { slug: "general", label: "General", icon: SettingsIcon, href: "/portal/settings", pageKey: "settings" },
  {
    slug: "theme",
    label: "Theme and colours",
    icon: Palette,
    href: "/portal/settings/theme",
    pageKey: "settings",
  },
  {
    slug: "booking",
    label: "Booking rules",
    icon: CalendarClock,
    href: "/portal/settings/booking",
    pageKey: "settings",
  },
  {
    slug: "reservation-types",
    label: "Reservation types",
    icon: ListChecks,
    href: "/portal/settings/reservation-types",
    pageKey: "settings",
    capability: "manage_appointment_types",
  },
  { slug: "fees", label: "Fees", icon: Banknote, href: "/portal/settings/fees", pageKey: "settings" },
  { slug: "notifications", label: "Notifications", icon: Bell, href: "/portal/settings/notifications", pageKey: "settings" },
  { slug: "taxes", label: "Taxes and duties", icon: Percent, href: "/portal/settings/taxes", pageKey: "settings" },
  { slug: "ai", label: "AI model", icon: Bot, href: "/portal/settings/ai", pageKey: "settings" },
  { slug: "channels", label: "Sales channels", icon: Plug, href: "/portal/settings/channels", pageKey: "settings" },
  { slug: "branches", label: "Branches", icon: MapPin, href: "/portal/settings/branches", pageKey: "settings" },
  { slug: "staff", label: "Users", icon: Users, href: "/portal/settings/staff", pageKey: "staff" },
  {
    slug: "roles",
    label: "Roles and permissions",
    icon: ShieldCheck,
    href: "/portal/settings/roles",
    pageKey: "roles",
  },
  {
    slug: "attendance",
    label: "Attendance rules",
    icon: Clock,
    href: "/portal/settings/attendance",
    pageKey: "attendance_settings",
  },
  { slug: "activity", label: "Activity log", icon: Activity, href: "/portal/settings/activity", pageKey: "settings" },
];

/** Settings pages that are NOT part of the settings mode: they live under /portal/settings but are
 * ordinary portal pages with their own entry in the main sidebar. */
export const NON_SETTINGS_MODE_PATHS = ["/portal/settings/messages-automations"];

export function isSettingsPath(pathname: string): boolean {
  if (NON_SETTINGS_MODE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return pathname === "/portal/settings" || pathname.startsWith("/portal/settings/");
}
