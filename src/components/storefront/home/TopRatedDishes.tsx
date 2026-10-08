"use client";

// Ported from dine-client's components/dishes/TopRatedDishes.tsx. dine-client showed specific
// dishes (name/photo/price/rating) -- there is no real cross-restaurant "top dishes" endpoint or
// per-dish rating in dine-connect, so this is repurposed to a restaurant-level rail instead:
// the Outlet[] already passed to the page, sorted by real `rating.average` (nulls skipped), top
// 6-8, rendered with the exact same OutletCard ClosestOutlets uses (just in a horizontal scroll
// track rather than a grid). No fake dish names/photos/ratings/prices anywhere.
import { useRef } from "react";
import { OutletCard } from "./ClosestOutlets";
import type { Outlet } from "@/components/storefront/types";

type TopRatedDishesProps = {
  outlets: Outlet[];
  sectionId: string;
};

export function TopRatedDishes({ outlets, sectionId }: TopRatedDishesProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (trackRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const topRated = outlets
    .filter((o): o is Outlet & { rating: NonNullable<Outlet["rating"]> } => o.rating !== null)
    .sort((a, b) => b.rating.average - a.rating.average)
    .slice(0, 8);

  if (topRated.length === 0) return null;

  return (
    <section id={sectionId} className="w-full bg-sf-surface py-12 px-4 sm:px-8 border-b border-sf-border-divider/40">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-sf-body text-xs text-sf-primary uppercase font-bold tracking-wider">
              Crowd Favorites
            </span>
            <h2 className="font-sf-headline text-2xl sm:text-3xl text-sf-on-surface font-bold">
              Top Rated Restaurants
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="h-10 w-10 rounded-full bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface flex items-center justify-center transition-colors cursor-pointer"
              type="button"
              onClick={() => scroll("left")}
              aria-label="Previous restaurants"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <button
              className="h-10 w-10 rounded-full bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface flex items-center justify-center transition-colors cursor-pointer"
              type="button"
              onClick={() => scroll("right")}
              aria-label="Next restaurants"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 scroll-smooth no-scrollbar"
        >
          {topRated.map((outlet) => (
            <OutletCard key={outlet.cardKey} outlet={outlet} className="w-72 shrink-0" />
          ))}
        </div>
      </div>
    </section>
  );
}
