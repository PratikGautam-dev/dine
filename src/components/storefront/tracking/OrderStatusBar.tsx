// Re-skinned from dine-client's components/tracking/OrderStatusBar.tsx -- unlike the reference's
// fake "Live GPS Connected" / "Updated Ns ago" chrome (no GPS pings exist here), this one only
// ever shows real order fields: the real status badge (via the shared Badge component and
// STATUS_LABELS/STATUS_TONE, same as the rest of the storefront) and a plain, truthful note that
// the page polls the server every 10s -- nothing decorative lives in this file.
import { Badge } from "@/components/ui/Badge";
import type { STATUS_TONE } from "@/components/storefront/orderStatus";

type Props = {
  orderId: number;
  restaurantName: string | undefined;
  status: string;
  statusLabel: string;
  statusTone: (typeof STATUS_TONE)[string] | undefined;
  isTerminal: boolean;
};

export function OrderStatusBar({
  orderId,
  restaurantName,
  statusLabel,
  statusTone,
  isTerminal,
}: Props) {
  return (
    <div className="mb-space-5 w-full rounded-xl bg-sf-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-2 px-space-4 py-space-3">
        <div className="min-w-0">
          <p className="font-sf-body text-[11px] font-semibold uppercase tracking-wide text-sf-text-muted">
            Order #{orderId}
          </p>
          <p className="truncate font-sf-headline text-[16px] font-bold text-sf-on-surface">
            {restaurantName || "Your order"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-space-2">
          <Badge tone={statusTone || "neutral"}>{statusLabel}</Badge>
          {!isTerminal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sf-primary-light px-2.5 py-1 font-sf-body text-[11px] font-semibold text-sf-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sf-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sf-primary" />
              </span>
              Auto-refreshing
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
