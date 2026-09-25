import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";

export type FeedbackEntry = {
  id: number;
  phone: string;
  rating: number;
  comment: string | null;
  source: string;
  created_at: string;
  patient_name: string | null;
};

export type FeedbackSummary = {
  total: number;
  average_rating: number | null;
  breakdown: Record<string, number>;
};

/** Loads /api/portal/feedback -- the WhatsApp "Rate & Give Feedback" main-menu row's real rating
 * (+ optional comment) data (migration 0045). No sentiment/NPS/complaint-category system exists,
 * so this is exactly what the page has to work with. */
export function useFeedback(ready: boolean) {
  const router = useRouter();
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/feedback");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    const data = result.data as { summary: FeedbackSummary; entries: FeedbackEntry[] };
    setSummary(data.summary);
    setEntries(data.entries);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  return { summary, entries, error };
}
