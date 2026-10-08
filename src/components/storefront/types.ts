// types.ts -- real API response shapes (GET /api/public/restaurants and the detail route) plus
// the flattened "one card per active branch" Outlet type the ported dine-client home/outlet UI
// renders. No fake fields (distance, discountBadge, highlights) are invented here; anything
// dine-client's original Outlet had that has no real backend data is simply absent from this
// type, and components read it defensively (e.g. `rating ?? null` → "New").

export type Branch = { id: string; name: string; address_line: string | null; city: string | null };

export type RestaurantCard = {
  hospital_id: number;
  name: string;
  slug: string;
  cuisines: string[];
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number | null;
  avg_prep_minutes: number | null;
  is_open: boolean;
  storefront_locked: boolean;
  branches: Branch[];
  rating: { average: number; count: number } | null;
};

/** One card per active branch (2+ branches) or exactly one card for the restaurant itself
 * (0/1 branches) -- the "restaurant×branch flattened" home-page model. `branchId: null` means
 * the card should route to /order/{slug} with no branch pre-selected (today's single-location
 * behavior, unchanged); a non-null branchId pre-selects that branch via /order/{slug}?branch=id. */
export type Outlet = {
  cardKey: string;
  slug: string;
  hospitalId: number;
  name: string;
  branchLabel: string | null;
  branchId: string | null;
  addressLine: string | null;
  city: string | null;
  cuisines: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  isOpen: boolean;
  avgPrepMinutes: number | null;
  rating: { average: number; count: number } | null;
};

export function flattenToOutlets(restaurants: RestaurantCard[]): Outlet[] {
  return restaurants.flatMap((r): Outlet[] => {
    if (r.branches.length === 0) {
      return [{
        cardKey: r.slug,
        slug: r.slug,
        hospitalId: r.hospital_id,
        name: r.name,
        branchLabel: null,
        branchId: null,
        addressLine: r.address_line,
        city: r.city,
        cuisines: r.cuisines,
        logoUrl: r.logo_url,
        coverImageUrl: r.cover_image_url,
        isOpen: r.is_open,
        avgPrepMinutes: r.avg_prep_minutes,
        rating: r.rating,
      }];
    }
    return r.branches.map((b) => ({
      cardKey: `${r.slug}:${b.id}`,
      slug: r.slug,
      hospitalId: r.hospital_id,
      name: r.name,
      branchLabel: b.name,
      branchId: b.id,
      addressLine: b.address_line ?? r.address_line,
      city: b.city ?? r.city,
      cuisines: r.cuisines,
      logoUrl: r.logo_url,
      coverImageUrl: r.cover_image_url,
      isOpen: r.is_open,
      avgPrepMinutes: r.avg_prep_minutes,
      rating: r.rating,
    }));
  });
}
