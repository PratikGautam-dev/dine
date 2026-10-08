"use client";

// Ported from dine-client's CartDrawer -- a quick-view slide-in panel, re-skinned onto the real
// useCart() (one restaurant per cart, prices in paise) instead of AppContext's fake multi-brand
// cart. No coupon field here: that's the full checkout page's job (src/app/(storefront)/order/
// cart/page.tsx, which already calls the real /coupon-preview endpoint) -- a quick-view drawer
// faking a second coupon flow would just be two places the discount could disagree. Hand-rolled
// slide-in (no radix Sheet dependency, matching dine-connect's own Modal.tsx precedent) rather
// than porting dine-client's components/ui/sheet.tsx.
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";
import { toDisplayItems } from "../cartAdapter";

type Props = { open: boolean; onClose: () => void };

export function CartDrawer({ open, onClose }: Props) {
  const { cart, setQuantity, subtotalPaise } = useCart();
  const items = toDisplayItems(cart.items);

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-sf-scrim/40" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-sf-surface shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-5 border-b border-sf-border-divider bg-sf-surface flex items-center justify-between">
          <div>
            <h2 className="font-sf-headline text-lg font-bold text-sf-on-surface">Your Food Basket</h2>
            {cart.restaurantName && (
              <div className="flex items-center gap-2 text-xs text-sf-text-muted">
                <span className="font-semibold text-sf-primary">{cart.restaurantName}</span>
                {cart.branchName && (
                  <>
                    <span>•</span>
                    <span>{cart.branchName}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close cart" className="text-sf-text-muted hover:text-sf-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-sf-primary-light flex items-center justify-center text-sf-primary mb-4">
              <span className="material-symbols-outlined text-3xl">shopping_basket</span>
            </div>
            <h3 className="font-sf-headline text-lg font-bold text-sf-on-surface">Your cart is empty</h3>
            <p className="font-sf-body text-xs text-sf-text-muted mt-1 max-w-xs">
              Explore a restaurant&apos;s menu and add dishes to your order.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-xl bg-sf-primary text-sf-on-primary px-5 py-2.5 font-sf-body text-xs font-bold hover:bg-sf-secondary transition-colors"
            >
              Browse restaurants
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-sf-surface-container-low/60 border border-sf-border-divider/70"
              >
                <div className="flex-1 pr-2">
                  <h4 className="font-sf-body text-sm font-bold text-sf-on-surface leading-tight">{item.name}</h4>
                  <p className="font-sf-body text-xs text-sf-text-muted mt-0.5">{item.priceLabel} each</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center border border-sf-border-divider rounded-lg bg-sf-surface shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.id, item.quantity - 1)}
                      className="px-2.5 py-1 text-sm font-bold text-sf-primary hover:bg-sf-primary-light transition-colors"
                    >
                      -
                    </button>
                    <span className="px-2 text-xs font-bold text-sf-on-surface">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 text-sm font-bold text-sf-primary hover:bg-sf-primary-light transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-sf-body text-sm font-bold text-sf-on-surface min-w-[56px] text-right">
                    {item.lineTotalLabel}
                  </span>
                </div>
              </div>
            ))}

            <div className="p-4 rounded-xl bg-sf-surface-container-low/50 border border-sf-border-divider space-y-2 text-xs font-sf-body">
              <div className="pt-0 flex justify-between font-sf-headline text-base font-bold text-sf-on-surface">
                <span>Item total</span>
                <span>{rupees(subtotalPaise)}</span>
              </div>
              <p className="text-sf-text-muted">Delivery fee, taxes and any coupon are shown at checkout.</p>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="p-5 border-t border-sf-border-divider bg-sf-surface">
            <Link
              href="/order/cart"
              onClick={onClose}
              className="w-full rounded-xl bg-sf-primary hover:bg-sf-secondary text-sf-on-primary py-3.5 font-sf-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-between px-5 cursor-pointer"
            >
              <span>Proceed to checkout • {rupees(subtotalPaise)}</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
