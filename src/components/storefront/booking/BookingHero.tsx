"use client";

// Ported from dine-client's components/booking/BookingHero.tsx. `useApp()`'s `selectedOutlet` is
// now a prop (see bookingData.ts's MOCK_OUTLET -- there is no real selected-outlet concept on this
// standalone /order/book-table route), and `showToast` is replaced with this app's real toast.
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/cn';
import type { MOCK_OUTLET } from './bookingData';

interface BookingHeroProps {
  outlet: typeof MOCK_OUTLET;
}

export function BookingHero({ outlet }: BookingHeroProps) {
  const [isSaved, setIsSaved] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Booking link copied to clipboard');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const tabs = [
    {
      label: 'Delivery',
      detail: `(${outlet.eta})`,
      icon: 'moped',
      href: `/order/${outlet.id}`,
      active: false,
    },
    {
      label: 'Pickup / Takeaway',
      detail: '',
      icon: 'takeout_dining',
      href: `/order/${outlet.id}`,
      active: false,
    },
    {
      label: 'Dine-in / Book a Table',
      detail: '',
      icon: 'table_restaurant',
      href: '/order/book-table',
      active: true,
    },
  ];

  return (
    <section className="bg-sf-surface shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
        {/* Breadcrumb & badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <nav className="flex items-center gap-1 font-sf-body text-xs text-sf-text-muted">
            <Link href="/order" className="hover:text-sf-primary transition-colors">
              Home
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Bengaluru Outlets</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-sf-on-surface font-medium">
              {outlet.brand} {outlet.branch}
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 bg-sf-surface-container-low px-2.5 py-1 rounded-full font-sf-body text-xs text-sf-on-surface">
              <span
                className="material-symbols-outlined text-sf-rating-amber text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <strong>{outlet.rating}</strong>
              <span className="text-sf-text-muted">({outlet.reviewsCount} reviews)</span>
            </span>
            <span className="flex items-center gap-1 bg-sf-primary-light text-sf-primary px-2.5 py-1 rounded-full font-sf-body text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              {outlet.cuisine}
            </span>
            <span className="flex items-center gap-1 bg-sf-surface-container-low text-sf-veg-green px-2.5 py-1 rounded-full font-sf-body text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              FSSAI Hygiene A+
            </span>
          </div>
        </div>

        {/* Outlet strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 pb-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm shrink-0 bg-sf-surface-container-low">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover"
                alt={`${outlet.brand} dining room`}
                src={outlet.image}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-sf-headline text-2xl font-semibold text-sf-on-surface tracking-tight">
                  {outlet.brand}
                </h1>
                <span className="text-sf-text-muted">•</span>
                <span className="font-sf-body text-lg text-sf-on-surface-variant font-medium">{outlet.branch}</span>
                <span className="bg-sf-surface-container-high px-2 py-0.5 rounded font-sf-body text-xs font-semibold text-sf-on-surface">
                  Flagship Trattoria
                </span>
              </div>
              <p className="font-sf-body text-xs text-sf-text-muted flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[16px]">distance</span>
                {outlet.address} • Open till 11:30 PM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container font-sf-body text-sm font-medium text-sf-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              Share
            </button>
            <button
              type="button"
              aria-pressed={isSaved}
              onClick={() => {
                setIsSaved(!isSaved);
                toast.success(!isSaved ? `Bookmarked ${outlet.brand}` : 'Bookmark removed');
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg font-sf-body text-sm font-medium transition-colors cursor-pointer',
                isSaved ? 'bg-sf-primary-light text-sf-primary' : 'bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface'
              )}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmark
              </span>
              {isSaved ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
        </div>

        {/* Service tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={cn(
                'pb-3 font-sf-body text-sm flex items-center gap-1.5 shrink-0 transition-colors border-b-2',
                tab.active
                  ? 'text-sf-primary font-semibold border-sf-primary'
                  : 'text-sf-text-muted hover:text-sf-on-surface font-medium border-transparent'
              )}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
              {tab.detail && <span className="text-xs font-normal">{tab.detail}</span>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
