"use client";

// Ported from dine-client's components/categories/CategoryList.tsx. dine-client hardcoded 8
// cuisine categories with stock photos; there is no "category photo" field anywhere in the real
// data model, so instead of inventing one this derives the category chips from the REAL distinct
// `cuisines` strings across the passed-in Outlet[] (ranked by how many outlets carry them) and
// renders each as an icon circle (keyword-matched to a Material Symbol, with a generic fallback)
// instead of a photo. Clicking a category navigates to /order?search=<cuisine>, which re-triggers
// the real server-side ILIKE search against cuisine_tags.
import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { Outlet } from "@/components/storefront/types";

function iconForCuisine(cuisine: string): string {
  const c = cuisine.toLowerCase();
  if (/pizza/.test(c)) return "local_pizza";
  if (/burger/.test(c)) return "lunch_dining";
  if (/biryani|rice/.test(c)) return "rice_bowl";
  if (/dosa|south indian|idli/.test(c)) return "breakfast_dining";
  if (/dessert|sweet|bakery|cake/.test(c)) return "icecream";
  if (/healthy|salad|bowl/.test(c)) return "eco";
  if (/asian|chinese|noodle|wok/.test(c)) return "ramen_dining";
  if (/coffee|cafe|tea/.test(c)) return "coffee";
  if (/seafood|fish/.test(c)) return "set_meal";
  if (/north indian|mughlai|curry/.test(c)) return "soup_kitchen";
  return "restaurant";
}

type CategoryListProps = {
  outlets: Outlet[];
  listingsSectionId: string;
};

export function CategoryList({ outlets, listingsSectionId }: CategoryListProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scroll = (direction: "left" | "right") => {
    if (trackRef.current) {
      const scrollAmount = direction === "left" ? -260 : 260;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const counts = new Map<string, number>();
  for (const outlet of outlets) {
    for (const cuisine of outlet.cuisines) {
      const key = cuisine.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const categories = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const handleCategoryClick = (cuisine: string) => {
    router.push(`/order?search=${encodeURIComponent(cuisine)}`);
    document.getElementById(listingsSectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  if (categories.length === 0) return null;

  return (
    <section className="w-full bg-sf-surface py-12 px-4 sm:px-8 border-b border-sf-border-divider/40">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-sf-body text-xs text-sf-primary uppercase font-bold tracking-wider">
              Explore What&apos;s Craving
            </span>
            <h2 className="font-sf-headline text-2xl sm:text-3xl text-sf-on-surface font-bold mt-0.5">
              Top Culinary Categories
            </h2>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              className="h-10 w-10 rounded-full bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface flex items-center justify-center transition-colors cursor-pointer"
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll categories left"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <button
              className="h-10 w-10 rounded-full bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface flex items-center justify-center transition-colors cursor-pointer"
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll categories right"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex items-center gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth no-scrollbar"
        >
          {categories.map((name) => (
            <button
              key={name}
              onClick={() => handleCategoryClick(name)}
              className="group flex flex-col items-center gap-3 shrink-0 text-center cursor-pointer border-none bg-transparent focus:outline-none"
              type="button"
            >
              <div className="relative h-28 w-28 rounded-full overflow-hidden flex items-center justify-center p-1 bg-sf-surface-container-low shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:ring-2 group-hover:ring-sf-primary/30">
                <span className="material-symbols-outlined text-[40px] text-sf-primary">
                  {iconForCuisine(name)}
                </span>
              </div>
              <span className="font-sf-body text-sm text-sf-on-surface group-hover:text-sf-primary font-semibold transition-colors max-w-[112px] truncate">
                {name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
