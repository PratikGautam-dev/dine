"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Clock, MapPin, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { publicFetch } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";

type Restaurant = {
  hospital_id: number;
  name: string;
  slug: string;
  cuisines: string[];
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number;
  avg_prep_minutes: number;
  is_open: boolean;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  category: string | null;
  image_url: string | null;
  stock_count: number | null;
  is_combo: boolean;
  combo_item_count: number | null;
};

type Category = { name: string; items: MenuItem[] };

type MenuResponse = { restaurant: Restaurant; categories: Category[]; delivery_fee_paise: { pickup: number; delivery: number } };

export default function RestaurantMenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<MenuResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const { cart, canAddFrom, startNewCart, addItem, setQuantity } = useCart();

  useEffect(() => {
    let cancelled = false;
    publicFetch<MenuResponse>(`/api/public/restaurants/${slug}`).then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function quantityFor(itemId: string): number {
    return cart.slug === slug ? cart.items.find((i) => i.menu_item_id === itemId)?.quantity || 0 : 0;
  }

  function handleAdd(item: MenuItem) {
    if (!data) return;
    if (!canAddFrom(slug)) {
      setPendingItem(item);
      return;
    }
    addItem(slug, data.restaurant.name, {
      menu_item_id: item.id,
      name: item.name,
      price_paise: item.price_paise,
      image_url: item.image_url,
    });
  }

  function confirmSwitch() {
    if (!data || !pendingItem) return;
    startNewCart(slug, data.restaurant.name);
    addItem(slug, data.restaurant.name, {
      menu_item_id: pendingItem.id,
      name: pendingItem.name,
      price_paise: pendingItem.price_paise,
      image_url: pendingItem.image_url,
    });
    setPendingItem(null);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-space-4 py-space-9 text-center">
        <p className="text-[14px] font-semibold text-ink-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px] px-space-4 py-space-6">
        <div className="h-[180px] animate-pulse rounded-lg bg-line/40" />
      </div>
    );
  }

  const { restaurant, categories } = data;

  return (
    <div>
      <div className="relative h-[180px] w-full bg-line/30 sm:h-[220px]">
        {restaurant.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-300">
            <UtensilsCrossed size={36} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      <div className="mx-auto max-w-[900px] px-space-4">
        <div className="-mt-space-6 mb-space-5 rounded-lg border border-line bg-card p-space-5 shadow-[var(--shadow-md)]">
          <div className="flex items-start justify-between gap-space-3">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-bold text-ink-900">{restaurant.name}</h1>
              {restaurant.tagline && <p className="text-[13px] text-ink-600">{restaurant.tagline}</p>}
              {restaurant.cuisines.length > 0 && (
                <p className="mt-space-1 text-[12.5px] text-ink-500">{restaurant.cuisines.join(", ")}</p>
              )}
            </div>
            <Badge tone={restaurant.is_open ? "success" : "neutral"}>{restaurant.is_open ? "Open" : "Closed"}</Badge>
          </div>
          <div className="mt-space-3 flex flex-wrap gap-space-4 text-[12.5px] text-ink-600">
            <span className="flex items-center gap-1">
              <Clock size={14} /> ~{restaurant.avg_prep_minutes} min
            </span>
            {restaurant.address_line && (
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {restaurant.address_line}
              </span>
            )}
            {restaurant.min_order_paise > 0 && <span>Min. order {rupees(restaurant.min_order_paise)}</span>}
          </div>
        </div>

        {!restaurant.is_open && (
          <div className="mb-space-5 rounded-lg border border-warning/40 bg-warning-tint p-space-3 text-[13px] font-medium text-warning">
            This restaurant is closed right now -- you can browse the menu, but ordering opens when they&apos;re back.
          </div>
        )}

        {categories.length === 0 && <p className="py-space-8 text-center text-[13.5px] text-ink-400">No menu items yet.</p>}

        {categories.map((cat) => (
          <div key={cat.name} className="mb-space-6">
            <h2 className="mb-space-3 text-[16px] font-bold text-ink-900">{cat.name}</h2>
            <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
              {cat.items.map((item) => {
                const qty = quantityFor(item.id);
                const outOfStock = item.stock_count !== null && item.stock_count <= 0;
                return (
                  <div key={item.id} className="flex gap-space-3 rounded-lg border border-line bg-card p-space-3">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-[14px] font-semibold text-ink-900">
                        {item.name} {item.is_combo && <Badge tone="brand">Combo</Badge>}
                      </p>
                      {item.description && <p className="line-clamp-2 text-[12px] text-ink-500">{item.description}</p>}
                      <div className="mt-auto flex items-center justify-between pt-space-2">
                        <span className="text-[13.5px] font-bold text-ink-900">{rupees(item.price_paise)}</span>
                        {outOfStock ? (
                          <span className="text-[11.5px] font-semibold text-ink-400">Sold out</span>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAdd(item)}
                            disabled={!restaurant.is_open}
                            className="rounded-md border border-brand-300 bg-brand-50 px-space-3 py-1.5 text-[12.5px] font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="flex items-center gap-space-2 rounded-md border border-brand-300 bg-brand-50">
                            <button
                              type="button"
                              onClick={() => setQuantity(item.id, qty - 1)}
                              className="flex h-7 w-7 items-center justify-center text-brand-700"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-4 text-center text-[12.5px] font-bold text-brand-700">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQuantity(item.id, qty + 1)}
                              className="flex h-7 w-7 items-center justify-center text-brand-700"
                              aria-label="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pendingItem !== null}
        title="Start a new order?"
        message={`Your cart has items from ${cart.restaurantName}. Adding from ${restaurant.name} will clear it and start a new order.`}
        confirmLabel="Start new order"
        onConfirm={confirmSwitch}
        onCancel={() => setPendingItem(null)}
      />
    </div>
  );
}
