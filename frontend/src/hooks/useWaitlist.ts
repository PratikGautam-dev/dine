import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type WaitlistEntry = {
  id: number;
  guest_name: string;
  phone: string | null;
  party_size: number;
  status: "waiting" | "assigned" | "cancelled";
  created_at: string;
};

// The waitlist panel polls -- a party's wait time only makes sense if it's actually ticking, and a
// staff member on another device may add/assign/cancel entries this tab needs to see.
const POLL_INTERVAL_MS = 15_000;

export function useWaitlist(ready: boolean) {
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/waitlist");
    if (result.ok) setEntries((result.data as { waitlist: WaitlistEntry[] }).waitlist);
  }, []);

  useEffect(() => {
    if (!ready) return;
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, load]);

  async function addEntry(guestName: string, partySize: number, phone: string) {
    setAdding(true);
    const result = await portalFetch("/api/portal/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_name: guestName, party_size: partySize, phone: phone || null }),
    });
    setAdding(false);
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't add to waitlist", result.error);
      return false;
    }
    load();
    return true;
  }

  async function assignEntry(id: number, tableId: string) {
    setActingId(id);
    const result = await portalFetch(`/api/portal/waitlist/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: tableId }),
    });
    setActingId(null);
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't assign a table", result.error);
      load();
      return;
    }
    toast.success("Table assigned");
    load();
  }

  async function cancelEntry(id: number) {
    setActingId(id);
    const result = await portalFetch(`/api/portal/waitlist/${id}/cancel`, { method: "POST" });
    setActingId(null);
    if (!result.ok && !result.unauthorized) toast.error("Couldn't remove from waitlist", result.error);
    load();
  }

  return { entries, actingId, adding, addEntry, assignEntry, cancelEntry };
}
