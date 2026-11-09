"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Store, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { clearSuperAdminSession, getSuperAdminAccessToken, useSuperAdminSession } from "@/lib/superAdminAuth";

// Own minimal shell, distinct from PortalShell (that's the restaurant-staff /portal/* shell) --
// a thin sidebar growing from just "Platform Coupons" into "Restaurants" (tenant management) now,
// room for platform-settings pages later reusing this same login (plan section 6).
const NAV_ITEMS = [
  { href: "/admin/restaurants", label: "Restaurants", icon: Store },
  { href: "/admin/platform-offers", label: "Platform Coupons", icon: Tag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSuperAdminSession();

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (!getSuperAdminAccessToken()) {
      router.push("/admin/login");
    }
  }, [pathname, router]);

  // The login page renders its own full-screen form -- no sidebar chrome around it.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function handleLogout() {
    clearSuperAdminSession();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-[220px] flex-col border-r border-line bg-card px-space-4 py-space-5">
        <p className="mb-space-5 text-[13px] font-bold uppercase tracking-wide text-ink-400">Super Admin</p>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-space-2 rounded-md px-space-3 py-space-2 text-[13.5px] font-medium",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-black/4 hover:text-ink-900",
                )}
              >
                <Icon size={16} />
                {item.label}
              </a>
            );
          })}
        </nav>
        {session && (
          <div className="mt-space-5 border-t border-line pt-space-4">
            <p className="truncate text-[12.5px] font-semibold text-ink-900">{session.name}</p>
            <p className="truncate text-[11.5px] text-ink-500">{session.email}</p>
            <button
              onClick={handleLogout}
              className="mt-space-2 text-[12px] font-semibold text-brand-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-y-auto p-space-5">{children}</main>
    </div>
  );
}
