"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Bike,
  ChefHat,
  ConciergeBell,
  CupSoda,
  Drumstick,
  Flame,
  IceCreamCone,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Soup,
  Star,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { publicFetch } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/foodOrders";

type Branch = { id: string; name: string; address_line: string | null; city: string | null };

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
  rating: { average: number; count: number } | null;
  // Multi-branch (migration 0053): empty for every single-branch restaurant (today's behavior,
  // unchanged) -- only a real array once that restaurant has multi-branch on with 2+ locations.
  branches: Branch[];
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
  is_bestseller: boolean;
};

type Category = { name: string; items: MenuItem[] };
type MenuResponse = { restaurant: Restaurant; categories: Category[]; bestseller_ids: string[] };

const BESTSELLERS = "__bestsellers__";
const ALL = "__all__";

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (/bever|drink|lassi|juice|shake|soda|tea|coffee/.test(n)) return CupSoda;
  if (/dessert|sweet|ice/.test(n)) return IceCreamCone;
  if (/bread|naan|roti|kulcha/.test(n)) return Wheat;
  if (/starter|snack|tandoor|kebab|tikka/.test(n)) return Drumstick;
  if (/main|curry|biryani|rice|gravy|thali|combo/.test(n)) return Soup;
  return UtensilsCrossed;
}

function Avatar({ restaurant, size }: { restaurant: Restaurant; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-white shadow-[var(--shadow-sm)]"
      style={{ width: size, height: size }}
    >
      {restaurant.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={restaurant.logo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <ConciergeBell size={size * 0.5} />
      )}
    </div>
  );
}

