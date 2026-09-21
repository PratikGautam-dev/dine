import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";

export type HandoffLite = {
  id: number;
  reason: "patient_requested" | "system_error";
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

const POLL_MS = 15_000;

/** Every conversation (any status, newest 100) for the summary tiles and tab counts, independent of which tab or date
 * is showing -- so the tiles always describe the whole queue. Polls, like the list itself. */
export function useHandoffOverview(ready: boolean, refreshKey: unknown): HandoffLite[] | null {
  const [all, setAll] = useState<HandoffLite[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    async function load() {
      const result = await portalFetch("/api/portal/handoffs?status=all");
      if (!cancelled && result.ok) setAll((result.data as { handoffs: HandoffLite[] }).handoffs);
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, refreshKey]);
  return all;
}

export type GuestSummary = {
  id: number;
  name: string | null;
  phone: string;
  patient_display_id: string | null;
  visit_count: number;
  visited_count: number;
  last_visit: string | null;
};

/** The selected conversation's guest from the guests directory (matched on the exact phone), or null when they have
 * no profile yet or this person can't see guests. */
export function useGuestSummary(phone: string | null, enabled: boolean): { guest: GuestSummary | null; loading: boolean } {
  const [state, setState] = useState<{ phone: string | null; guest: GuestSummary | null }>({ phone: null, guest: null });
  useEffect(() => {
    if (!enabled || !phone) return;
    let cancelled = false;
    (async () => {
      const result = await portalFetch(`/api/portal/patients?search=${encodeURIComponent(phone)}`);
      if (cancelled) return;
      const list = result.ok ? (result.data as { patients: GuestSummary[] }).patients : [];
      setState({ phone, guest: list.find((p) => p.phone === phone) ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [phone, enabled]);
  const loading = enabled && phone !== null && state.phone !== phone;
  return { guest: state.phone === phone ? state.guest : null, loading };
}
