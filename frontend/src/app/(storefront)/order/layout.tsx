"use client";

import { CartProvider } from "@/lib/cart";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";

/** One CartProvider/StorefrontShell instance for every /order page (same
 * "layout persists across navigations, page mounts don't remount the shell"
 * reasoning admin/(dashboard)/layout.tsx's own docstring gives) -- browsing
 * the marketplace and a restaurant's menu is public, so unlike the portal
 * and admin layouts there is no auth gate here at all; individual pages
 * (cart checkout, orders) redirect to /order/login themselves when a
 * customer session is required. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <StorefrontShell>{children}</StorefrontShell>
    </CartProvider>
  );
}
