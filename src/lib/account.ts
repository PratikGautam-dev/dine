// Static placeholder data for the /order/account page, ported from dine-client's lib/account.ts.
// Order History is wired to the real GET /api/public/orders endpoint elsewhere (see
// src/components/storefront/account/OrderHistory.tsx) -- everything exported from this file is
// intentionally still fake/placeholder content for the tabs that have no backend yet
// (membership, credits, addresses, favourites, settings), per the approved scope of this port.
//
// dine-client sourced its saved-address list from lib/checkout.ts, which this app's checkout page
// doesn't have (it just takes a free-text delivery address) -- so the small slice of that file the
// Addresses/Profile/Settings tabs need (SAVED_ADDRESSES, EMAIL_PATTERN, isValidPhone) lives here
// instead, trimmed to only the fields those tabs actually render.

export type AccountTab = "orders" | "membership" | "ledger" | "addresses" | "favorites" | "settings";

export interface Profile {
  name: string;
  phone: string;
  email: string;
  memberSince: string;
}

export interface CreditTransaction {
  id: string;
  title: string;
  detail: string;
  date: string;
  /** Positive for credits earned, negative for credits redeemed */
  points: number;
  kind: "cashback" | "bonus" | "redeemed";
}

export interface MembershipTier {
  id: string;
  name: string;
  threshold: number;
  summary: string;
  benefits: string[];
}

export interface SavedAddress {
  id: string;
  label: "Home" | "Work" | "Other";
  line: string;
  landmark?: string;
}

export interface FavoriteDish {
  name: string;
  isVeg: boolean;
  unitPrice: number;
  timesOrdered: number;
  restaurantName: string;
  image?: string;
}

export const TAB_LIST: { id: AccountTab; label: string; icon: string }[] = [
  { id: "orders", label: "Order History", icon: "receipt_long" },
  { id: "membership", label: "Membership & Rewards", icon: "military_tech" },
  { id: "ledger", label: "Credits Ledger", icon: "wallet" },
  { id: "addresses", label: "Saved Addresses", icon: "home_pin" },
  { id: "favorites", label: "Favorite Dishes", icon: "favorite" },
  { id: "settings", label: "Profile Settings", icon: "manage_accounts" },
];

/** Overwritten at runtime with the real phone/name from useCustomerSession() once it resolves --
 * email and memberSince have no backend field yet, so they stay as this placeholder forever. */
export const INITIAL_PROFILE: Profile = {
  name: "Guest Diner",
  phone: "",
  email: "diner@example.com",
  memberSince: "2023-10-15",
};

export const MEMBERSHIP = {
  currentTierId: "gold",
  renewsOn: "2026-10-28",
  lifetimeSpend: 7600,
  creditsExpireOn: "2026-12-31",
  yearlySavings: 4890,
  /** Spend by this date to reach the next tier */
  upgradeDeadline: "2026-12-31",
};

export const TIERS: MembershipTier[] = [
  {
    id: "silver",
    name: "Silver Explorer",
    threshold: 0,
    summary: "Achieved on joining. Basic 5% dining credits.",
    benefits: ["5% dining credits", "Member-only offers"],
  },
  {
    id: "gold",
    name: "Gold Gourmet",
    threshold: 5000,
    summary: "Free priority delivery, 10% credits cashback & chef's perks.",
    benefits: [
      "Free priority delivery",
      "10% extra cashback",
      "Chef's complimentary dessert",
      "Priority valet at outlets",
    ],
  },
  {
    id: "platinum",
    name: "Platinum VIP",
    threshold: 10000,
    summary: "Direct kitchen access chef tables, zero cancellation fees, personal dining concierge.",
    benefits: [
      "Chef table access",
      "Zero cancellation fees",
      "Personal dining concierge",
      "20% cashback",
    ],
  },
];

export const CREDITS_POINTS = 1450;

export const CREDIT_TRANSACTIONS: CreditTransaction[] = [
  { id: "tx-1", title: "Cashback: Tossin Pizza", detail: "10% Member Rate", date: "2026-10-06", points: 150, kind: "cashback" },
  { id: "tx-2", title: "Birthday Celebration Bonus", detail: "Annual Club Gift", date: "2026-10-05", points: 500, kind: "bonus" },
  { id: "tx-3", title: "Redeemed: Third Wave Coffee", detail: "Instant Bill Offset", date: "2026-10-01", points: -200, kind: "redeemed" },
  { id: "tx-4", title: "Cashback: Meghana Foods", detail: "Dine-in Special", date: "2026-09-29", points: 80, kind: "cashback" },
  { id: "tx-5", title: "Cashback: Truffles Cafe", detail: "10% Member Rate", date: "2026-09-27", points: 120, kind: "cashback" },
  { id: "tx-6", title: "Welcome Bonus", detail: "Gold tier upgrade gift", date: "2026-09-02", points: 800, kind: "bonus" },
];

export const SAVED_ADDRESSES: SavedAddress[] = [
  {
    id: "home",
    label: "Home",
    line: "Flat 402, Green Glen Layout, Bellandur, Bengaluru",
    landmark: "Near Sobha Iris, Landmark: Water Tank",
  },
  {
    id: "work",
    label: "Work",
    line: "Embassy TechVillage, Outer Ring Road, Devarabisanahalli",
    landmark: "Block 2A, 4th Floor, Desk 419",
  },
];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidPhone(value: string) {
  return /^\d{10}$/.test(value);
}

/** Most-ordered dishes -- hardcoded placeholder (dine-client derived this from its own fake
 * PAST_ORDERS + an outlet catalog that doesn't exist here; this is the same style of content,
 * just expressed directly since there's no backend "favourites" concept yet). */
export const FAVORITE_DISHES: FavoriteDish[] = [
  {
    name: 'Roma Pesto Burrata Gourmet Pizza (11")',
    isVeg: true,
    unitPrice: 675,
    timesOrdered: 4,
    restaurantName: "Tossin Pizza",
  },
  {
    name: "Meghana Special Andhra Chicken Biryani",
    isVeg: false,
    unitPrice: 310,
    timesOrdered: 6,
    restaurantName: "Meghana Foods",
  },
  {
    name: "Sea Salt Dark Mocha (Cold, Oat Milk)",
    isVeg: true,
    unitPrice: 190,
    timesOrdered: 5,
    restaurantName: "Third Wave Coffee",
  },
  {
    name: "All American Smashed Burger",
    isVeg: false,
    unitPrice: 340,
    timesOrdered: 3,
    restaurantName: "Truffles Cafe",
  },
  {
    name: "Crispy Paneer 65 Starter",
    isVeg: true,
    unitPrice: 160,
    timesOrdered: 2,
    restaurantName: "Meghana Foods",
  },
  {
    name: "Toasted Butter Almond Croissant",
    isVeg: true,
    unitPrice: 160,
    timesOrdered: 2,
    restaurantName: "Third Wave Coffee",
  },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DATE_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** ISO dates are parsed and formatted in UTC so server and client always agree */
export function formatShortDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatFullDate(iso: string) {
  return DATE_YEAR_FORMAT.format(new Date(iso));
}

export function formatMonthYear(iso: string) {
  return MONTH_YEAR_FORMAT.format(new Date(iso));
}
