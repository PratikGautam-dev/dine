// The numbered card shell every checkout section sits in -- ported from dine-client's
// checkout/CheckoutSection.tsx (step badge + headline/subtitle + body), re-skinned onto `sf-`
// tokens for this mobile-first cart page.
import type { ReactNode } from "react";

type Props = {
  step: number;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function CheckoutSection({ step, title, subtitle, action, children }: Props) {
  return (
    <section className="mb-4 rounded-2xl border border-sf-border-divider/60 bg-sf-surface p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sf-primary-light font-sf-body text-sm font-bold text-sf-primary">
            {step}
          </span>
          <div>
            <h2 className="font-sf-headline text-base font-bold leading-tight text-sf-on-surface sm:text-lg">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 font-sf-body text-xs text-sf-text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
