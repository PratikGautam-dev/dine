"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { publicFetch } from "@/lib/customerAuth";
import { rupees } from "@/lib/foodOrders";

type RestaurantCard = {
  hospital_id: number;
  name: string;
  slug: string;
  cuisines: string[];
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number;
  avg_prep_minutes: number;
  is_open: boolean;
};

export default function StorefrontMarketplacePage() {
  const [restaurants, setRestaurants] = useState<RestaurantCard[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <div className="border-b border-line bg-gradient-to-b from-brand-50 to-paper">
        <div className="mx-auto max-w-[1200px] px-space-4 py-space-8 text-center">
          <h1 className="text-display mb-space-2 text-[28px] leading-tight md:text-[36px]">
            Order food from restaurants near you
          </h1>
          <p className="text-body mb-space-6">Real menus, real kitchens -- ordered straight to the restaurant.</p>
          <div className="mx-auto flex max-w-[560px] flex-col gap-space-2 md:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search restaurants or cuisines"
                className="pl-space-8"
              />
            </div>
            {cities.length > 0 && (
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-11 rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 md:w-[160px]"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-space-4 py-space-6">
        {error && <p className="text-[13.5px] text-error">{error}</p>}

        {restaurants === null && !error && (
          <div className="grid grid-cols-1 gap-space-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[220px] animate-pulse rounded-lg bg-line/40" />
            ))}
          </div>
        )}

        {restaurants !== null && restaurants.length === 0 && (
          <div className="flex flex-col items-center gap-space-3 py-space-9 text-center">
            <UtensilsCrossed size={32} className="text-ink-300" />
            <p className="text-[14px] font-semibold text-ink-600">No restaurants found</p>
            <p className="text-[13px] text-ink-400">Try a different search or clear your filters.</p>
          </div>
        )}

        {restaurants !== null && restaurants.length > 0 && (
          <div className="grid grid-cols-1 gap-space-4 md:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <RestaurantCardTile key={r.hospital_id} restaurant={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantCardTile({ restaurant }: { restaurant: RestaurantCard }) {
  const content = (
    <div className="group overflow-hidden rounded-lg border border-line bg-card shadow-[var(--shadow-sm)] transition-all duration-150 ease-(--ease-standard) hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[var(--shadow-md)]">
      <div className="relative h-[140px] w-full bg-line/30">
        {restaurant.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-300">
            <UtensilsCrossed size={28} />
          </div>
        )}
        {!restaurant.is_open && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-full bg-white px-space-3 py-1 text-[11px] font-bold tracking-wide text-ink-900 uppercase">
              Closed now
            </span>
          </div>
        )}
        {restaurant.logo_url && (
          <div className="absolute -bottom-4 left-space-4 flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border-2 border-card bg-card shadow-[var(--shadow-sm)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={restaurant.logo_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
      <div className="p-space-4 pt-space-5">
        <p className="truncate text-[15px] font-bold text-ink-900">{restaurant.name}</p>
        {restaurant.tagline && <p className="truncate text-[12px] text-ink-500">{restaurant.tagline}</p>}
        {restaurant.cuisines.length > 0 && (
          <p className="mt-space-1 truncate text-[12.5px] text-ink-600">{restaurant.cuisines.join(", ")}</p>
        )}
        <div className="mt-space-3 flex flex-wrap items-center gap-space-3 text-[12px] text-ink-500">
          <span className="flex items-center gap-1">
            <Clock size={13} /> ~{restaurant.avg_prep_minutes} min
          </span>
          {restaurant.city && (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {restaurant.city}
            </span>
          )}
          {restaurant.min_order_paise > 0 && <Badge tone="neutral">Min {rupees(restaurant.min_order_paise)}</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <Link href={`/order/${restaurant.slug}`} aria-disabled={!restaurant.is_open}>
      {content}
    </Link>
  );
}
