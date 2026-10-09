"use client";

// Ported from dine-client's OutletNoticeBar -- there "selectedOutlet" was a global pin; here it
// becomes "you have an active cart from this restaurant", shown only while one exists (Header
// only renders this when cart.items.length > 0). "Change Outlet" becomes "Clear cart" -- the
// real equivalent action, since there's no second outlet to switch to mid-cart.
import Link from "next/link";
import { useCart } from "@/lib/cart";

export function OutletNoticeBar() {
  const { cart, clearCart } = useCart();
  if (!cart.slug) return null;

  return (
    <div className="bg-sf-primary-light border-t border-sf-border-divider/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2 flex items-center justify-between text-sf-on-surface text-xs sm:text-sm font-sf-body">
        <Link
          href={cart.branchId ? `/order/${cart.slug}?branch=${cart.branchSlug ?? cart.branchId}` : `/order/${cart.slug}`}
          className="flex items-center gap-2 truncate hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-sf-primary text-[18px] shrink-0">restaurant</span>
          <span className="truncate">
            <strong className="font-semibold text-sf-on-surface">Ordering from {cart.restaurantName}</strong>
            {cart.branchName && (
              <>
                {" "}
                (<span>{cart.branchName}</span>)
              </>
            )}
          </span>
        </Link>
        <button
          className="text-xs sm:text-sm text-sf-primary hover:text-sf-secondary font-semibold shrink-0 ml-3 underline underline-offset-2 cursor-pointer transition-colors"
          type="button"
          onClick={clearCart}
        >
          Clear cart
        </button>
      </div>
    </div>
  );
}
