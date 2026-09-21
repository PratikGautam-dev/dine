"use client";

import { CalendarDays, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/portal/NotificationBell";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { UserMenu } from "@/components/portal/UserMenu";
import type { PortalHospital } from "@/lib/portalAuth";

type Props = {
  hospital: PortalHospital | null;
  active: string;
  children: React.ReactNode;
};

/** Shared shell for every /portal/* page: sidebar (a static column at `lg`
 * and up, an off-canvas drawer below it, behind a mobile top bar with a
 * hamburger toggle) plus the scrollable main content area. Every portal page
 * used to compose this same three-element structure (`<div className="flex
 * h-screen ..."><PortalSidebar/><main>...`) directly -- centralized here so
 * the mobile drawer's open/close state has exactly one owner instead of each
 * page reinventing it. */
export function PortalShell({ hospital, active, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // A nav Link tap already calls onClose directly, but this also covers
  // back/forward navigation and any other route change that isn't a click
  // on the sidebar itself.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <PortalSidebar hospital={hospital} active={active} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-space-3 border-b border-line bg-card px-space-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="-ml-space-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-paper lg:hidden"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <span className="truncate text-[14px] font-bold text-ink-900 lg:hidden">{hospital?.name || "Restaurant"}</span>
          <div className="ml-auto flex items-center gap-space-2">
            <span
              // the server and the browser can be on different days/timezones for a moment; the browser's wins
              suppressHydrationWarning
              className="mr-space-2 hidden items-center gap-space-2 rounded-md border border-line px-space-3 py-1.5 text-[13px] font-medium text-ink-600 md:flex"
            >
              <CalendarDays size={15} className="text-ink-400" />
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-space-3 xs:p-space-4 sm:p-space-6">{children}</main>
      </div>
    </div>
  );
}
