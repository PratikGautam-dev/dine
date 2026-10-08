// Re-skinned from dine-client's components/tracking/OutletContactCard.tsx. Uses the real
// order.restaurant.name; the phone number has no backing field on Order so it stays a static
// placeholder (clearly labelled) rather than inventing a real-looking number.
import { Card } from "@/components/ui/Card";

export function OutletContactCard({ restaurantName }: { restaurantName: string | undefined }) {
  return (
    <Card className="flex items-start gap-space-3 p-space-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sf-surface-container text-sf-primary">
        <span className="material-symbols-outlined text-[22px]">restaurant</span>
      </div>
      <div className="min-w-0">
        <h4 className="truncate font-sf-body text-[14px] font-bold text-sf-on-surface">
          {restaurantName || "Restaurant"}
        </h4>
        <p className="mt-0.5 font-sf-body text-[12px] text-sf-text-muted">
          Support: contact the restaurant via the app for order issues
        </p>
      </div>
    </Card>
  );
}
