import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { superAdminFetch } from "@/lib/superAdminAuth";
import { toast } from "@/lib/toast";

/** Direct mirror of useOffers.ts's shape, talking to /api/admin/platform-offers instead of
 * /api/portal/offers -- a coupon that works across every restaurant (migration 0081), not just
 * one. No branch_ids (no branch concept at this level). */
export type PlatformOffer = {
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
  per_customer_limit: number | null;
};

export type PlatformOffersSummary = {
  kpis: {
    active_offers: number;
    scheduled_campaigns: number;
    expiring_soon: number;
    coupon_redemptions: number;
    revenue_from_offers_paise: number;
  };
  offers: PlatformOffer[];
};

export type NewPlatformOfferFields = {
  name: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  coupon_code: string;
  valid_from: string;
  valid_to: string;
  min_order_value_paise: number;
  max_redemptions: number | null;
  fulfillment_type: "pickup" | "delivery" | "";
  per_customer_limit: number | null;
};

/** Loads /api/admin/platform-offers -- coupon codes redeemable at checkout across EVERY
 * restaurant on the storefront, created/managed by a super admin. No trend/top_redeemed/
 * customer_segments (plan section 2/7's explicit v1 scope cut) -- just kpis + the offers table. */
export function usePlatformOffers(ready: boolean) {
  const router = useRouter();
  const [data, setData] = useState<PlatformOffersSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const result = await superAdminFetch("/api/admin/platform-offers");
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else setError(result.error);
      return;
    }
    setData(result.data as PlatformOffersSummary);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function createPlatformOffer(fields: NewPlatformOfferFields): Promise<boolean> {
    setCreating(true);
    const result = await superAdminFetch("/api/admin/platform-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, fulfillment_type: fields.fulfillment_type || null }),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else toast.error("Couldn't create coupon", result.error);
      return false;
    }
    toast.success("Platform coupon created");
    load();
    return true;
  }

  async function togglePlatformOffer(offer: PlatformOffer) {
    const result = await superAdminFetch(`/api/admin/platform-offers/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !offer.is_active }),
    });
    if (!result.ok) {
      if (result.unauthorized) router.push("/admin/login");
      else toast.error("Couldn't update coupon", result.error);
      return;
    }
    toast.success(offer.is_active ? "Coupon disabled" : "Coupon enabled");
    load();
  }

  return { data, error, creating, createPlatformOffer, togglePlatformOffer };
}
