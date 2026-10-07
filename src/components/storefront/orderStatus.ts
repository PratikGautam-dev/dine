// Shared between the orders list and the order tracker -- keeps the same
// human labels/colors for every food_orders.STATUS_* value (db/repositories/
// food_orders.py) wherever a web storefront page shows one.
export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  placed: "Order placed",
  paid: "Payment confirmed",
  accepted: "Accepted by kitchen",
  preparing: "Being prepared",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<
  string,
  "brand" | "clay" | "success" | "neutral" | "warning" | "violet"
> = {
  pending_payment: "warning",
  placed: "brand",
  paid: "brand",
  accepted: "violet",
  preparing: "violet",
  ready_for_pickup: "success",
  out_for_delivery: "success",
  completed: "success",
  cancelled: "neutral",
};

// The tracker's ordered timeline -- pending_payment/cancelled are shown
// separately (a coupon's discount, a failed payment, a cancellation) rather
// than as a step on this happy-path progression.
export const TRACKER_STEPS = [
  "placed",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "completed",
] as const;

export function trackerStepIndex(status: string): number {
  // paid counts as "placed" (kitchen hasn't acted yet); out_for_delivery
  // counts as "ready_for_pickup" (same tracker position, different label) --
  // both are display-only aliases onto TRACKER_STEPS' four checkpoints.
  const normalized =
    status === "paid" ? "placed" : status === "out_for_delivery" ? "ready_for_pickup" : status;
  return TRACKER_STEPS.indexOf(normalized as (typeof TRACKER_STEPS)[number]);
}
