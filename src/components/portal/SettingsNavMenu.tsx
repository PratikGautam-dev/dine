"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/cn";
import { hasPermission, useStaffSession, type StaffSession } from "@/lib/staffAuth";
import { SETTINGS_NAV, type SettingsNavItem } from "@/components/portal/settingsNav";

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** The settings pages this person may open (permission + restaurant capability). */
export function visibleSettingsItems(session: StaffSession | null): SettingsNavItem[] {
  return SETTINGS_NAV.filter(
    (i) =>
      (!i.pageKey || hasPermission(session, i.pageKey, "view")) &&
      (!i.capability || !session || session.restaurant.admin_capabilities?.includes(i.capability)),
  );
}

/** Second-level sidebar shown on every /portal/settings/* page (rendered by PortalShell). */
export function SettingsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const session = useStaffSession();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const items = visibleSettingsItems(session).filter((i) => i.label.toLowerCase().includes(query));
  const isActive = (href: string) =>
    href === "/portal/settings" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const name = session?.restaurant.name ?? "Settings";

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-1 flex-col bg-card p-space-3 lg:w-72 lg:flex-none lg:border-r lg:border-line">
      <Link
        href="/portal/dashboard"
        onClick={onNavigate}
        className="mb-space-2 inline-flex shrink-0 items-center gap-space-2 text-[13px] font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={14} /> Back to portal
      </Link>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-space-3 border-b border-line bg-paper px-space-3 py-space-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600 text-[12px] font-bold text-white">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink-900">{name}</p>
            <p className="truncate text-[12px] text-ink-600">Settings</p>
          </div>
        </div>
        <div className="shrink-0 p-space-2">
          <label className="relative block">
            <Search
              size={14}
              className="absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search settings"
              className="h-9 w-full rounded-md border border-line bg-card pl-8 pr-space-2 text-[13px] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>
        <nav
          aria-label="Settings"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-space-2 pb-space-2"
        >
          {items.map(({ slug, label, icon: Icon, href }) => (
            <Link
              key={slug}
              href={href}
              onClick={onNavigate}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-space-3 rounded-md px-space-3 py-2 text-[13px] font-medium text-ink-600 hover:bg-paper hover:text-ink-900",
                isActive(href) && "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          ))}
          {items.length === 0 && <p className="px-space-3 py-2 text-[13px] text-ink-400">No match</p>}
        </nav>
        {session && (
          <div className="flex shrink-0 items-center gap-space-3 border-t border-line px-space-3 py-space-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
              {initials(session.name)}
            </span>
            <p className="min-w-0 truncate text-[13px] font-semibold text-ink-900">{session.name}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

/** The full settings sidebar in a modal drawer below the desktop breakpoint. */
export function SettingsMenu() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpenOn(null);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => setOpenOn(next ? pathname : null)}>
      <Dialog.Trigger
        aria-label="Open settings menu"
        className="-ml-space-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-paper lg:hidden"
      >
        <Menu size={20} strokeWidth={2} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Popup
          className="fixed inset-y-0 left-0 z-50 flex h-dvh w-80 max-w-[90vw] flex-col bg-card shadow-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-space-3 py-space-2">
            <Dialog.Title className="text-[14px] font-bold text-ink-900">Settings</Dialog.Title>
            <Dialog.Close
              aria-label="Close settings menu"
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <SettingsNav onNavigate={() => setOpenOn(null)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
