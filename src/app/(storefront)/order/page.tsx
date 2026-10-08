"use client";

// Home page of the /order storefront -- ported visually from dine-client's app/page.tsx
// (HeroSlider, CategoryList, OffersStrip, ChainsDirectory, ClosestOutlets, TopRatedDishes,
// HowItWorks, PartnerBanner), composed around the SAME real data-fetching behavior the page had
// before this port: a 250ms-debounced GET /api/public/restaurants?search=&city= via publicFetch,
// flattened to one-card-per-branch via flattenToOutlets. Initial `search`/`city` are read from
// useSearchParams() once on mount (the shared Header navigates here with those params), matching
// this app's existing convention (see navbar/Header.tsx's own comment) rather than staying fully
// synced to the URL on every navigation.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { publicFetch } from "@/lib/customerAuth";
import { flattenToOutlets, type RestaurantCard } from "@/components/storefront/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeroSlider } from "@/components/storefront/home/HeroSlider";
import { CategoryList } from "@/components/storefront/home/CategoryList";
import { OffersStrip } from "@/components/storefront/home/OffersStrip";
import { ChainsDirectory } from "@/components/storefront/home/ChainsDirectory";
import { ClosestOutlets } from "@/components/storefront/home/ClosestOutlets";
import { TopRatedDishes } from "@/components/storefront/home/TopRatedDishes";
import { HowItWorks } from "@/components/storefront/home/HowItWorks";
import { PartnerBanner } from "@/components/storefront/home/PartnerBanner";

const LISTINGS_SECTION_ID = "listings-section";
const TOP_RATED_SECTION_ID = "top-rated-section";
const CHAINS_SECTION_ID = "chains-section";

export default function StorefrontHomePage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [city, setCity] = useState(() => searchParams.get("city") ?? "");
  const [restaurants, setRestaurants] = useState<RestaurantCard[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Picks up search/city changes that happen via a real navigation (e.g. the shared Header's
  // search box or a category/restaurant link elsewhere pushing a new ?search=/?city=) without
  // clobbering the user actively typing in this page's own hero search box, since typing here
  // never touches the URL.
  useEffect(() => {
    const nextSearch = searchParams.get("search") ?? "";
    const nextCity = searchParams.get("city") ?? "";
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setCity((prev) => (prev === nextCity ? prev : nextCity));
  }, [searchParams]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (city) params.set("city", city);
      const result = await publicFetch<{ restaurants: RestaurantCard[]; cities: string[] }>(
        `/api/public/restaurants?${params.toString()}`,
      );
      if (result.ok) {
        setRestaurants(result.data.restaurants);
        setCities(result.data.cities);
        setError(null);
      } else {
        setError(result.error);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, city]);

  const outlets = restaurants ? flattenToOutlets(restaurants) : [];
  const loading = restaurants === null && !error;
  const empty = restaurants !== null && restaurants.length === 0;

  return (
    <div className="flex flex-col w-full">
      <HeroSlider
        search={search}
        onSearchChange={setSearch}
        city={city}
        cities={cities}
        onCityChange={setCity}
        listingsSectionId={LISTINGS_SECTION_ID}
      />

      <CategoryList outlets={outlets} listingsSectionId={LISTINGS_SECTION_ID} />

      <OffersStrip />

      {error && (
        <p className="mx-auto max-w-7xl w-full px-4 sm:px-8 pt-8 text-[13.5px] text-sf-error">{error}</p>
      )}

      {loading && (
        <section className="w-full bg-sf-surface-container-low/50 py-12 px-4 sm:px-8">
          <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[280px] w-full rounded-2xl" />
            ))}
          </div>
        </section>
      )}

      {empty && (
        <section className="w-full py-16 px-4 sm:px-8">
          <div className="mx-auto max-w-7xl flex flex-col items-center gap-3 text-center">
            <UtensilsCrossed size={32} className="text-sf-text-muted" />
            <p className="font-sf-headline text-lg font-bold text-sf-on-surface">
              No restaurants found
            </p>
            <p className="font-sf-body text-sm text-sf-text-muted">
              Try a different search or clear your filters.
            </p>
          </div>
        </section>
      )}

      {!loading && !empty && (
        <>
          <ChainsDirectory outlets={outlets} sectionId={CHAINS_SECTION_ID} />
          <ClosestOutlets outlets={outlets} sectionId={LISTINGS_SECTION_ID} />
          <TopRatedDishes outlets={outlets} sectionId={TOP_RATED_SECTION_ID} />
        </>
      )}

      <HowItWorks />

      <PartnerBanner />
    </div>
  );
}
