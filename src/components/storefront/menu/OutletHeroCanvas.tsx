"use client";

// Ported from dine-client's components/menu/OutletHeroCanvas.tsx -- visual layout only (card
// shell, stats row, hero banner with auto-advancing slides). Every value rendered here is real
// data/handlers passed down from [slug]/page.tsx: no fake coupons, distance or review counts.
import Link from "next/link";
import { cn } from "@/lib/cn";
import { rupees } from "@/lib/foodOrders";
import type { Branch, MenuItem, Restaurant } from "./types";

type Props = {
  restaurant: Restaurant;
  closed: boolean;
  effectiveBranch: Branch | null;
  onChangeBranch: () => void;
  searching: boolean;
  onToggleSearch: () => void;
  heroImage: string | null;
  heroSlide: MenuItem | null;
  slides: MenuItem[];
  slide: number;
  onSlideSelect: (i: number) => void;
  onOrderNow: () => void;
};

function Avatar({ restaurant, size }: { restaurant: Restaurant; size: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sf-primary text-sf-on-primary shadow-sm"
      style={{ width: size, height: size }}
    >
      {restaurant.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={restaurant.logo_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: size * 0.5 }}>
          restaurant
        </span>
      )}
    </div>
  );
}

export function OutletHeroCanvas({
  restaurant,
  closed,
  effectiveBranch,
  onChangeBranch,
  searching,
  onToggleSearch,
  heroImage,
  heroSlide,
  slides,
  slide,
  onSlideSelect,
  onOrderNow,
}: Props) {
  return (
    <section className="relative w-full overflow-hidden bg-sf-surface-container-low pb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sf-primary-soft/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 -bottom-20 h-80 w-80 rounded-full bg-sf-surface-container-high/60 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-4 pt-4 sm:px-8">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1.5 font-sf-body text-xs text-sf-text-muted">
          <Link href="/order" className="hover:text-sf-primary transition-colors">
            Restaurants
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="truncate font-semibold text-sf-on-surface">{restaurant.name}</span>
        </nav>

        {/* Main outlet card */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-sf-border-divider/70 bg-sf-surface p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-4 md:flex-row md:items-center">
            <Avatar restaurant={restaurant} size={72} />

            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full font-sf-body text-xs font-bold uppercase tracking-wide",
                    closed ? "bg-sf-surface-container-high text-sf-text-muted" : "bg-sf-success-soft text-sf-veg-green",
                  )}
                >
                  {closed ? "Closed" : "Open now"}
                </span>
                {restaurant.cuisines.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="px-2.5 py-0.5 rounded-full bg-sf-primary-light text-sf-primary font-sf-body text-xs font-bold uppercase tracking-wide"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <h1 className="mb-1 truncate font-sf-headline text-2xl font-bold tracking-tight text-sf-on-surface sm:text-3xl">
                {restaurant.name}
              </h1>
              {(restaurant.tagline || restaurant.cuisines.length > 0) && (
                <p className="mb-2 truncate font-sf-body text-sm text-sf-text-body">
                  {restaurant.tagline || restaurant.cuisines.join(", ")}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sf-body text-xs text-sf-text-body">
                {restaurant.rating && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-sf-warning-soft px-2 py-0.5 font-bold text-sf-rating-amber">
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span className="font-bold text-sf-on-surface">
                      {restaurant.rating.average.toFixed(1)}
                    </span>
                    <span className="font-normal text-sf-text-muted">
                      ({restaurant.rating.count})
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sf-primary text-[16px]">
                    moped
                  </span>
                  <span className="font-medium text-sf-on-surface">
                    {restaurant.avg_prep_minutes}–{restaurant.avg_prep_minutes + 10} mins
                  </span>
                </div>

                {(restaurant.city || restaurant.address_line) && (
                  <>
                    <span className="text-sf-border-divider">•</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="material-symbols-outlined text-sf-primary text-[16px]">
                        near_me
                      </span>
                      <span className="truncate font-medium text-sf-on-surface">
                        {restaurant.city || restaurant.address_line}
                      </span>
                    </div>
                  </>
                )}

                {restaurant.min_order_paise > 0 && (
                  <>
                    <span className="hidden text-sf-border-divider sm:inline">•</span>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sf-text-muted text-[16px]">
                        payments
                      </span>
                      <span>Min. order {rupees(restaurant.min_order_paise)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search toggle */}
          <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={onToggleSearch}
              aria-label="Search menu"
              className="flex items-center gap-1.5 rounded-xl border border-sf-border-divider bg-sf-surface-container-low px-3.5 py-2 font-sf-body text-xs font-semibold text-sf-on-surface transition-colors hover:bg-sf-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px] text-sf-primary">
                {searching ? "close" : "search"}
              </span>
              <span>{searching ? "Close" : "Search menu"}</span>
            </button>
          </div>
        </div>

        {/* Branch row */}
        {effectiveBranch && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-sf-border-divider bg-sf-surface px-4 py-3">
            <span className="flex items-center gap-2 font-sf-body text-[13px] text-sf-text-body">
              <span className="material-symbols-outlined text-sf-primary text-[18px]">
                location_on
              </span>
              Ordering from{" "}
              <strong className="font-bold text-sf-on-surface">{effectiveBranch.name}</strong>
            </span>
            <button
              type="button"
              onClick={onChangeBranch}
              className="font-sf-body text-xs font-bold text-sf-primary hover:underline"
            >
              Change
            </button>
          </div>
        )}

        {/* Closed banner */}
        {closed && (
          <div className="mt-4 rounded-xl border border-sf-warning/40 bg-sf-warning-soft p-3 font-sf-body text-[13px] font-medium text-sf-on-surface">
            We&apos;re closed right now — you can browse the menu, and ordering opens when
            we&apos;re back.
          </div>
        )}

        {/* Hero banner */}
        {(heroSlide || restaurant.cover_image_url) && (
          <div className="relative mt-4 h-[200px] overflow-hidden rounded-2xl bg-sf-ink md:h-[280px]">
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
            <div className="relative flex h-full max-w-[65%] flex-col justify-center p-5 sm:p-8">
              <p className="mb-1 font-sf-body text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/80">
                {restaurant.name}
              </p>
              <h2 className="font-sf-headline text-2xl font-extrabold leading-tight text-white md:text-4xl">
                {restaurant.tagline || "Fresh, made-to-order favourites"}
              </h2>
              {heroSlide && (
                <p className="mt-1 font-sf-body text-[13px] text-white/85">
                  Relish our signature {heroSlide.name}
                </p>
              )}
              <button
                type="button"
                onClick={onOrderNow}
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-sf-primary px-4 py-2.5 font-sf-body text-sm font-bold text-sf-on-primary transition-colors hover:bg-sf-secondary"
              >
                Order Now
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
            {slides.length > 1 && (
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => onSlideSelect(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === slide % slides.length ? "w-5 bg-sf-primary" : "w-1.5 bg-white/60",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
