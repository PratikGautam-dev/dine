"use client";

// Ported from dine-client's components/outlets/ClosestOutlets.tsx -- this is the home page's
// main REAL listing. dine-client showed 3 fake "closest" outlets with invented distance/eta;
// there is no geolocation or distance field anywhere in the real data model, so this renders
// every flattened Outlet (one card per active branch) with only real fields: branchLabel,
// addressLine/city, cuisines, rating (or a "New" badge when null), isOpen, and avgPrepMinutes as
// "~N min" instead of a fake eta range. `OutletCard` is exported so TopRatedDishes can reuse the
// exact same card in its horizontal "top rated restaurants" rail.
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Outlet } from "@/components/storefront/types";

export function OutletCard({ outlet, className }: { outlet: Outlet; className?: string }) {
  const href = outlet.branchId
    ? `/order/${outlet.slug}?branch=${outlet.branchSlug ?? outlet.branchId}`
    : `/order/${outlet.slug}`;
  const image = outlet.coverImageUrl || outlet.logoUrl;
  const addressParts = [outlet.addressLine, outlet.city].filter(Boolean);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-2xl bg-sf-surface p-0 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col border border-sf-border-divider/70 hover:border-sf-primary/40 overflow-hidden",
        className,
      )}
    >
      <div className="relative h-36 w-full bg-sf-surface-container-low shrink-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={image} alt={outlet.name} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sf-text-muted">
            <span className="material-symbols-outlined text-[36px]">restaurant</span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5">
          {outlet.isOpen ? (
            <span className="rounded bg-sf-veg-green/10 text-sf-veg-green px-2 py-0.5 font-sf-body text-xs font-bold inline-flex items-center gap-1 backdrop-blur-sm bg-sf-surface/70">
              <span className="h-1.5 w-1.5 rounded-full bg-sf-veg-green" /> Open Now
            </span>
          ) : (
            <span className="rounded bg-sf-surface/80 text-sf-text-muted px-2 py-0.5 font-sf-body text-xs font-bold">
              Closed
            </span>
          )}
        </div>

        <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-sf-surface text-sf-on-surface px-2.5 py-1 font-sf-body text-xs font-extrabold shadow-md flex items-center gap-1">
          {outlet.rating ? (
            <>
              <span
                className="material-symbols-outlined text-[14px] text-sf-rating-amber"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <span>
                {outlet.rating.average.toFixed(1)} ({outlet.rating.count})
              </span>
            </>
          ) : (
            <span className="text-sf-primary">New</span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-sf-headline text-lg text-sf-on-surface font-bold leading-snug truncate">
          {outlet.name}
        </h3>
        {outlet.branchLabel && (
          <p className="font-sf-body text-xs text-sf-primary font-semibold mt-0.5 truncate">
            {outlet.branchLabel}
          </p>
        )}
        {addressParts.length > 0 && (
          <p className="font-sf-body text-xs text-sf-text-muted mt-0.5 truncate">
            {addressParts.join(", ")}
          </p>
        )}
        {outlet.cuisines.length > 0 && (
          <p className="font-sf-body text-xs text-sf-text-body mt-1.5 truncate">
            {outlet.cuisines.join(" • ")}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          {outlet.avgPrepMinutes != null ? (
            <span className="flex items-center gap-1 font-sf-body text-xs text-sf-text-muted">
              <span className="material-symbols-outlined text-[16px] text-sf-primary">schedule</span>
              ~{outlet.avgPrepMinutes} min
            </span>
          ) : (
            <span />
          )}
          <span className="font-sf-body text-xs font-bold text-sf-primary">View menu →</span>
        </div>
      </div>
    </Link>
  );
}

type ClosestOutletsProps = {
  outlets: Outlet[];
  sectionId: string;
};

export function ClosestOutlets({ outlets, sectionId }: ClosestOutletsProps) {
  return (
    <section
      id={sectionId}
      className="w-full bg-sf-surface-container-low/50 py-12 px-4 sm:px-8 border-b border-sf-border-divider/40"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sf-primary-light px-3 py-1 text-sf-primary mb-1">
              <span className="material-symbols-outlined text-[16px]">fmd_good</span>
              <span className="font-sf-body text-xs font-bold">Open For Orders</span>
            </div>
            <h2 className="font-sf-headline text-2xl sm:text-3xl text-sf-on-surface font-bold">
              Browse All Restaurants
            </h2>
          </div>

          <span className="rounded-lg bg-sf-surface px-3 py-1.5 font-sf-body text-xs font-bold text-sf-on-surface shadow-sm border border-sf-border-divider/60">
            {outlets.length} {outlets.length === 1 ? "outlet" : "outlets"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outlets.map((outlet) => (
            <OutletCard key={outlet.cardKey} outlet={outlet} />
          ))}
        </div>
      </div>
    </section>
  );
}
