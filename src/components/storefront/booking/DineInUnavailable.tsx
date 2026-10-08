"use client";

// Ported from dine-client's components/booking/DineInUnavailable.tsx. `selectedOutlet` is now a
// prop; the "Change Outlet" button opened an AppContext-owned modal dine-connect has no
// equivalent of, so it's now a plain Link back to the restaurant marketplace home instead.
import React from 'react';
import Link from 'next/link';
import type { MOCK_OUTLET } from './bookingData';

interface DineInUnavailableProps {
  outlet: typeof MOCK_OUTLET;
}

export function DineInUnavailable({ outlet }: DineInUnavailableProps) {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-20 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-full bg-sf-primary-light flex items-center justify-center text-sf-primary mb-5">
        <span className="material-symbols-outlined text-4xl">table_restaurant</span>
      </div>
      <h2 className="font-sf-headline text-2xl font-bold text-sf-on-surface">
        Table booking isn&apos;t available here
      </h2>
      <p className="font-sf-body text-sm text-sf-text-muted mt-2 max-w-md">
        {outlet.brand} {outlet.branch} only offers {outlet.services.join(' and ').toLowerCase()}.
        Pick another outlet to reserve a table, or order from this one.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/order"
          className="h-11 px-6 rounded-xl bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-bold shadow-md transition-colors flex items-center justify-center"
        >
          Change Outlet
        </Link>
        <Link
          href={`/order/${outlet.id}`}
          className="h-11 px-6 rounded-xl bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface font-sf-body text-sm font-bold flex items-center justify-center transition-colors"
        >
          Order from {outlet.branch}
        </Link>
      </div>
    </div>
  );
}
