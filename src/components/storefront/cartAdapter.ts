// cartAdapter.ts -- read-only display mapping from the real cart (src/lib/cart.tsx's CartItem,
// keyed by menu_item_id, price in paise) onto the shape dine-client's ported presentational
// components expect (keyed by id, price as a plain rupee number for display). This is NOT a
// second cart or a second source of truth: useCart() stays authoritative everywhere, and money
// stays in paise internally -- only this adapter's own output (used purely for rendering) ever
// expresses price as rupees, formatted through the same rupees() helper the rest of the app uses.
import type { CartItem } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";

export type DisplayCartItem = {
  id: string;
  name: string;
  /** Formatted for display only (e.g. "₹249") -- never do money math on this, use price_paise. */
  priceLabel: string;
  price_paise: number;
  quantity: number;
  lineTotalLabel: string;
  image: string | null;
  /** No backend field exists for this (menu items aren't tagged veg/non-veg) -- always false,
   * so ported components that render a veg/non-veg dot just show the non-veg mark rather than
   * inventing data. Documented here, not silently guessed at the call site. */
  isVeg: false;
};

export function toDisplayItem(item: CartItem): DisplayCartItem {
  return {
    id: item.menu_item_id,
    name: item.name,
    priceLabel: rupees(item.price_paise),
    price_paise: item.price_paise,
    quantity: item.quantity,
    lineTotalLabel: rupees(item.price_paise * item.quantity),
    image: item.image_url,
    isVeg: false,
  };
}

export function toDisplayItems(items: CartItem[]): DisplayCartItem[] {
  return items.map(toDisplayItem);
}
