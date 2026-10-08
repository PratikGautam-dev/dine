import React from 'react';

// Ported from dine-client's components/checkout/CheckoutSection.tsx. Renamed (not a ported
// "booking/*" file by itself) because that checkout flow isn't ported into dine-connect -- this is
// only the numbered-step card shell the 4 booking sections below share, re-skinned with sf- tokens.
interface BookingSectionProps {
  id: string;
  step: number;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function BookingSection({ id, step, title, subtitle, action, children }: BookingSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-[136px] bg-sf-surface rounded-2xl p-5 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-sf-border-divider/60"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-sf-primary-light text-sf-primary flex items-center justify-center font-sf-body text-sm font-bold shrink-0">
            {step}
          </span>
          <div>
            <h2 className="font-sf-headline text-xl sm:text-2xl font-semibold text-sf-on-surface leading-tight">
              {title}
            </h2>
            <p className="font-sf-body text-xs text-sf-text-muted mt-0.5">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
