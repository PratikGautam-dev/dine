"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { rupees } from "@/lib/foodOrders";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

type AlertOrder = {
  id: number;
  reference_id: string | null;
  patient_name: string | null;
  phone: string;
  total_paise: number;
  status: string;
};

const POLL_MS = 15_000;

/** Red banner across the top of the portal when a new order arrives. The first load only records the
 * existing orders as seen, so opening the portal never alerts about orders that were already there. */
export function NewOrderAlert() {
  const session = useStaffSession();
  const allowed = session !== null && hasPermission(session, "food_orders", "view");
  const [fresh, setFresh] = useState<AlertOrder[]>([]);
  const seenIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    async function check() {
      const result = await portalFetch("/api/portal/food-orders?days=1");
      if (cancelled || !result.ok) return;
      const orders = (result.data as { food_orders: AlertOrder[] }).food_orders.filter(
        (o) => o.status !== "cancelled",
      );
      if (seenIds.current === null) {
        seenIds.current = new Set(orders.map((o) => o.id));
        return;
      }
      const incoming = orders.filter((o) => !seenIds.current!.has(o.id));
      if (incoming.length === 0) return;
      incoming.forEach((o) => seenIds.current!.add(o.id));
      setFresh((prev) => [...incoming, ...prev].slice(0, 20));
    }
    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [allowed]);

  if (fresh.length === 0) return null;
  const latest = fresh[0];
  const who = latest.patient_name || latest.phone;

  return (
    <div
      role="alert"
      className="flex items-center gap-space-3 bg-error px-space-4 py-space-2 text-white"
    >
      <BellRing size={18} className="shrink-0" />
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
        {fresh.length === 1
          ? `New order ${latest.reference_id ?? `#${latest.id}`} from ${who} · ${rupees(latest.total_paise)}`
          : `${fresh.length} new orders. Latest: ${latest.reference_id ?? `#${latest.id}`} from ${who}`}
      </p>
      <Link
        href="/portal/food-orders"
        onClick={() => setFresh([])}
        className="shrink-0 rounded-md bg-white px-space-3 py-1 text-[12.5px] font-bold text-error hover:bg-white/90"
      >
        View orders
      </Link>
      <button
        type="button"
        onClick={() => setFresh([])}
        aria-label="Dismiss new order alert"
        className="shrink-0 rounded-md p-1 text-white/90 hover:bg-white/15"
      >
        <X size={16} />
      </button>
    </div>
  );
}
