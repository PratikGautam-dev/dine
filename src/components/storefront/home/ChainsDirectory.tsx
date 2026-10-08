"use client";

// Ported from dine-client's components/chains/ChainsDirectory.tsx. dine-client grouped outlets
// by a fake multi-brand "chain" concept with invented promo badges/ratings/distances. In
// dine-connect every restaurant is independent, so this is repurposed to group the flattened
// Outlet[] back by restaurant (since a multi-branch restaurant has one card per branch) and show
// each restaurant once with its real branch count, linking to /order/{slug} with no branch param
// -- the menu page's own branch picker handles which branch once the customer gets there.
import { useState } from "react";
import Link from "next/link";
import type { Outlet } from "@/components/storefront/types";

type RestaurantSummary = {
  slug: string;
  name: string;
  cuisines: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  isOpen: boolean;
  rating: { average: number; count: number } | null;
  branchCount: number;
};

function groupByRestaurant(outlets: Outlet[]): RestaurantSummary[] {
  const bySlug = new Map<string, RestaurantSummary>();
  for (const outlet of outlets) {
    const existing = bySlug.get(outlet.slug);
    if (existing) {
      existing.branchCount += 1;
      existing.isOpen = existing.isOpen || outlet.isOpen;
      continue;
    }
    bySlug.set(outlet.slug, {
      slug: outlet.slug,
      name: outlet.name,
      cuisines: outlet.cuisines,
      logoUrl: outlet.logoUrl,
      coverImageUrl: outlet.coverImageUrl,
      isOpen: outlet.isOpen,
      rating: outlet.rating,
      branchCount: 1,
    });
  }
  return Array.from(bySlug.values());
}

type ChainsDirectoryProps = {
  outlets: Outlet[];
  sectionId: string;
};

export function ChainsDirectory({ outlets, sectionId }: ChainsDirectoryProps) {
  const [activeFilter, setActiveFilter] = useState("all");

  const restaurants = groupByRestaurant(outlets);

  const cuisineCounts = new Map<string, number>();
  for (const r of restaurants) {
    for (const c of r.cuisines) cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1);
  }
  const topCuisines = Array.from(cuisineCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  const filtered =
    activeFilter === "all"
      ? restaurants
      : restaurants.filter((r) => r.cuisines.includes(activeFilter));

  if (restaurants.length === 0) return null;

  return (
    <section id={sectionId} className="w-full bg-sf-surface py-12 px-4 sm:px-8 border-b border-sf-border-divider/60">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sf-primary-light px-3 py-0.5 text-sf-primary mb-1">
              <span className="material-symbols-outlined text-[15px]">verified</span>
              <span className="font-sf-body text-xs font-bold uppercase tracking-wider">
                Restaurant Directory
              </span>
            </div>
            <h2 className="font-sf-headline text-2xl sm:text-3xl text-sf-on-surface font-extrabold">
              All Restaurants, One Place
            </h2>
            <p className="font-sf-body text-sm text-sf-text-muted mt-1">
              {restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"} with real menus and live
              branch availability.
            </p>
          </div>

          {topCuisines.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-full px-4 py-2 font-sf-body text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-sf-primary text-sf-on-primary shadow-sm"
                    : "bg-sf-surface-container-low text-sf-text-body hover:bg-sf-surface-container-high"
                }`}
              >
                All ({restaurants.length})
              </button>
              {topCuisines.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveFilter(c)}
                  className={`rounded-full px-4 py-2 font-sf-body text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeFilter === c
                      ? "bg-sf-primary text-sf-on-primary shadow-sm"
                      : "bg-sf-surface-container-low text-sf-text-body hover:bg-sf-surface-container-high"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((restaurant) => {
            const image = restaurant.coverImageUrl || restaurant.logoUrl;
            return (
              <Link
                key={restaurant.slug}
                href={`/order/${restaurant.slug}`}
                className="group relative rounded-2xl bg-sf-surface border border-sf-border-divider/70 p-3 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col justify-between hover:border-sf-primary/40"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden rounded-xl bg-sf-surface-container-low">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        src={image}
                        alt={restaurant.name}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sf-text-muted">
                        <span className="material-symbols-outlined text-[36px]">storefront</span>
                      </div>
                    )}

                    <div className="absolute top-2.5 right-2.5 rounded-lg bg-sf-primary text-sf-on-primary px-2.5 py-1 font-sf-body text-xs font-bold shadow-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">storefront</span>
                      <span>
                        {restaurant.branchCount > 1 ? `${restaurant.branchCount} branches` : "Single location"}
                      </span>
                    </div>

                    {restaurant.rating && (
                      <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-sf-veg-green text-sf-on-primary px-2.5 py-1 font-sf-body text-xs font-extrabold shadow-md flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        <span>
                          {restaurant.rating.average.toFixed(1)} ({restaurant.rating.count})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3.5">
                    <h3 className="font-sf-headline text-lg text-sf-on-surface font-extrabold group-hover:text-sf-primary transition-colors truncate">
                      {restaurant.name}
                    </h3>
                    <p className="font-sf-body text-xs text-sf-text-muted mt-1 leading-relaxed truncate">
                      {restaurant.cuisines.join(" • ") || "Multi-cuisine"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-sf-border-divider/60 -mx-3 -mb-3 p-3 bg-sf-surface-container-low/50 rounded-b-2xl flex items-center justify-between">
                  <span
                    className={`font-sf-body text-xs font-bold ${
                      restaurant.isOpen ? "text-sf-veg-green" : "text-sf-text-muted"
                    }`}
                  >
                    {restaurant.isOpen ? "Open now" : "Closed"}
                  </span>
                  <span className="rounded-lg bg-sf-primary text-sf-on-primary px-3.5 py-1.5 font-sf-body text-xs font-bold shadow-sm group-hover:bg-sf-secondary transition-colors">
                    View Menu
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
