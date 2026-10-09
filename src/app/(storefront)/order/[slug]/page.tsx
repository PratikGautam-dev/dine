"use client";

// Re-skinned onto dine-client's menu-page visual language via OutletHeroCanvas/MenuSearchFilter/
// MenuGrid/StickyCheckoutBar (src/components/storefront/menu/*). Every piece of state, every
// handler, and the real GET /api/public/restaurants/:slug fetch below is unchanged from the
// previous version of this page -- only the JSX composition changed, plus a new `?branch=` query
// param read (home page's per-branch outlet cards link here with it) that pre-selects a branch
// without needing the branch-picker screen.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { publicFetch } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { OutletHeroCanvas } from "@/components/storefront/menu/OutletHeroCanvas";
import { MenuSearchFilter, type Chip } from "@/components/storefront/menu/MenuSearchFilter";
import { MenuGrid } from "@/components/storefront/menu/MenuGrid";
import { StickyCheckoutBar } from "@/components/storefront/menu/StickyCheckoutBar";
import { ALL, BESTSELLERS, categoryIcon, type Branch, type MenuItem, type MenuResponse } from "@/components/storefront/menu/types";

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
  const { cart, canAddFrom, startNewCart, addItem, setQuantity, setBranch, itemCount, subtotalPaise } = useCart();
  const [pickedBranch, setPickedBranch] = useState<Branch | null>(null);
  const [forceBranchPicker, setForceBranchPicker] = useState(false);
  // Read directly off window.location.search (not next/navigation's useSearchParams()), same
  // workaround src/app/(storefront)/order/login/page.tsx's own comment documents -- this
  // codebase already hit that exact "needs a <Suspense> boundary to statically prerender" build
  // break once and fixed it this way.
  const [branchParam, setBranchParam] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBranchParam(new URLSearchParams(window.location.search).get("branch"));
  }, []);
  const appliedBranchParam = useRef<string | null>(null);

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

  // `?branch=<slug-or-id>` from the home page's per-branch outlet cards: pre-select it once data
  // has loaded, same as tapping that branch on the picker screen would, so that screen is
  // skipped. Matches the readable slug first (every new link uses it); falls back to the opaque
  // id so an already-shared old-style link keeps working.
  useEffect(() => {
    if (!data || !branchParam || appliedBranchParam.current === branchParam) return;
    const match = data.restaurant.branches.find((b) => b.slug === branchParam || b.id === branchParam);
    if (match) {
      appliedBranchParam.current = branchParam;
      if (cart.slug !== slug) startNewCart(slug, data.restaurant.name);
      setBranch(match.id, match.name, match.slug);
      setPickedBranch(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, branchParam]);

  const allItems = useMemo(() => (data ? data.categories.flatMap((c) => c.items) : []), [data]);
  const bestsellers = useMemo(() => allItems.filter((i) => i.is_bestseller), [allItems]);
  const recommended = useMemo(() => allItems.filter((i) => !i.is_bestseller && i.image_url).slice(0, 8), [allItems]);
  const slides = useMemo(() => bestsellers.filter((i) => i.image_url).slice(0, 3), [bestsellers]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  function quantityFor(itemId: string): number {
    return cart.slug === slug ? cart.items.find((i) => i.menu_item_id === itemId)?.quantity || 0 : 0;
  }

  function handleAdd(item: MenuItem) {
    if (!data) return;
    if (!canAddFrom(slug)) {
      setPendingItem(item);
      return;
    }
    addItem(slug, data.restaurant.name, { menu_item_id: item.id, name: item.name, price_paise: item.price_paise, image_url: item.image_url });
  }

  function confirmSwitch() {
    if (!data || !pendingItem) return;
    startNewCart(slug, data.restaurant.name);
    addItem(slug, data.restaurant.name, { menu_item_id: pendingItem.id, name: pendingItem.name, price_paise: pendingItem.price_paise, image_url: pendingItem.image_url });
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
      <div className="mx-auto max-w-[900px] px-4 py-16 text-center">
        <span className="material-symbols-outlined mx-auto mb-3 block text-[32px] text-sf-text-muted">restaurant</span>
        <p className="font-sf-body text-[14px] font-semibold text-sf-on-surface">{error}</p>
        <Link href="/order" className="mt-3 inline-block font-sf-body text-[13px] font-semibold text-sf-primary hover:underline">
          Browse restaurants
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-5">
        <div className="h-14 animate-pulse rounded-full bg-sf-surface-container-low" />
        <div className="h-[200px] animate-pulse rounded-2xl bg-sf-surface-container-low" />
        <div className="h-[140px] animate-pulse rounded-2xl bg-sf-surface-container-low" />
      </div>
    );
  }

  const { restaurant, categories } = data;
  const cartBranchId = cart.slug === slug ? cart.branchId : null;
  const effectiveBranch = pickedBranch ?? (cartBranchId ? (restaurant.branches.find((b) => b.id === cartBranchId) ?? null) : null);
  const needsBranchPick = restaurant.branches.length > 1 && (effectiveBranch === null || forceBranchPicker) && !branchParam;

  function handleBranchPicked(b: Branch) {
    if (cart.slug !== slug) startNewCart(slug, restaurant.name);
    setBranch(b.id, b.name, b.slug);
    setPickedBranch(b);
    setForceBranchPicker(false);
  }

  if (needsBranchPick) {
    return (
      <div className="mx-auto max-w-[520px] px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sf-primary text-sf-on-primary">
            {restaurant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined">restaurant</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sf-body text-[16px] font-bold text-sf-on-surface">{restaurant.name}</p>
            <p className="font-sf-body text-[12.5px] text-sf-text-muted">Choose a location</p>
          </div>
        </div>
        <div className="space-y-2">
          {restaurant.branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBranchPicked(b)}
              className="flex w-full items-center gap-3 rounded-2xl border border-sf-border-divider bg-sf-surface p-4 text-left shadow-sm transition-colors hover:border-sf-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sf-primary-light text-sf-primary">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
              </span>
              <span className="min-w-0">
                <span className="block font-sf-body text-[14.5px] font-bold text-sf-on-surface">{b.name}</span>
                {(b.address_line || b.city) && (
                  <span className="block truncate font-sf-body text-[12.5px] text-sf-text-muted">
                    {[b.address_line, b.city].filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
              <span className="material-symbols-outlined ml-auto shrink-0 text-sf-text-muted">arrow_forward</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const closed = !restaurant.is_open;
  const search = query.trim().toLowerCase();
  const searchResults = search
    ? allItems.filter((i) => i.name.toLowerCase().includes(search) || (i.description || "").toLowerCase().includes(search))
    : [];
  const heroSlide = slides.length ? slides[slide % slides.length] : null;
  const heroImage = heroSlide?.image_url || restaurant.cover_image_url;

  const chips: Chip[] = [
    { key: ALL, label: "All", icon: "restaurant_menu" },
    ...(bestsellers.length ? [{ key: BESTSELLERS, label: "Bestsellers", icon: "local_fire_department" }] : []),
    ...categories.map((c) => ({ key: c.name, label: c.name, icon: categoryIcon(c.name) })),
  ];
  const visibleCategories = activeCat === ALL || activeCat === BESTSELLERS ? categories : categories.filter((c) => c.name === activeCat);

  return (
    <div className="pb-24">
      <OutletHeroCanvas
        restaurant={restaurant}
        closed={closed}
        effectiveBranch={effectiveBranch}
        onChangeBranch={() => setForceBranchPicker(true)}
        searching={searching}
        onToggleSearch={() => setSearching((v) => !v)}
        heroImage={heroImage}
        heroSlide={heroSlide}
        slides={slides}
        slide={slide}
        onSlideSelect={setSlide}
        onOrderNow={() => pickCategory(bestsellers.length ? BESTSELLERS : ALL)}
      />

      <MenuSearchFilter
        restaurantName={restaurant.name}
        searching={searching}
        query={query}
        onQueryChange={setQuery}
        showChips={!search}
        chips={chips}
        activeCat={activeCat}
        onPickCategory={pickCategory}
      />

      <div ref={menuRef} className="mx-auto max-w-7xl scroll-mt-4 space-y-6 px-4 py-6 sm:px-8">
        <MenuGrid
          search={search}
          searchResults={searchResults}
          bestsellers={bestsellers}
          recommended={recommended}
          visibleCategories={visibleCategories}
          activeCat={activeCat}
          categoriesEmpty={categories.length === 0}
          quantityFor={quantityFor}
          closed={closed}
          onAdd={handleAdd}
          onSetQuantity={setQuantity}
          onPickCategory={pickCategory}
          BESTSELLERS={BESTSELLERS}
          ALL={ALL}
        />
      </div>

      {cart.slug === slug && <StickyCheckoutBar itemCount={itemCount} subtotalPaise={subtotalPaise} />}

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
