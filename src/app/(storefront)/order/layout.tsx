"use client";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import "./storefront-tokens.css";

// "Daap Dine" design (ported from the dine-client reference project): Plus Jakarta Sans for
// headlines, Inter for body -- distinct variable names (--font-sf-*) from the portal's own
// --font-display/--font-body so next/font's generated CSS never collides with it, even though
// both are loaded into the same document.
const sfHeadline = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sf-headline", display: "swap" });
const sfBody = Inter({ subsets: ["latin"], variable: "--font-sf-body", display: "swap" });

/** One CartProvider/StorefrontShell instance for every /order page (same
 * "layout persists across navigations, page mounts don't remount the shell"
 * reasoning the portal layout uses) -- browsing
 * the marketplace and a restaurant's menu is public, so unlike the portal
 * layout there is no auth gate here at all; individual pages
 * (cart checkout, orders) redirect to /order/login themselves when a
 * customer session is required.
 *
 * The .sf-root wrapper is what scopes storefront-tokens.css's tokens/fonts/base rules --
 * everything from here down renders inside it; the portal's own pages never do. */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`sf-root ${sfHeadline.variable} ${sfBody.variable}`}>
      <CartProvider>
        <StorefrontShell>{children}</StorefrontShell>
      </CartProvider>
    </div>
  );
}
