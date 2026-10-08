"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Header } from "./navbar/Header";
import { CartDrawer } from "./cart/CartDrawer";

/** Shared shell for every /order page -- renders the ported "Daap Dine" Header (fixed, h-20) and
 * the CartDrawer it opens. /order/<slug> (a restaurant's menu) draws its own hero/header via
 * OutletHeroCanvas instead, same skip-the-shared-header convention this file already had before
 * the dine-client port. */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [cartOpen, setCartOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const isRestaurantPage = segments.length >= 2 && segments[0] === "order" &&
    !["cart", "login", "orders", "account", "book-table", "pay"].includes(segments[1]);

  return (
    <div className="min-h-screen bg-sf-bg-page">
      {!isRestaurantPage && <Header onOpenCart={() => setCartOpen(true)} />}
      <main className={isRestaurantPage ? "" : "pt-20"}>{children}</main>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
