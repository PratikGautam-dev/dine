"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShoppingBag, User } from "lucide-react";
import { clearCustomerSession, useCustomerSession } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";

/** Top bar shared by every /order page -- deliberately lightweight compared
 * to PortalShell (no sidebar, no permission gating): this is a public
 * marketplace, not a staff console. */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useCustomerSession();
  const { itemCount, subtotalPaise } = useCart();

  function handleLogout() {
    clearCustomerSession();
    router.push("/order");
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-space-4 px-space-4">
          <Link href="/order" className="flex items-center gap-space-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 font-display text-[15px] font-extrabold text-white">
              D
            </div>
            <span className="hidden text-[15px] font-bold text-ink-900 sm:block">Dine Connect</span>
          </Link>

          <div className="ml-auto flex items-center gap-space-2">
            {session === null && (
              <Link
                href="/order/login"
                className="flex items-center gap-space-1 rounded-md px-space-3 py-2 text-[13.5px] font-semibold text-ink-700 hover:bg-paper"
              >
                <User size={16} /> Log in
              </Link>
            )}
            {session && (
              <>
                <Link
                  href="/order/orders"
                  className="rounded-md px-space-3 py-2 text-[13.5px] font-semibold text-ink-700 hover:bg-paper"
                >
                  My Orders
                </Link>
                <span className="hidden text-[12.5px] text-ink-400 sm:block">{session.name || session.phone}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log out"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:bg-paper hover:text-ink-700"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {itemCount > 0 && pathname !== "/order/cart" && !pathname.startsWith("/order/pay") && (
        <Link
          href="/order/cart"
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between bg-brand-600 px-space-5 py-space-4 text-white shadow-[var(--shadow-lg)] transition-colors hover:bg-brand-700"
        >
          <span className="flex items-center gap-space-2 text-[13.5px] font-semibold">
            <ShoppingBag size={18} /> {itemCount} item{itemCount === 1 ? "" : "s"} · {rupees(subtotalPaise)}
          </span>
          <span className="text-[13.5px] font-bold">View Cart →</span>
        </Link>
      )}
    </div>
  );
}
