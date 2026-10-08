"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { FAVORITE_DISHES } from "@/lib/account";
import { toast } from "@/lib/toast";

/** Fully static placeholder tab (no "favourite dishes" backend exists yet) -- "Add to cart" here
 * can't add a real cart line since these placeholder dishes aren't tied to any real restaurant's
 * menu_item_id, so it just confirms the action with a toast rather than mutating useCart(). */
export function FavoritesTab() {
  if (FAVORITE_DISHES.length === 0) {
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
      <p className="font-sf-body text-xs text-sf-text-muted">Your most-ordered dishes, based on your order history.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FAVORITE_DISHES.map((dish) => (
          <Card key={dish.name} className="p-4 flex flex-col justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-sf-surface-container flex items-center justify-center text-sf-text-muted">
                <span className="material-symbols-outlined text-[24px]">restaurant</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      "w-3.5 h-3.5 mt-1 rounded-sm border flex items-center justify-center shrink-0",
                      dish.isVeg ? "border-sf-veg-green" : "border-sf-non-veg-brown",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", dish.isVeg ? "bg-sf-veg-green" : "bg-sf-non-veg-brown")} />
                  </span>
                  <h4 className="font-sf-body text-sm font-bold text-sf-on-surface leading-tight">{dish.name}</h4>
                </div>
                <p className="font-sf-body text-xs text-sf-text-muted mt-1">
                  {dish.restaurantName} • Ordered {dish.timesOrdered} {dish.timesOrdered === 1 ? "time" : "times"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sf-body text-base font-bold text-sf-on-surface">₹{dish.unitPrice}</span>
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
