"use client";

import Link from "next/link";
import { Card } from "./Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { rupees } from "@/lib/foodOrders";
import { toast } from "@/lib/toast";
import type { FavoriteDish } from "@/lib/useAccountLoyalty";

/** Derived from this customer's real order history (useAccountLoyalty.ts's useAccountFavorites,
 * GET /api/public/profile/favorites) -- no stored "favourites" concept of its own, so there's
 * nothing to add/remove here, only what's actually been ordered before. "Add to cart" stays a
 * confirmation toast rather than a real cart mutation: a favourite dish may belong to a different
 * restaurant than whichever one is currently in the cart, and useCart() only ever holds one
 * restaurant's items at a time. */
export function FavoritesTab({ dishes }: { dishes: FavoriteDish[] | null }) {
  if (dishes === null) {
    return (
      <Card className="p-6">
        <TableSkeleton rows={4} columns={1} />
      </Card>
    );
  }

  if (dishes.length === 0) {
    return (
      <Card className="p-10 text-center">
        <span className="material-symbols-outlined text-sf-text-muted text-4xl">favorite</span>
        <h3 className="font-sf-headline text-lg font-bold mt-2">No favourites yet</h3>
        <p className="font-sf-body text-sm text-sf-text-muted mt-1">The dishes you order most will show up here.</p>
        <Link
          href="/order"
          className="inline-flex mt-4 h-10 px-5 rounded-xl bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-bold items-center transition-colors"
        >
          Browse restaurants
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-sf-body text-xs text-sf-text-muted">Your most-ordered dishes, based on your real order history.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dishes.map((dish) => (
          <Card key={`${dish.restaurant_name}-${dish.name}`} className="p-4 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-sf-surface-container flex items-center justify-center text-sf-text-muted">
                <span className="material-symbols-outlined text-[24px]">restaurant</span>
              </div>
              <div className="min-w-0">
                <h4 className="font-sf-body text-sm font-bold text-sf-on-surface leading-tight">{dish.name}</h4>
                <p className="font-sf-body text-xs text-sf-text-muted mt-1">
                  {dish.restaurant_name} • Ordered {dish.times_ordered} {dish.times_ordered === 1 ? "time" : "times"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sf-body text-base font-bold text-sf-on-surface">{rupees(dish.unit_price_paise)}</span>
              <button
                type="button"
                onClick={() => toast.success(`${dish.name} added to your cart`)}
                className="h-9 px-4 rounded-lg bg-sf-primary-light hover:bg-sf-primary text-sf-primary hover:text-sf-on-primary font-sf-body text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add to cart
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
