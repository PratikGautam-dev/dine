"use client";

// Ported from dine-client's components/how-it-works/HowItWorks.tsx -- fully decorative, no real
// data involved, ported as-is with sf- token renaming only.

const STEPS = [
  {
    step: "Step 01",
    icon: "dinner_dining",
    title: "Pick Your Favorite Restaurant",
    desc: "Browse real restaurants with live menus, honest ratings, and current open/closed status.",
  },
  {
    step: "Step 02",
    icon: "pin_drop",
    title: "Pick Your Branch",
    desc: "For restaurants with more than one location, choose the branch that's right for you before you order.",
  },
  {
    step: "Step 03",
    icon: "bolt",
    title: "Order Straight to the Kitchen",
    desc: "Your order goes directly to that restaurant's kitchen -- no middleman menu, no stale pricing.",
  },
];

export function HowItWorks() {
  return (
    <section className="w-full bg-sf-bg-page py-12 sm:py-16 px-4 sm:px-8 border-b border-sf-border-divider/40">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="font-sf-body text-xs text-sf-primary uppercase font-bold tracking-wider">
            Zero Guesswork
          </span>
          <h2 className="font-sf-headline text-2xl sm:text-3xl text-sf-on-surface font-bold mt-1">
            How Ordering Works
          </h2>
          <p className="font-sf-body text-sm text-sf-text-muted mt-2">
            Daap Dine connects your cravings directly with real restaurant kitchens -- no fake
            listings, no middlemen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-sf-primary-soft via-sf-primary to-sf-primary-soft -translate-y-12 z-0 opacity-40" />

          {STEPS.map((item) => (
            <div
              key={item.step}
              className="relative z-10 rounded-2xl bg-sf-surface p-6 sm:p-8 shadow-sm hover:shadow-lg transition-all duration-300 text-center flex flex-col items-center border border-sf-border-divider/60"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sf-primary-light text-sf-primary mb-4 shadow-sm">
                <span className="material-symbols-outlined text-[32px]">{item.icon}</span>
              </div>
              <span className="rounded-full bg-sf-surface-container-low px-3 py-0.5 font-sf-body text-xs text-sf-primary font-bold mb-2">
                {item.step}
              </span>
              <h3 className="font-sf-headline text-lg text-sf-on-surface font-bold">{item.title}</h3>
              <p className="font-sf-body text-sm text-sf-text-muted mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
