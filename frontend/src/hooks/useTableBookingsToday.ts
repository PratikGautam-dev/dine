import { useEffect, useState } from "react";
import { matchesView, type Appointment } from "@/hooks/useAppointments";
import { portalFetch } from "@/lib/portalAuth";

/** table id -> today's reservation times (ISO, earliest first) at that table. Built from the same reservations
 * list the Reservations page uses; `null` while loading or when this person can't see reservations (the Tables
 * page then just leaves "booked today" out rather than showing a made-up number). */
export type TodayByTable = Record<string, string[]>;

export function useTableBookingsToday(enabled: boolean): TodayByTable | null {
  const [byTable, setByTable] = useState<TodayByTable | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const result = await portalFetch("/api/portal/bookings");
      if (cancelled || !result.ok) return;
      const now = new Date();
      const map: TodayByTable = {};
      for (const a of (result.data as { appointments: Appointment[] }).appointments) {
        if (a.table_id && matchesView(a, "today", now)) (map[a.table_id] ||= []).push(a.scheduled_at);
      }
      for (const times of Object.values(map)) times.sort();
      setByTable(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return byTable;
}
