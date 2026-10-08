// Step 5: the exact bill math from the old cart page, unchanged -- just reskinned onto
// dine-client's OrderSummary bill-breakdown look.
import { rupees } from "@/lib/foodOrders";
import { CheckoutSection } from "./CheckoutSection";
import type { FulfillmentType } from "./types";

type Props = {
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  fulfillment: FulfillmentType;
  minOrderPaise: number;
  belowMin: boolean;
};

export function BillSummary({
  subtotalPaise,
  deliveryFeePaise,
  discountPaise,
  totalPaise,
  fulfillment,
  minOrderPaise,
  belowMin,
}: Props) {
  return (
    <CheckoutSection step={5} title="Bill details">
      <div className="space-y-2 font-sf-body text-sm text-sf-text-body">
        <div className="flex justify-between">
          <span>Item total</span>
          <span className="font-medium text-sf-on-surface">{rupees(subtotalPaise)}</span>
        </div>
        {fulfillment === "delivery" && (
          <div className="flex justify-between">
            <span>Delivery fee</span>
            <span
              className={
                deliveryFeePaise === 0
                  ? "font-semibold text-sf-veg-green"
                  : "font-medium text-sf-on-surface"
              }
            >
              {deliveryFeePaise === 0 ? "Free" : rupees(deliveryFeePaise)}
            </span>
          </div>
        )}
        {discountPaise > 0 && (
          <div className="flex justify-between font-semibold text-sf-veg-green">
            <span>Discount</span>
            <span>-{rupees(discountPaise)}</span>
          </div>
        )}
        <div className="flex items-center justify-between rounded-lg bg-sf-surface-container-low px-3 py-3 mt-1">
          <span className="font-sf-headline text-base font-bold text-sf-on-surface">To pay</span>
          <span className="font-sf-headline text-xl font-bold text-sf-primary">{rupees(totalPaise)}</span>
        </div>
      </div>
      {belowMin && (
        <p className="mt-3 rounded-lg bg-sf-warning-soft px-3 py-2 font-sf-body text-xs font-semibold text-sf-warning">
          Minimum order is {rupees(minOrderPaise)} — add {rupees(minOrderPaise - subtotalPaise)} more.
        </p>
      )}
    </CheckoutSection>
  );
}
