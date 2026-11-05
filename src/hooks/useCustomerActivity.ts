import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";

export type ActivityEvent = {
  kind: "reservation" | "order" | "feedback" | "loyalty";
  id: number;
  status: string | null;
  occurred_at: string;
  is_table: boolean | null;
  party_size: number | null;
  amount_paise: number | null;
  rating: number | null;
  points: number | null;
};

/** The dedicated customer detail page's Activity timeline -- reservations/orders/feedback/
 * loyalty, derived live from their own tables on the backend (no separate interactions table to
 * keep in sync). `patientId` is the numeric id (not the public_id the page's own URL uses). */
export function useCustomerActivity(patientId: number | null) {
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (patientId === null) return;
    setLoading(true);
    const result = await portalFetch(`/api/portal/customers/${patientId}/activity`);
    setLoading(false);
    if (result.ok) setActivity((result.data as { activity: ActivityEvent[] }).activity);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { activity, loading };
}
