// Re-skinned from dine-client's components/tracking/TrackingTimeline.tsx -- the visual shape
// (vertical stepper with connecting rail, "Active Now" chip, per-step detail line) is ported, but
// every step's done/active/pending state comes from the REAL trackerStepIndex(order.status) --
// see @/components/storefront/orderStatus -- not from the reference's simulated clock. No fake
// ETAs or timestamps are shown.
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { TRACKER_STEPS } from "@/components/storefront/orderStatus";

type Step = (typeof TRACKER_STEPS)[number];

const STEP_META: Record<Step, { title: string; icon: string }> = {
  placed: { title: "Order placed", icon: "receipt_long" },
  accepted: { title: "Accepted by kitchen", icon: "task_alt" },
  preparing: { title: "Being prepared", icon: "local_fire_department" },
  ready_for_pickup: { title: "Ready", icon: "inventory_2" },
  completed: { title: "Completed", icon: "home" },
};

type Props = {
  stepIndex: number;
  restaurantName: string | undefined;
  fulfillmentType: string;
  deliveryAddress: string | null;
  paymentMethod: string;
};

function detailFor(
  step: Step,
  status: "done" | "active" | "pending",
  { restaurantName, fulfillmentType, deliveryAddress, paymentMethod }: Props,
): string | null {
  const isDelivery = fulfillmentType === "delivery";
  switch (step) {
    case "placed":
      return `Payment via ${paymentMethod.replace(/_/g, " ")}`;
    case "accepted":
      return status === "pending" ? null : `${restaurantName || "The restaurant"} accepted your order`;
    case "preparing":
      return status === "pending" ? null : "Your food is being prepared fresh";
    case "ready_for_pickup":
      if (status === "pending") return null;
      return isDelivery ? "Waiting to be picked up by a delivery partner" : "Ready for pickup at the counter";
    case "completed":
      if (status !== "done") return null;
      return isDelivery && deliveryAddress ? `Delivered to ${deliveryAddress}` : "Order completed";
    default:
      return null;
  }
}

export function TrackingTimeline(props: Props) {
  const { stepIndex } = props;

  return (
    <Card className="flex flex-col gap-space-4 p-space-5">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-sf-surface-container"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TRACKER_STEPS.length - 1}
        aria-valuenow={Math.max(0, stepIndex)}
        aria-label="Order progress"
      >
        <div
          className="h-full rounded-full bg-sf-primary transition-all duration-700 ease-out"
          style={{ width: `${(Math.max(0, stepIndex) / (TRACKER_STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <ol className="flex flex-col">
        {TRACKER_STEPS.map((step, i) => {
          const status: "done" | "active" | "pending" =
            i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
          const isLast = i === TRACKER_STEPS.length - 1;
          const nextDone = i + 1 <= stepIndex;
          const meta = STEP_META[step];
          const detail = detailFor(step, status, props);

          return (
            <li key={step} className="flex items-start gap-space-3">
              <div className="flex flex-col items-center self-stretch">
                {status === "active" ? (
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sf-primary-soft opacity-75" />
                    <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-sf-primary text-sf-on-primary shadow-md">
                      <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
                    </span>
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      status === "done"
                        ? "bg-sf-veg-green text-sf-on-primary shadow-sm"
                        : "bg-sf-surface-container text-sf-text-muted",
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {status === "done" ? "check" : meta.icon}
                    </span>
                  </span>
                )}
                {!isLast && (
                  <div
                    className={cn(
                      "mt-1 w-0.5 flex-1",
                      status === "done" && nextDone ? "bg-sf-primary" : "bg-sf-surface-container",
                    )}
                  />
                )}
              </div>

              <div className={cn("min-w-0 flex-1", !isLast && "pb-space-5")}>
                <div className="flex flex-wrap items-center gap-space-2">
                  <h3
                    className={cn(
                      "font-sf-body text-[14px]",
                      status === "active" && "font-bold text-sf-primary",
                      status === "done" && "font-semibold text-sf-on-surface",
                      status === "pending" && "font-medium text-sf-text-muted",
                    )}
                  >
                    {meta.title}
                  </h3>
                  {status === "active" && (
                    <span className="rounded-full bg-sf-primary-light px-2 py-0.5 font-sf-body text-[11px] font-semibold text-sf-primary">
                      Active now
                    </span>
                  )}
                </div>
                {detail && (
                  <p
                    className={cn(
                      "mt-0.5 font-sf-body text-[12.5px]",
                      status === "pending" ? "text-sf-text-muted" : "text-sf-text-body",
                    )}
                  >
                    {detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
