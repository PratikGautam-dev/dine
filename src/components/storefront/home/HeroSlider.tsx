"use client";

// Ported from dine-client's components/hero/HeroSlider.tsx. Purely decorative background
// slideshow + headline kept as-is (stock imagery, no real data involved); the search box and
// "location" trigger are rewired off real state instead of AppContext: `search`/`city` are the
// same filter state the /order page already fetches with, passed down as props, and the
// location trigger became a real city <select> (populated from the real `cities` list) instead
// of opening a fake LocationModal.
import { useEffect, useState } from "react";

const HERO_SLIDES = [
  {
    id: 1,
    title: "Wood-Fired Artisanal Chains",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCLQEUxKPcMc0isNFhJQJVJYuN2CUqjIqsA9eumSFxItWAP_fqBgb8VczD-3UnBGeDY6ZvgNW8yP86hBvSsx2Ac4fRjcqRvK3Y23h8w0MUxgFpD99HSG_kVRDnd2dG4cUY6idTpSFbLC9EGo9OzKeSxTtOvhzghCEKgeaxNVutl7jzUQHzi670nRTg1NnWrIwemCfvp6_sCRpyzn1BzE3ehg8oOo_T6vfAV5_G_FEg",
    alt: "Wood-fired artisanal sourdough pizza being baked in a fiery rustic brick oven",
  },
  {
    id: 2,
    title: "Authentic Regional Kitchens",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCNYW-7d6AgV1W3yAoMRnfxgH7EhEJMTv0k_kr1s77Af2t7vvxm7T9b6OUITn_8YPyB12cdYHCFRQN3UzTVctxhVwNX_poMfPWo3xKTe5kj5qYfXMObVLlL-WeM4m_Xbc1IpI6vNicW0kNBeRf-4BN9IMRHdSkeFVLFRXx5ovXlWDhf7Knj2ak20F7rnlaCtt20VoEV0fKep6Bhije_JsNW-2hHPXKylJuFTc3myxk",
    alt: "Authentic Dum Handi Biryani with fragrant basmati and rich slow-cooked spices",
  },
  {
    id: 3,
    title: "Craft Cafes & Bakeries",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBokphelqLpLBB2c9OaEwun4nFq8lk2gg0OcphIu9311FgNGZkGRu2xh4-P2FWJuNbOLsWdK8zBAesmGKtZSSV8gHBVasGZlRZHPUjYzwAX9oDT0xt94zbt44s5a7OH185p5L9PyRPt1wvFnZ20Rg1JFb8S8T0a1Js-DfzqNgxEwOoBxbah5_rZBDwtBlCR9jAUkBYLzGesM42jc0l3YRSfX4ryliVBelY_fs-lOSk",
    alt: "Specialty cafe brews and fresh croissants in warm bakery ambience",
  },
];

const TRENDING_KEYWORDS = ["Pizza", "Biryani", "Burger", "Coffee"];

type HeroSliderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  city: string;
  cities: string[];
  onCityChange: (value: string) => void;
  /** id of the real listings section (ClosestOutlets) to scroll to -- replaces dine-client's
   * fake "chains-section" anchor. */
  listingsSectionId: string;
};

