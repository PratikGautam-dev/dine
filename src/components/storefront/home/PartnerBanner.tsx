"use client";

// Ported from dine-client's components/partner/PartnerBanner.tsx -- fully decorative marketing
// banner. dine-client's buttons called a fake global `showToast`; there is no restaurant-partner
// signup flow anywhere in dine-connect, so the primary CTA just toggles local "submitted" state
// (no network call, purely decorative) and the secondary CTA is non-interactive decorative
// content since its original target (an enterprise demo scheduler) doesn't exist here.
import { useState } from "react";

export function PartnerBanner() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="w-full bg-sf-surface py-12 sm:py-16 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-sf-primary-light p-6 sm:p-10 lg:p-12 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-8 border border-sf-primary-soft/50">
          <div className="max-w-2xl text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-sf-surface px-3 py-1 text-sf-primary font-sf-body text-xs font-bold mb-3 shadow-sm">
              <span className="material-symbols-outlined text-[16px]">corporate_fare</span>
              <span>Daap Dine Partner Network</span>
            </div>
            <h2 className="font-sf-headline text-2xl sm:text-3xl lg:text-4xl text-sf-on-surface font-black tracking-tight leading-snug">
              Are you a restaurant owner? Partner with us.
            </h2>
            <p className="font-sf-body text-sm sm:text-base text-sf-text-body mt-3 leading-relaxed">
              List your real menu, manage live availability, and reach customers directly -- no
              fake listings, no middleman pricing.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="w-full sm:w-auto rounded-xl bg-sf-primary hover:bg-sf-secondary text-sf-on-primary px-8 py-3.5 font-sf-body text-sm sm:text-base font-bold text-center shadow-md hover:shadow-lg transition-all cursor-pointer disabled:cursor-default"
              disabled={submitted}
            >
              {submitted ? "Application Submitted ✓" : "Join as a Restaurant Partner"}
            </button>
            <span className="w-full sm:w-auto rounded-xl bg-sf-surface text-sf-on-surface px-6 py-3.5 font-sf-body text-sm sm:text-base font-semibold text-center shadow-sm border border-sf-border-divider cursor-default">
              Enterprise demos coming soon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
