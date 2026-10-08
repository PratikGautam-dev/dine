"use client";

// Ported from dine-client's components/navbar/Header.tsx, re-skinned classes unchanged (sf-
// prefixed tokens) but rewired off real data: no global "selectedOutlet" exists in dine-connect's
// marketplace-of-many-restaurants model, so the location pill becomes a city filter (the same
// `city` param /api/public/restaurants already supports) instead of a single pinned outlet.
// Self-contained on purpose: search/city live here as local input state and navigate via URL
// params to /order (the home page reads them back out of useSearchParams on mount), so this
// component needs no props threaded down from the layout for them -- only the cart-open callback,
// since CartDrawer's open/closed state is owned by StorefrontShell alongside the drawer itself.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCustomerSession, publicFetch, useCustomerSession } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { OutletNoticeBar } from "./OutletNoticeBar";

type Props = { onOpenCart: () => void };

export function Header({ onOpenCart }: Props) {
  const router = useRouter();
  const session = useCustomerSession();
  const { cart, itemCount } = useCart();
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicFetch<{ cities: string[] }>("/api/public/restaurants").then((result) => {
      if (!cancelled && result.ok) setCities(result.data.cities);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function goHomeWith(params: Record<string, string>) {
    const qs = new URLSearchParams(params);
    router.push(qs.toString() ? `/order?${qs.toString()}` : "/order");
  }

  function handleLogout() {
    clearCustomerSession();
    router.push("/order");
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-sf-surface/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-sf-border-divider/50">
      <div className="h-20 max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <Link className="flex items-center gap-2 group cursor-pointer" href="/order">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sf-primary text-sf-on-primary shadow-sm transition-transform group-hover:scale-105">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-sf-headline text-[20px] text-sf-primary tracking-tight font-extrabold">
                Dine Connect
              </span>
              <span className="font-sf-body text-[10px] tracking-wider uppercase text-sf-text-muted font-bold">
                Order Online
              </span>
            </div>
          </Link>

          <div className="h-8 w-[1px] bg-sf-border-divider hidden lg:block" />

          <div className="relative">
            <button
              className="flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container-high transition-colors cursor-pointer"
              type="button"
              onClick={() => setCityPickerOpen((v) => !v)}
              title="Filter by city"
            >
              <div className="w-8 h-8 rounded-lg bg-sf-primary/10 flex items-center justify-center text-sf-primary shrink-0">
                <span className="material-symbols-outlined text-[19px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  location_on
                </span>
              </div>
              <div className="leading-tight pr-1">
                <div className="flex items-center gap-1 font-sf-body text-[13px] text-sf-on-surface font-bold">
                  <span>All cities</span>
                  <span className="material-symbols-outlined text-[16px] text-sf-text-muted">keyboard_arrow_down</span>
                </div>
              </div>
            </button>
            {cityPickerOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-sf-border-divider bg-sf-surface shadow-lg py-1.5 z-50">
                {cities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="w-full text-left px-3.5 py-2 font-sf-body text-[13px] text-sf-on-surface hover:bg-sf-surface-container-low"
                    onClick={() => {
                      setCityPickerOpen(false);
                      goHomeWith({ city: c });
                    }}
                  >
                    {c}
                  </button>
                ))}
                {cities.length === 0 && (
                  <p className="px-3.5 py-2 font-sf-body text-[12.5px] text-sf-text-muted">No cities yet</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-sf-text-muted absolute left-3 pointer-events-none text-[20px]">
              search
            </span>
            <input
              className="w-full h-11 pl-10 pr-4 bg-sf-surface rounded-full border border-sf-border-divider font-sf-body text-sm text-sf-on-surface placeholder:text-sf-text-muted focus:outline-none focus:border-sf-primary transition-colors shadow-none"
              placeholder="Search restaurants, dishes..."
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goHomeWith(search ? { search } : {});
              }}
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 text-sf-text-muted hover:text-sf-on-surface"
                onClick={() => setSearch("")}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <nav className="hidden xl:flex items-center gap-5">
            <Link
              className="font-sf-body text-sm text-sf-on-surface-variant hover:text-sf-on-surface transition-colors font-medium cursor-pointer"
              href="/order/book-table"
            >
              Book a Table
            </Link>
            {session && (
              <Link
                className="font-sf-body text-sm text-sf-primary hover:text-sf-secondary transition-colors font-semibold cursor-pointer flex items-center gap-1"
                href="/order/account?tab=orders"
              >
                <span className="material-symbols-outlined text-[18px]">near_me</span>
                My Orders
              </Link>
            )}
          </nav>

          {session === undefined ? null : session === null ? (
            <Link
              href="/order/login"
              className="font-sf-body text-sm text-sf-on-surface hover:text-sf-primary transition-colors font-medium cursor-pointer px-1 py-1"
            >
              Log in
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="font-sf-body text-sm text-sf-on-surface hover:text-sf-primary transition-colors font-medium cursor-pointer px-1 py-1"
            >
              Log out
            </button>
          )}

          <button
            className="relative flex items-center justify-center p-2 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container-high transition-colors text-sf-on-surface cursor-pointer"
            type="button"
            onClick={onOpenCart}
            aria-label="View shopping cart"
          >
            <span className="material-symbols-outlined text-[24px]">shopping_bag</span>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-sf-primary text-sf-on-primary font-sf-body text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                {itemCount}
              </span>
            )}
          </button>

          <Link
            href="/order/account"
            className="w-8 h-8 rounded-full bg-sf-primary flex items-center justify-center text-sf-on-primary cursor-pointer hover:opacity-90 transition-opacity"
            title="My Account"
            aria-label="My account"
          >
            <span className="material-symbols-outlined text-sf-on-primary text-[18px]">person</span>
          </Link>
        </div>
      </div>

      {cart.slug && cart.items.length > 0 && <OutletNoticeBar />}
    </header>
  );
}
