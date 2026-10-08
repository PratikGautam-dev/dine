// Re-skinned from dine-client's components/tracking/TrackedOrderSummary.tsx -- same collapsible
// bill-breakdown layout, but every line comes from the real Order (items, subtotal_paise,
// delivery_fee_paise, discount_paise, total_paise), formatted with the existing rupees() helper
// instead of the reference's fake ₹-string formatter.
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { rupees } from "@/lib/foodOrders";

type OrderItem = {
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_paise_snapshot: number;
  quantity: number;
};

type Props = {
  items: OrderItem[];
  subtotalPaise: number;
  deliveryFeePaise: number | null;
  discountPaise: number;
  totalPaise: number;
};

export function TrackedOrderSummary({
  items,
  subtotalPaise,
  deliveryFeePaise,
  discountPaise,
  totalPaise,
}: Props) {
  const [open, setOpen] = useState(true);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tracked-order-summary"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-space-5 text-left transition-colors hover:bg-sf-surface-container-low"
      >
        <div className="flex items-center gap-space-2">
          <span className="material-symbols-outlined text-[22px] text-sf-primary">receipt_long</span>
          <div>
            <h4 className="font-sf-body text-[14px] font-bold text-sf-on-surface">
              Order summary ({itemCount} {itemCount === 1 ? "item" : "items"})
            </h4>
            <p className="font-sf-body text-[12px] text-sf-text-muted">Total: {rupees(totalPaise)}</p>
          </div>
        </div>
        <span
          className={cn(
            "material-symbols-outlined text-sf-text-muted transition-transform duration-300",
            !open && "rotate-180",
          )}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div id="tracked-order-summary" className="flex flex-col gap-space-2 px-space-5 pb-space-5">
          {items.map((item) => (
            <div key={item.menu_item_id} className="flex items-center justify-between gap-space-2 py-1">
              <span className="min-w-0 truncate font-sf-body text-[13px] text-sf-on-surface">
                {item.quantity}× {item.item_name_snapshot}
              </span>
              <span className="shrink-0 font-sf-body text-[13px] font-semibold text-sf-on-surface">
                {rupees(item.unit_price_paise_snapshot * item.quantity)}
              </span>
            </div>
          ))}

          <div className="flex flex-col gap-1 border-t border-sf-border-divider pt-space-2 font-sf-body text-[13px] text-sf-text-body">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{rupees(subtotalPaise)}</span>
            </div>
            {!!deliveryFeePaise && deliveryFeePaise > 0 && (
              <div className="flex justify-between">
                <span>Delivery fee</span>
                <span>{rupees(deliveryFeePaise)}</span>
              </div>
            )}
            {discountPaise > 0 && (
              <div className="flex justify-between text-sf-veg-green">
                <span>Discount</span>
                <span>-{rupees(discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-sf-body text-[14px] font-bold text-sf-on-surface">
              <span>Total</span>
              <span className="text-sf-primary">{rupees(totalPaise)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
