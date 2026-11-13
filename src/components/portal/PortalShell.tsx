"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BranchSwitcher } from "@/components/portal/BranchSwitcher";
import { GlobalFilter, type GlobalFilterOptions } from "@/components/portal/GlobalFilter";
import { NewOrderAlert } from "@/components/portal/NewOrderAlert";
import { NotificationBell } from "@/components/portal/NotificationBell";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { SettingsMenu, SettingsNav } from "@/components/portal/SettingsNav";
import { isSettingsPath } from "@/components/portal/settingsNav";
import { UserMenu } from "@/components/portal/UserMenu";
import {
  DASHBOARD_PERIODS,
  FEEDBACK_PERIODS,
  ORDER_CHANNELS,
  ORDER_PERIODS,
  PERIOD_ORDER,
  REPORT_CHANNELS,
  REPORT_PERIODS,
  RETURN_PERIODS,
} from "@/lib/globalFilter";
import type { PortalRestaurant } from "@/lib/portalAuth";

type Props = {
  restaurant: PortalRestaurant | null;
  active: string;
  children: React.ReactNode;
};

// Multi-branch (migration 0053): only the pages whose data actually carries a branch_id are
// worth showing the switcher on -- menu, staff, offers, customers, messages/automations and
// settings pages are all explicitly SHARED across branches (confirmed scoping decision), so a
// switcher that visibly changes nothing there reads as broken, not as "nothing to filter."
const _BRANCH_AWARE_PAGES = new Set([
  "dashboard",
  "live-operations",
  "appointments",
  "tables",
  "food-orders",
  "sales-online",
  "sales-whatsapp",
  "returns",
  "kitchen-orders",
  "feedback",
  "reports",
]);

// The pages whose data follows the header's global filter (period, and channel where the page has one).
// They show it in place of the plain date chip. Keyed by the same `active` nav key as above.
// Every other page shows the filter too (all periods, no channel), so it is always there; it only changes
// what a page shows where that page is listed above.
const DEFAULT_FILTER: GlobalFilterOptions = { periods: PERIOD_ORDER };
const FILTER_PAGES: Record<string, GlobalFilterOptions> = {
  reports: { periods: REPORT_PERIODS, channels: REPORT_CHANNELS },
  "food-orders": { periods: ORDER_PERIODS, channels: ORDER_CHANNELS },
  "sales-online": { periods: ORDER_PERIODS, channels: ORDER_CHANNELS },
  "sales-whatsapp": { periods: ORDER_PERIODS, channels: ORDER_CHANNELS },
  returns: { periods: RETURN_PERIODS },
  feedback: { periods: FEEDBACK_PERIODS },
  dashboard: { periods: DASHBOARD_PERIODS },
};

/** Shared shell for every /portal/* page: sidebar (a static column at `lg`
 * and up, an off-canvas drawer below it, behind a mobile top bar with a
 * hamburger toggle) plus the scrollable main content area. Every portal page
 * used to compose this same three-element structure (`<div className="flex
 * h-screen ..."><PortalSidebar/><main>...`) directly -- centralized here so
 * the mobile drawer's open/close state has exactly one owner instead of each
 * page reinventing it. */
export function PortalShell({ restaurant, active, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  // Settings is its own mode: the main sidebar is replaced by the settings menu (a fixed column on wide
  // screens, a drawer from the header button below `lg`), and only the page beside it scrolls.
  const inSettings = isSettingsPath(pathname);

  // A nav Link tap already calls onClose directly, but this also covers
  // back/forward navigation and any other route change that isn't a click
  // on the sidebar itself.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {!inSettings && (
        <PortalSidebar
          restaurant={restaurant}
          active={active}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <NewOrderAlert />
        <header className="flex h-16 shrink-0 items-center gap-space-3 border-b border-line bg-card px-space-4">
          {inSettings ? (
            <SettingsMenu />
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="-ml-space-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-paper lg:hidden"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          )}
          <span className="truncate text-[14px] font-bold text-ink-900 lg:hidden">
            {restaurant?.name || "Restaurant"}
          </span>
          <div className="ml-auto flex items-center gap-space-2">
            {_BRANCH_AWARE_PAGES.has(active) && <BranchSwitcher />}
            <GlobalFilter {...(FILTER_PAGES[active] ?? DEFAULT_FILTER)} />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main
          className={
            inSettings
              ? "flex-1 overflow-y-auto p-space-3 xs:p-space-4 sm:p-space-6 lg:flex lg:flex-col lg:overflow-hidden lg:p-0"
              : "flex-1 overflow-y-auto p-space-3 xs:p-space-4 sm:p-space-6"
          }
        >
          {inSettings ? (
            <div className="flex flex-col gap-space-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0">
              <div className="hidden lg:flex lg:shrink-0">
                <SettingsNav />
              </div>
              <div className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto lg:p-space-6">
                <div className="mx-auto max-w-[1040px]">{children}</div>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