export function HeroSlider({
  search,
  onSearchChange,
  city,
  cities,
  onCityChange,
  listingsSectionId,
}: HeroSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleExplore = () => {
    document.getElementById(listingsSectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative w-full overflow-hidden bg-sf-ink text-sf-on-primary py-12 lg:py-16 min-h-[580px] lg:min-h-[640px] flex items-center justify-center border-b border-sf-border-divider/60">
      <div className="absolute inset-0 z-0 overflow-hidden">
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="w-full h-full object-cover" src={slide.image} alt={slide.alt} />
            <div className="absolute inset-0 bg-gradient-to-t from-sf-ink via-sf-ink/75 to-sf-ink/60 backdrop-blur-[1px]" />
          </div>
        ))}
      </div>

      <button
        aria-label="Previous slide"
        type="button"
        onClick={prevSlide}
        className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-sf-surface/20 hover:bg-sf-surface text-sf-on-primary hover:text-sf-on-surface backdrop-blur-md border border-sf-surface/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
      >
        <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
      </button>

      <button
        aria-label="Next slide"
        type="button"
        onClick={nextSlide}
        className="absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-sf-surface/20 hover:bg-sf-surface text-sf-on-primary hover:text-sf-on-surface backdrop-blur-md border border-sf-surface/20 flex items-center justify-center transition-all shadow-lg cursor-pointer"
      >
        <span className="material-symbols-outlined text-[24px]">arrow_forward_ios</span>
      </button>

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-8 text-center flex flex-col items-center py-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-sf-surface/10 backdrop-blur-md px-4 py-1.5 mb-4 border border-sf-surface/20 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-sf-veg-green animate-pulse" />
          <span className="font-sf-body text-xs text-sf-on-primary font-bold tracking-wide uppercase">
            Direct Restaurant Kitchen Routing
          </span>
          <span className="text-sf-on-primary/40 font-bold">•</span>
          <span className="font-sf-body text-xs text-sf-on-primary font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-sf-primary-container">bolt</span>
            Fresh, made-to-order favourites
          </span>
        </div>

        <h1 className="font-sf-headline text-3xl sm:text-4xl lg:text-5xl text-sf-on-primary tracking-tight font-extrabold leading-[1.15] max-w-3xl">
          Your favourite restaurants,{" "}
          <span className="text-sf-primary-container font-black underline decoration-sf-primary-soft decoration-4 underline-offset-4">
            ordered straight to the kitchen
          </span>
          .
        </h1>

        <p className="font-sf-body text-base sm:text-lg text-sf-on-primary/90 mt-3 max-w-2xl leading-relaxed text-center font-normal">
          Daap Dine connects you directly with real restaurant kitchens near you -- no middleman
          menus, no stale listings.
        </p>

        <div className="mt-6 w-full max-w-2xl rounded-2xl bg-sf-surface p-2 shadow-2xl border border-sf-surface/20 text-sf-on-surface text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2 shrink-0 rounded-xl bg-sf-surface-container-low px-3.5 py-2.5 text-sf-on-surface w-full sm:w-auto">
              <span
                className="material-symbols-outlined text-[18px] text-sf-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                my_location
              </span>
              <div className="text-left leading-none">
                <span className="block font-sf-body text-[11px] text-sf-text-muted font-medium">
                  City
                </span>
                <select
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  className="font-sf-body text-xs font-bold truncate max-w-[130px] bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="">All cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative flex-1 w-full flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[20px] text-sf-text-muted">
                search
              </span>
              <input
                className="w-full bg-transparent pl-10 pr-3 py-2 font-sf-body text-sm text-sf-on-surface placeholder:text-sf-text-muted focus:outline-none"
                placeholder="Search restaurants or cuisines..."
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            <button
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
              type="button"
              onClick={handleExplore}
            >
              <span>Explore Menu</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="font-sf-body text-xs text-sf-on-primary/70 font-semibold">Trending:</span>
          {TRENDING_KEYWORDS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSearchChange(tag)}
              className="rounded-full bg-sf-surface/10 backdrop-blur-md px-3 py-1 font-sf-body text-xs text-sf-on-primary hover:text-sf-on-primary hover:bg-sf-primary border border-sf-surface/20 transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-sf-surface/10 w-full max-w-xl flex items-center justify-center gap-6 sm:gap-8 text-sf-on-primary/90">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sf-veg-green text-[22px]">verified</span>
            <div className="text-left">
              <span className="block font-sf-body text-sm font-bold text-sf-on-primary">
                Real Restaurants
              </span>
              <span className="font-sf-body text-[12px] text-sf-on-primary/70">
                Live menus, straight from the kitchen
              </span>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-sf-surface/20" />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sf-primary-container text-[22px]">radar</span>
            <div className="text-left">
              <span className="block font-sf-body text-sm font-bold text-sf-on-primary">
                Local Discovery
              </span>
              <span className="font-sf-body text-[12px] text-sf-on-primary/70">
                Filter by city to find what&apos;s open
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-sf-surface/10 backdrop-blur-md px-3 py-1.5 border border-sf-surface/20 shadow-md">
        {HERO_SLIDES.map((slide, idx) => {
          const isActive = idx === currentSlide;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-sf-body text-[11px] transition-all cursor-pointer ${
                isActive
                  ? "bg-sf-primary text-sf-on-primary font-bold shadow-sm"
                  : "text-sf-on-primary/80 hover:text-sf-on-primary font-medium"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-sf-surface" : "bg-sf-surface/40"}`} />
              <span>
                {idx + 1} / {HERO_SLIDES.length} - {slide.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
