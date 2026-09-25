import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Offer = {
  id: number;
  name: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  coupon_code: string;
  valid_from: string;
  valid_to: string;
  min_order_value_paise: number;
  max_redemptions: number | null;
  fulfillment_type: "pickup" | "delivery" | null;
  is_active: boolean;
  created_at: string;
  usage_count: number;
  revenue_paise: number;
  status: "active" | "scheduled" | "expired" | "disabled";
};

export type OffersSummary = {
  kpis: {
    active_offers: number;
    scheduled_campaigns: number;
    expiring_soon: number;
    coupon_redemptions: number;
    revenue_from_offers_paise: number;
  };
  trend: { date: string; label: string; redemptions: number; revenue_paise: number }[];
  top_redeemed: { name: string; usage_count: number; revenue_paise: number }[];
  customer_segments: { department_name: string; count: number }[];
  offers: Offer[];
};

export type NewOfferFields = {
  name: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  coupon_code: string;
  valid_from: string;
  valid_to: string;
  min_order_value_paise: number;
  max_redemptions: number | null;
  fulfillment_type: "pickup" | "delivery" | "" ;
};

/** Loads /api/portal/offers -- real coupon codes redeemable at WhatsApp food-order checkout
 * (migration 0046), with usage/revenue computed live from food_orders, never a stored counter. */
export function useOffers(ready: boolean) {
  const router = useRouter();
  const [data, setData] = useState<OffersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/offers");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setData(result.data as OffersSummary);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function createOffer(fields: NewOfferFields): Promise<boolean> {
    setCreating(true);
    const result = await portalFetch("/api/portal/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, fulfillment_type: fields.fulfillment_type || null }),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't create offer", result.error);
      return false;
    }
    toast.success("Offer created");
    load();
    return true;
  }

  async function toggleOffer(offer: Offer) {
    const result = await portalFetch(`/api/portal/offers/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !offer.is_active }),
    });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't update offer", result.error);
      return;
    }
    toast.success(offer.is_active ? "Offer disabled" : "Offer enabled");
    load();
  }

  return { data, error, creating, createOffer, toggleOffer };
}
