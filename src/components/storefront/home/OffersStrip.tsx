"use client";

// Ported from dine-client's components/offers/OffersStrip.tsx. Fully decorative -- there is no
// real coupons/promos backend in dine-connect, so the "Apply"/"Applied" toggle is local
// component state only (no AppContext appliedCoupon, no real discount is ever applied to an
// order). Kept purely as marketing flavor matching the rest of the ported design.
import { useState } from "react";

const OFFERS = [
  {
    id: "DAAP50",
    tag: "Flash Deal",
    title: "FLAT 50% OFF",
    subtitle: "Save on your first order from a new restaurant",
    code: "DAAP50",
    gradient: "from-sf-primary to-sf-primary-container",
    icon: "percent",
  },
  {
    id: "FREESHIP",
    tag: "Zero Surge",
    title: "FREE DELIVERY",
    subtitle: "On orders above the restaurant's minimum",
    code: "FREESHIP",
    gradient: "from-sf-secondary to-sf-secondary-container",
    icon: "moped",
  },
  {
    id: "GOURMET150",
    tag: "Gourmet Feast",
    title: "EXTRA OFF COMBOS",
    subtitle: "On your favorite combos & platters",
    code: "GOURMET150",
    gradient: "from-sf-tertiary to-sf-tertiary-container",
    icon: "redeem",
  },
];

export function OffersStrip() {
  const [appliedCode, setAppliedCode] = useState<string | null>(null);

  return (
    <section id="offers-section" className="w-full bg-sf-bg-page py-8 sm:py-10 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-sf-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_offer
            </span>
            <h2 className="font-sf-headline text-xl sm:text-2xl text-sf-on-surface font-bold">
              Exclusive Offers
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OFFERS.map((offer) => {
            const isApplied = appliedCode === offer.code;

            return (
              <div
                key={offer.id}
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${offer.gradient} p-5 text-sf-on-primary shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-[160px]`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="rounded bg-sf-surface/20 px-2 py-0.5 font-sf-body text-[11px] font-bold uppercase tracking-wider text-sf-on-primary">
                      {offer.tag}
                    </span>
                    <h3 className="font-sf-headline text-xl sm:text-2xl font-extrabold mt-2 leading-tight">
                      {offer.title}
                    </h3>
                    <p className="font-sf-body text-xs opacity-90 mt-0.5">{offer.subtitle}</p>
                  </div>
                  <span className="material-symbols-outlined text-sf-on-primary/30 text-5xl select-none">
                    {offer.icon}
                  </span>
                </div>

                <div className="mt-4 pt-1 flex items-center justify-between">
                  <div className="rounded-lg bg-sf-surface/10 px-3 py-1.5 font-sf-body text-xs font-mono tracking-wider font-bold">
                    CODE: {offer.code}
                  </div>
                  <button
                    className={`rounded-full px-4 py-1.5 font-sf-body text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      isApplied
                        ? "bg-sf-veg-green text-sf-on-primary hover:bg-sf-veg-green/90"
                        : "bg-sf-surface text-sf-primary hover:bg-sf-surface/90"
                    }`}
                    type="button"
                    onClick={() => setAppliedCode(isApplied ? null : offer.code)}
                  >
                    {isApplied ? "Applied ✓" : "Apply"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
