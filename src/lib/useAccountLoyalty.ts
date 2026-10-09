"use client";

import { useEffect, useState } from "react";
import { publicFetch } from "@/lib/customerAuth";

export type LoyaltyTier = { id: string; name: string; threshold_paise: number; benefit: string };

export type LoyaltyInfo = {
  current_tier: string | null;
  points: number;
  total_spend_paise: number;
  tiers: LoyaltyTier[];
  next_tier: LoyaltyTier | null;
  amount_to_next_tier_paise: number | null;
  redeem_points: number | null;
  redeem_value_paise: number | null;
};

export type LoyaltyTransaction = { id: number; order_id: number | null; kind: string; points: number; created_at: string };

export type FavoriteDish = {
  name: string;
  restaurant_name: string;
  times_ordered: number;
  unit_price_paise: number;
  last_ordered_at: string;
};

const EMPTY_LOYALTY: LoyaltyInfo = {
  current_tier: null, points: 0, total_spend_paise: 0, tiers: [], next_tier: null,
  amount_to_next_tier_paise: null, redeem_points: null, redeem_value_paise: null,
};

/** Account page's Membership tab -- real tier thresholds/benefit text and the customer's real
 * current tier/points (hospitals.loyalty_settings + patients.loyalty_tier/points), replacing the
 * hardcoded TIERS/MEMBERSHIP mock. */
export function useAccountLoyalty(ready: boolean, slug?: string | null) {
  const [loyalty, setLoyalty] = useState<LoyaltyInfo>(EMPTY_LOYALTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    (async () => {
      setLoading(true);
      const result = await publicFetch<LoyaltyInfo>(`/api/public/profile/loyalty${query}`);
      setLoading(false);
      if (result.ok) setLoyalty(result.data);
    })();
  }, [ready, slug]);

  return { loyalty, loading };
}

/** Account page's Credits Ledger tab -- the real earn/redeem history (loyalty_transactions). */
export function useAccountLoyaltyLedger(ready: boolean, slug?: string | null) {
  const [transactions, setTransactions] = useState<LoyaltyTransaction[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    (async () => {
      const result = await publicFetch<{ transactions: LoyaltyTransaction[] }>(`/api/public/profile/loyalty-ledger${query}`);
      if (result.ok) setTransactions(result.data.transactions);
    })();
  }, [ready, slug]);

  return { transactions };
}

/** Account page's Favourites tab -- derived from this phone's real order history across every
 * restaurant, not a stored concept. */
export function useAccountFavorites(ready: boolean) {
  const [dishes, setDishes] = useState<FavoriteDish[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const result = await publicFetch<{ dishes: FavoriteDish[] }>("/api/public/profile/favorites");
      if (result.ok) setDishes(result.data.dishes);
    })();
  }, [ready]);

  return { dishes };
}
