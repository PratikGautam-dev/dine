"use client";

// Ported from dine-client's components/booking/PreorderSection.tsx. dine-client read the shared
// AppContext cart here so a dine-in guest could pre-order dishes; this app's real cart
// (`useCart()` from `@/lib/cart`) is scoped to a single restaurant's menu, and this is a
// standalone /order/book-table route with no restaurant context, so there is nothing real to
// pre-order yet. Per the port's "no backend wiring" scope this always renders the original's
// empty-cart branch (hasItems === false) rather than reaching into `useCart()`.
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { BookingSection } from './BookingSection';
import type { MOCK_OUTLET } from './bookingData';

interface PreorderSectionProps {
  includePreorder: boolean;
  setIncludePreorder: (include: boolean) => void;
  outlet: typeof MOCK_OUTLET;
}

export function PreorderSection({ includePreorder, setIncludePreorder, outlet }: PreorderSectionProps) {
  const hasItems = false;
  const active = includePreorder && hasItems;

  return (
    <BookingSection
      id="booking-step-4"
      step={4}
      title="Pre-order Dining (Optional)"
      subtitle="Dishes start cooking when you check in at the host counter"
      action={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full font-sf-body text-[10px] font-semibold',
              active ? 'bg-sf-veg-green text-sf-on-primary' : 'bg-sf-surface-container text-sf-text-muted'
            )}
          >
            Zero Table Wait
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Include pre-order with reservation"
            disabled={!hasItems}
            onClick={() => setIncludePreorder(!includePreorder)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-sf-veg-green' : 'bg-sf-switch-off'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-sf-surface shadow transition-transform',
                active && 'translate-x-5'
              )}
            />
          </button>
        </div>
      }
    >
      <div className="mb-4 p-6 rounded-xl bg-sf-surface-container-low text-center">
        <span className="material-symbols-outlined text-sf-text-muted text-3xl">restaurant_menu</span>
        <p className="font-sf-body text-sm text-sf-text-body mt-1">No dishes pre-ordered yet.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <Link
          href={`/order/${outlet.id}`}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-primary font-sf-body text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Browse Full Menu to Pre-order
        </Link>
        <span className="font-sf-body text-xs text-sf-text-muted">You can also order directly at your table on arrival.</span>
      </div>
    </BookingSection>
  );
}