export default function RestaurantMenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<MenuResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const { cart, canAddFrom, startNewCart, addItem, setQuantity, setBranch, itemCount } = useCart();
  // Multi-branch (migration 0053): the branch picker's own local "haven't picked yet" state --
  // separate from cart.branchId, which only applies once the cart actually belongs to this
  // restaurant (canAddFrom(slug)).
  const [pickedBranch, setPickedBranch] = useState<Branch | null>(null);
  const [forceBranchPicker, setForceBranchPicker] = useState(false);

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

  const allItems = useMemo(() => (data ? data.categories.flatMap((c) => c.items) : []), [data]);
  const bestsellers = useMemo(() => allItems.filter((i) => i.is_bestseller), [allItems]);
  const recommended = useMemo(
    () => allItems.filter((i) => !i.is_bestseller && i.image_url).slice(0, 8),
    [allItems],
  );
  const slides = useMemo(() => {
    const withPhotos = bestsellers.filter((i) => i.image_url).slice(0, 3);
    return withPhotos.length ? withPhotos : [];
  }, [bestsellers]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  function quantityFor(itemId: string): number {
    return cart.slug === slug
      ? cart.items.find((i) => i.menu_item_id === itemId)?.quantity || 0
      : 0;
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

  function pickCategory(key: string) {
    setActiveCat(key);
    setQuery("");
    setSearching(false);
    menuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-space-4 py-space-9 text-center">
        <UtensilsCrossed size={32} className="mx-auto mb-space-3 text-ink-300" />
        <p className="text-[14px] font-semibold text-ink-600">{error}</p>
        <Link
          href="/order"
          className="mt-space-3 inline-block text-[13px] font-semibold text-brand-600 hover:underline"
        >
          Browse restaurants
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px] space-y-space-4 px-space-4 py-space-5">
        <div className="h-14 animate-pulse rounded-full bg-line/40" />
        <div className="h-[200px] animate-pulse rounded-2xl bg-line/40" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-line/40" />
      </div>
    );
  }

  const { restaurant, categories } = data;

  // Multi-branch (migration 0053): a real choice only when this restaurant has more than one
  // active branch -- restaurant.branches is empty otherwise, so this whole block is inert and
  // the page behaves exactly as it did before this feature existed.
  const cartBranchId = cart.slug === slug ? cart.branchId : null;
  const effectiveBranch =
    pickedBranch ??
    (cartBranchId ? (restaurant.branches.find((b) => b.id === cartBranchId) ?? null) : null);
  const needsBranchPick =
    restaurant.branches.length > 1 && (effectiveBranch === null || forceBranchPicker);

  function handleBranchPicked(b: Branch) {
    if (cart.slug !== slug) startNewCart(slug, restaurant.name);
    setBranch(b.id, b.name);
    setPickedBranch(b);
    setForceBranchPicker(false);
  }

  if (needsBranchPick) {
    return (
      <div className="mx-auto max-w-[520px] px-space-4 py-space-8">
        <div className="mb-space-6 flex items-center gap-space-3">
          <Avatar restaurant={restaurant} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold text-ink-900">{restaurant.name}</p>
            <p className="text-[12.5px] text-ink-600">Choose a location</p>
          </div>
        </div>
        <div className="space-y-space-2">
          {restaurant.branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBranchPicked(b)}
              className="flex w-full items-center gap-space-3 rounded-2xl border border-line bg-card p-space-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-brand-400"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <MapPin size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-ink-900">{b.name}</span>
                {(b.address_line || b.city) && (
                  <span className="block truncate text-[12.5px] text-ink-600">
                    {[b.address_line, b.city].filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              <ArrowRight size={16} className="ml-auto shrink-0 text-ink-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const closed = !restaurant.is_open;
  const search = query.trim().toLowerCase();
  const searchResults = search
    ? allItems.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          (i.description || "").toLowerCase().includes(search),
      )
    : [];
  const heroSlide = slides.length ? slides[slide % slides.length] : null;
  const heroImage = heroSlide?.image_url || restaurant.cover_image_url;

  function Stepper({ item, compact = false }: { item: MenuItem; compact?: boolean }) {
    const qty = quantityFor(item.id);
    const soldOut = item.stock_count !== null && item.stock_count <= 0;
    if (soldOut) return <span className="text-[11.5px] font-semibold text-ink-400">Sold out</span>;
    if (qty === 0) {
      return compact ? (
        <button
          type="button"
          onClick={() => handleAdd(item)}
          disabled={closed}
          aria-label={`Add ${item.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-500 text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleAdd(item)}
          disabled={closed}
          className="inline-flex items-center gap-1 rounded-full border border-brand-500 px-space-4 py-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add <Plus size={14} />
        </button>
      );
    }
    return (
      <div className="inline-flex items-center rounded-full bg-brand-600 text-white">
        <button
          type="button"
          onClick={() => setQuantity(item.id, qty - 1)}
          aria-label="Decrease quantity"
          className="flex h-8 w-8 items-center justify-center"
        >
          <Minus size={14} />
        </button>
        <span className="w-4 text-center text-[13px] font-bold">{qty}</span>
        <button
          type="button"
          onClick={() => setQuantity(item.id, qty + 1)}
          aria-label="Increase quantity"
          className="flex h-8 w-8 items-center justify-center"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  function Photo({ item, className }: { item: MenuItem; className?: string }) {
    return item.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.image_url} alt="" className={cn("object-cover", className)} />
    ) : (
      <div className={cn("flex items-center justify-center bg-brand-50 text-brand-300", className)}>
        <UtensilsCrossed size={24} />
      </div>
    );
  }

  function BigCard({ item }: { item: MenuItem }) {
    return (
      <div className="flex w-[210px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-sm)]">
        <Photo item={item} className="h-[130px] w-full" />
        <div className="flex flex-1 flex-col p-space-3">
          <p className="line-clamp-2 text-[14.5px] leading-snug font-bold text-ink-900">
            {item.name}{" "}
            {item.is_combo && (
              <span className="ml-1 rounded-full bg-accent-violet-tint px-2 py-0.5 text-[10px] font-bold text-accent-violet uppercase">
                Combo
              </span>
            )}
          </p>
          <p className="mt-1 text-[15px] font-extrabold text-ink-900">{rupees(item.price_paise)}</p>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[12px] text-ink-500">{item.description}</p>
          )}
          <div className="mt-auto flex justify-end pt-space-3">
            <Stepper item={item} />
          </div>
        </div>
      </div>
    );
  }

  function Tile({ item }: { item: MenuItem }) {
    return (
      <div className="w-[128px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-sm)]">
        <Photo item={item} className="h-[92px] w-full" />
        <div className="p-space-2">
          <p className="truncate text-[13px] font-bold text-ink-900">{item.name}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-ink-900">
              {rupees(item.price_paise)}
            </span>
            <Stepper item={item} compact />
          </div>
        </div>
      </div>
    );
  }

  function Row({ item }: { item: MenuItem }) {
    return (
      <div className="flex gap-space-3 rounded-2xl border border-line bg-card p-space-3 shadow-[var(--shadow-sm)]">
        <Photo item={item} className="h-[88px] w-[88px] shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[14.5px] font-bold text-ink-900">
            {item.name}{" "}
            {item.is_combo && (
              <span className="ml-1 rounded-full bg-accent-violet-tint px-2 py-0.5 text-[10px] font-bold text-accent-violet uppercase">
                Combo
              </span>
            )}
          </p>
          {item.description && (
            <p className="line-clamp-2 text-[12px] text-ink-500">{item.description}</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-space-2">
            <span className="text-[15px] font-extrabold text-ink-900">
              {rupees(item.price_paise)}
            </span>
            <Stepper item={item} />
          </div>
        </div>
      </div>
    );
  }

  const chips: { key: string; label: string; icon: typeof Flame }[] = [
    { key: ALL, label: "All", icon: ChefHat },
    ...(bestsellers.length ? [{ key: BESTSELLERS, label: "Bestsellers", icon: Flame }] : []),
    ...categories.map((c) => ({ key: c.name, label: c.name, icon: categoryIcon(c.name) })),
  ];

  const visibleCategories =
    activeCat === ALL || activeCat === BESTSELLERS
      ? categories
      : categories.filter((c) => c.name === activeCat);

  return (
    <div className="mx-auto max-w-[900px] pb-space-8">
      <header className="flex items-center gap-space-3 px-space-4 pt-space-4 pb-space-3">
        <Avatar restaurant={restaurant} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[22px] leading-tight font-extrabold text-ink-900">
            {restaurant.name}
          </h1>
          <p className="truncate text-[13px] text-ink-500">
            {restaurant.tagline || restaurant.cuisines.join(", ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          aria-label="Search menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-black/5"
        >
          {searching ? <X size={22} /> : <Search size={22} />}
        </button>
        <Link
          href="/order/cart"
          aria-label="Cart"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-black/5"
        >
          <ShoppingBag size={22} />
          {itemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10.5px] font-bold text-white">
              {itemCount}
            </span>
          )}
        </Link>
      </header>

      {searching && (
        <div className="px-space-4 pb-space-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${restaurant.name}'s menu`}
              className="h-11 w-full rounded-full border border-line bg-card pr-space-4 pl-9 text-[14px] text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-space-3 overflow-x-auto px-space-4 pb-space-4 text-[12.5px] whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-space-3 py-2 font-bold",
            closed ? "bg-black/5 text-ink-600" : "bg-success-tint text-success",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", closed ? "bg-ink-400" : "bg-success")} />{" "}
          {closed ? "Closed" : "Open"}
        </span>
        <div className="flex items-center gap-2 border-l border-line pl-space-3">
          <Bike size={22} className="text-ink-900" />
          <div>
            <p className="font-bold text-ink-900">
              {restaurant.avg_prep_minutes}–{restaurant.avg_prep_minutes + 10} mins
            </p>
            <p className="text-ink-500">Delivery time</p>
          </div>
        </div>
        {restaurant.rating && (
          <div className="flex items-center gap-2 border-l border-line pl-space-3">
            <Star size={22} className="fill-warning text-warning" />
            <div>
              <p className="font-bold text-ink-900">
                {restaurant.rating.average.toFixed(1)}{" "}
                <span className="font-normal text-ink-500">({restaurant.rating.count})</span>
              </p>
              <p className="text-ink-500">Ratings</p>
            </div>
          </div>
        )}
        {(restaurant.city || restaurant.address_line) && (
          <div className="flex items-center gap-2 border-l border-line pl-space-3">
            <MapPin size={22} className="text-brand-600" />
            <div>
              <p className="font-bold text-ink-900">{restaurant.city || restaurant.address_line}</p>
              <p className="max-w-[160px] truncate text-ink-500">
                {restaurant.city && restaurant.address_line
                  ? restaurant.address_line
                  : restaurant.min_order_paise > 0
                    ? `Min. order ${rupees(restaurant.min_order_paise)}`
                    : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {restaurant.branches.length > 1 && effectiveBranch && (
        <div className="mx-space-4 mb-space-4 flex items-center justify-between rounded-2xl border border-line bg-card px-space-4 py-space-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-700">
            <MapPin size={16} className="text-brand-600" />
            Ordering from <strong className="font-bold text-ink-900">{effectiveBranch.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => setForceBranchPicker(true)}
            className="text-[12.5px] font-semibold text-brand-600 hover:underline"
          >
            Change
          </button>
        </div>
      )}

      {closed && (
        <div className="mx-space-4 mb-space-4 rounded-2xl border border-warning/40 bg-warning-tint p-space-3 text-[13px] font-medium text-warning">
          We&apos;re closed right now — you can browse the menu, and ordering opens when we&apos;re
          back.
        </div>
      )}

      {!search && (heroSlide || restaurant.cover_image_url) && (
        <div className="px-space-4">
          <div className="relative h-[200px] overflow-hidden rounded-2xl bg-ink-900 md:h-[260px]">
            {heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={heroImage}
                src={heroImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
            <div className="relative flex h-full max-w-[65%] flex-col justify-center p-space-5">
              <p className="mb-1 text-[10.5px] font-bold tracking-[0.2em] text-white/80 uppercase">
                {restaurant.name}
              </p>
              <h2 className="font-display text-[24px] leading-tight font-extrabold text-white md:text-[32px]">
                {restaurant.tagline || "Fresh, made-to-order favourites"}
              </h2>
              {heroSlide && (
                <p className="mt-1 text-[13px] text-white/85">
                  Relish our signature {heroSlide.name}
                </p>
              )}
              <button
                type="button"
                onClick={() => pickCategory(bestsellers.length ? BESTSELLERS : ALL)}
                className="mt-space-3 inline-flex w-fit items-center gap-2 rounded-lg bg-brand-600 px-space-4 py-2.5 text-[14px] font-bold text-white hover:bg-brand-700"
              >
                Order Now <ArrowRight size={16} />
              </button>
            </div>
            {slides.length > 1 && (
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === slide % slides.length ? "w-5 bg-brand-500" : "w-1.5 bg-white/60",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!search && (
        <div className="flex gap-space-4 overflow-x-auto px-space-4 py-space-5">
          {chips.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => pickCategory(key)}
              className="flex w-[74px] shrink-0 flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "flex h-[62px] w-[62px] items-center justify-center rounded-full transition-colors",
                  activeCat === key ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
                )}
              >
                <Icon size={26} />
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[12.5px] font-semibold",
                  activeCat === key ? "text-ink-900" : "text-ink-500",
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "h-0.5 w-8 rounded-full",
                  activeCat === key ? "bg-brand-600" : "bg-transparent",
                )}
              />
            </button>
          ))}
        </div>
      )}

      <div ref={menuRef} className="scroll-mt-4 space-y-space-6 px-space-4">
        {search ? (
          <section>
            <h2 className="mb-space-3 text-[18px] font-extrabold text-ink-900">
              Results for “{query.trim()}”
            </h2>
            {searchResults.length === 0 ? (
              <p className="py-space-6 text-center text-[13.5px] text-ink-400">
                Nothing matches that. Try another dish.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-space-3 md:grid-cols-2">
                {searchResults.map((i) => (
                  <Row key={i.id} item={i} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {(activeCat === ALL || activeCat === BESTSELLERS) && bestsellers.length > 0 && (
              <section>
                <div className="mb-space-3 flex items-center justify-between">
                  <h2 className="text-[20px] font-extrabold text-ink-900">Bestsellers</h2>
                  {activeCat === ALL && (
                    <button
                      type="button"
                      onClick={() => pickCategory(BESTSELLERS)}
                      className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-600"
                    >
                      See all <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                {activeCat === BESTSELLERS ? (
                  <div className="grid grid-cols-1 gap-space-3 md:grid-cols-2">
                    {bestsellers.map((i) => (
                      <Row key={i.id} item={i} />
                    ))}
                  </div>
                ) : (
                  <div className="-mx-space-4 flex snap-x gap-space-3 overflow-x-auto px-space-4 pb-1">
                    {bestsellers.map((i) => (
                      <BigCard key={i.id} item={i} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeCat === ALL && recommended.length > 0 && (
              <section>
                <h2 className="mb-space-3 text-[20px] font-extrabold text-ink-900">
                  Recommended for you
                </h2>
                <div className="-mx-space-4 flex snap-x gap-space-3 overflow-x-auto px-space-4 pb-1">
                  {recommended.map((i) => (
                    <Tile key={i.id} item={i} />
                  ))}
                </div>
              </section>
            )}

            {activeCat !== BESTSELLERS &&
              visibleCategories.map((cat) => (
                <section key={cat.name}>
                  <h2 className="mb-space-3 text-[20px] font-extrabold text-ink-900">{cat.name}</h2>
                  <div className="grid grid-cols-1 gap-space-3 md:grid-cols-2">
                    {cat.items.map((i) => (
                      <Row key={i.id} item={i} />
                    ))}
                  </div>
                </section>
              ))}

            {categories.length === 0 && (
              <p className="py-space-8 text-center text-[13.5px] text-ink-400">
                No menu items yet.
              </p>
            )}
          </>
        )}
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
