"use client";

// Ported from dine-client's components/menu/StickyCheckoutBar.tsx -- real cart data only
// (useCart()'s itemCount/subtotalPaise), shown while this page's own cart has items. Replaces
// the old [slug]/page.tsx's plain cart icon in the header with a bottom sticky bar.
import Link from "next/link";
import { rupees } from "@/lib/foodOrders";

type Props = { itemCount: number; subtotalPaise: number };

export function StickyCheckoutBar({ itemCount, subtotalPaise }: Props) {
  if (itemCount === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <Link
        href="/order/cart"
        className="pointer-events-auto mx-auto flex max-w-[900px] items-center justify-between rounded-2xl bg-sf-primary px-5 py-3 text-sf-on-primary shadow-xl transition-colors hover:bg-sf-secondary"
      >
        <span className="leading-tight">
          <span className="block font-sf-headline text-[17px] font-extrabold">
            {itemCount} item{itemCount === 1 ? "" : "s"} • {rupees(subtotalPaise)}
          </span>
          <span className="block font-sf-body text-[12.5px] text-white/85">View cart</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-sf-body text-[14.5px] font-bold text-sf-primary">
          Checkout <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </Link>
    </div>
  );
}
