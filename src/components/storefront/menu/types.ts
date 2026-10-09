// types.ts -- real API response shapes for a single restaurant's menu page
// (GET /api/public/restaurants/:slug), shared by [slug]/page.tsx and the
// OutletHeroCanvas/MenuSearchFilter/MenuGrid/StickyCheckoutBar components it
// renders. No fake fields are invented here.

export type Branch = { id: string; slug: string | null; name: string; address_line: string | null; city: string | null };

export type Restaurant = {
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
  rating: { average: number; count: number } | null;
  // Multi-branch (migration 0053): empty for every single-branch restaurant (today's behavior,
  // unchanged) -- only a real array once that restaurant has multi-branch on with 2+ locations.
  branches: Branch[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  category: string | null;
  image_url: string | null;
  stock_count: number | null;
  is_combo: boolean;
  combo_item_count: number | null;
  is_bestseller: boolean;
};

export type Category = { name: string; items: MenuItem[] };
export type MenuResponse = { restaurant: Restaurant; categories: Category[]; bestseller_ids: string[] };

export const BESTSELLERS = "__bestsellers__";
export const ALL = "__all__";

/** Material Symbols ligature name for a category, mirroring the old lucide-react mapping. */
export function categoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (/bever|drink|lassi|juice|shake|soda|tea|coffee/.test(n)) return "local_cafe";
  if (/dessert|sweet|ice/.test(n)) return "icecream";
  if (/bread|naan|roti|kulcha/.test(n)) return "bakery_dining";
  if (/starter|snack|tandoor|kebab|tikka/.test(n)) return "kebab_dining";
  if (/main|curry|biryani|rice|gravy|thali|combo/.test(n)) return "ramen_dining";
  return "restaurant";
}
