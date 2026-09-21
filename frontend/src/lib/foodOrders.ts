// Small helpers for the food-orders page: money, times, and the kitchen's grouped views.

export const rupees = (paise: number) => {
  const whole = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? `₹${whole.toLocaleString("en-IN")}` : `₹${whole.toLocaleString("en-IN")}.${String(rest).padStart(2, "0")}`;
};

/** Order times arrive as ISO strings with an offset ("2026-09-21T17:20:00+00:00"); tolerate the database's own
 * "2026-09-21 17:20:00+00" spelling too, so a format change on the server can't silently break the page. */
export function parseOrderTime(raw: string): Date {
  let s = raw.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s += ":00";
  return new Date(s.replace(/(\.\d{3})\d+/, "$1"));
}

export function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today, 10:40 PM" / "20 Sept, 7:40 PM". */
export function formatOrderTime(raw: string, now = new Date()): string {
  const d = parseOrderTime(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return isSameLocalDay(d, now) ? `Today, ${time}` : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

// The views above the list group the individual statuses the way a kitchen thinks about them.
export type OrderView = "all" | "new" | "kitchen" | "ready" | "completed" | "cancelled" | "awaiting_payment";

export const VIEW_STATUSES: Record<Exclude<OrderView, "all">, string[]> = {
  new: ["placed", "paid"],
  kitchen: ["accepted", "preparing"],
  ready: ["ready_for_pickup", "out_for_delivery"],
  completed: ["completed"],
  cancelled: ["cancelled"],
  awaiting_payment: ["pending_payment"],
};

export function matchesOrderView(status: string, view: OrderView): boolean {
  return view === "all" || VIEW_STATUSES[view].includes(status);
}
