"use client";

// Web Storefront's cart: one restaurant at a time (mirrors Swiggy/Zomato --
// mixing menus from two kitchens makes no sense for a single order), kept in
// localStorage (cart_v1) so it survives a refresh/tab-close the same way a
// guest expects. Not tied to login -- someone can browse and build a cart
// before ever entering a phone number; login is only required at checkout.
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  menu_item_id: string;
  name: string;
  price_paise: number;
  quantity: number;
  image_url: string | null;
};

export type CartState = {
  slug: string | null;
  restaurantName: string | null;
  items: CartItem[];
  // Multi-branch (migration 0053): the location picked on the restaurant page, when that
  // restaurant has more than one active branch -- null for every single-branch restaurant
  // (today's behavior, unchanged) and reset back to null whenever the cart switches restaurants.
  branchId: string | null;
  branchName: string | null;
  // The branch's readable slug (e.g. "bandra-west"), used for the URL instead of the opaque
  // branchId -- null for a cart saved before this existed, or a branch somehow still without one.
  branchSlug: string | null;
};

const STORAGE_KEY = "cart_v1";
const EMPTY_CART: CartState = {
  slug: null,
  restaurantName: null,
  items: [],
  branchId: null,
  branchName: null,
  branchSlug: null,
};

function loadCart(): CartState {
  if (typeof window === "undefined") return EMPTY_CART;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY_CART;
    // A cart saved before branchId/branchName/branchSlug existed simply doesn't have them --
    // backfill so every downstream read can trust the shape without an `?? null` at every call site.
    return { branchId: null, branchName: null, branchSlug: null, ...parsed };
  } catch {
    return EMPTY_CART;
  }
}

type CartContextValue = {
  cart: CartState;
  /** True when the cart is empty or already belongs to this restaurant --
   * the menu page uses this to decide whether adding an item needs a
   * "switch restaurants, clear your cart?" confirmation first. */
  canAddFrom: (slug: string) => boolean;
  /** Clears any existing cart and starts a fresh one for this restaurant.
   * Callers only call this after the user has confirmed the switch. */
  startNewCart: (slug: string, restaurantName: string) => void;
  addItem: (slug: string, restaurantName: string, item: Omit<CartItem, "quantity">) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  /** Multi-branch (migration 0053): records which location this cart's order will be placed
   * against -- called once the guest picks a branch on the restaurant page. */
  setBranch: (branchId: string, branchName: string, branchSlug: string | null) => void;
  clearCart: () => void;
  subtotalPaise: number;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    function canAddFrom(slug: string) {
      return cart.slug === null || cart.slug === slug || cart.items.length === 0;
    }
    function startNewCart(slug: string, restaurantName: string) {
      setCart({ slug, restaurantName, items: [], branchId: null, branchName: null, branchSlug: null });
    }
    function addItem(slug: string, restaurantName: string, item: Omit<CartItem, "quantity">) {
      setCart((prev) => {
        const base: CartState =
          prev.slug === slug
            ? prev
            : { slug, restaurantName, items: [], branchId: null, branchName: null, branchSlug: null };
        const existing = base.items.find((i) => i.menu_item_id === item.menu_item_id);
        const items = existing
          ? base.items.map((i) =>
              i.menu_item_id === item.menu_item_id ? { ...i, quantity: i.quantity + 1 } : i,
            )
          : [...base.items, { ...item, quantity: 1 }];
        return { ...base, slug, restaurantName, items };
      });
    }
    function setBranch(branchId: string, branchName: string, branchSlug: string | null) {
      setCart((prev) => ({ ...prev, branchId, branchName, branchSlug }));
    }
    function setQuantity(menuItemId: string, quantity: number) {
      setCart((prev) => {
        const items =
          quantity <= 0
            ? prev.items.filter((i) => i.menu_item_id !== menuItemId)
            : prev.items.map((i) => (i.menu_item_id === menuItemId ? { ...i, quantity } : i));
        return items.length === 0 ? EMPTY_CART : { ...prev, items };
      });
    }
    function clearCart() {
      setCart(EMPTY_CART);
    }
    const subtotalPaise = cart.items.reduce((sum, i) => sum + i.price_paise * i.quantity, 0);
    const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      cart,
      canAddFrom,
      startNewCart,
      addItem,
      setQuantity,
      setBranch,
      clearCart,
      subtotalPaise,
      itemCount,
    };
  }, [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
