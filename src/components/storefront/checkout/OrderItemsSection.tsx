// Step 1: the real cart lines -- same `useCart().setQuantity` wiring the old cart page used,
// reskinned onto dine-client's OrderSummary item-row look (qty stepper pill, trash-on-last-unit).
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";
import { CheckoutSection } from "./CheckoutSection";

type Props = {
  slug: string;
  items: CartItem[];
  onQuantityChange: (menuItemId: string, quantity: number) => void;
};

export function OrderItemsSection({ slug, items, onQuantityChange }: Props) {
  return (
    <CheckoutSection
      step={1}
      title="Your order"
      subtitle={`${items.reduce((sum, i) => sum + i.quantity, 0)} item${items.length === 1 ? "" : "s"}`}
    >
      <div className="divide-y divide-sf-border-divider">
        {items.map((item) => (
          <div key={item.menu_item_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sf-primary-light text-sf-primary">
                <span className="material-symbols-outlined text-[22px]">restaurant</span>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-sf-body text-sm font-bold text-sf-on-surface">{item.name}</p>
              <p className="font-sf-body text-xs text-sf-text-muted">{rupees(item.price_paise)} each</p>
            </div>
            <div className="inline-flex items-center rounded-full bg-sf-primary text-sf-on-primary">
              <button
                type="button"
                onClick={() => onQuantityChange(item.menu_item_id, item.quantity - 1)}
                aria-label="Decrease quantity"
                className="flex h-8 w-8 cursor-pointer items-center justify-center"
              >
                {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
              </button>
              <span className="w-4 text-center font-sf-body text-sm font-bold">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(item.menu_item_id, item.quantity + 1)}
                aria-label="Increase quantity"
                className="flex h-8 w-8 cursor-pointer items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="w-[62px] shrink-0 text-right font-sf-body text-sm font-bold text-sf-on-surface">
              {rupees(item.price_paise * item.quantity)}
            </span>
          </div>
        ))}
      </div>
      <Link
        href={`/order/${slug}`}
        className="mt-3 inline-flex items-center gap-1 font-sf-body text-sm font-bold text-sf-primary hover:underline"
      >
        <Plus size={14} /> Add more items
      </Link>
    </CheckoutSection>
  );
}
