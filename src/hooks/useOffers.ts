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
  fulfillment_type: "pickup" | "delivery" | "dine_in" | null;
  is_active: boolean;
  created_at: string;
  usage_count: number;
  revenue_paise: number;
  status: "active" | "scheduled" | "expired" | "disabled";
  branch_ids: string[];
  per_customer_limit: number | null;
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
  fulfillment_type: "pickup" | "delivery" | "dine_in" | "";
  branch_ids: string[];
  per_customer_limit: number | null;
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

  async function createOffer(fields: NewOfferFields, active = true): Promise<boolean> {
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
    const created = (result.data as { offer?: { id: number } }).offer;
    if (!active && created) {
      // the create endpoint always makes a live offer; a draft is switched off straight after
      await portalFetch(`/api/portal/offers/${created.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
    }
    toast.success(active ? "Offer created" : "Saved as draft (switched off)");
    load();
    return true;
  }

  /** Rewrites an offer's terms; `active` is applied afterwards when it differs from how the offer is now. */
  async function editOffer(
    offer: Offer,
    fields: NewOfferFields,
    active: boolean,
  ): Promise<boolean> {
    setCreating(true);
    const result = await portalFetch(`/api/portal/offers/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, fulfillment_type: fields.fulfillment_type || null }),
    });
    if (result.ok && active !== offer.is_active) {
      await portalFetch(`/api/portal/offers/${offer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
    }
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't save the offer", result.error);
      return false;
    }
    toast.success("Offer saved");
    load();
    return true;
  }

  async function deleteOffer(offer: Offer): Promise<boolean> {
    const result = await portalFetch(`/api/portal/offers/${offer.id}`, { method: "DELETE" });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't remove the offer", result.error);
      return false;
    }
    toast.success(
      (result.data as { deactivated?: boolean }).deactivated
        ? "Offer switched off (it has been used on orders)"
        : "Offer removed",
    );
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

  async function setOfferBranches(offer: Offer, branchIds: string[]): Promise<boolean> {
    const result = await portalFetch(`/api/portal/offers/${offer.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_ids: branchIds }),
    });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't update offer's branches", result.error);
      return false;
    }
    toast.success("Offer updated");
    load();
    return true;
  }

  return {
    data,
    error,
    creating,
    createOffer,
    editOffer,
    deleteOffer,
    toggleOffer,
    setOfferBranches,
  };
}
