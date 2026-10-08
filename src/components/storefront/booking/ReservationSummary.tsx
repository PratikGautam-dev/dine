"use client";

// Ported from dine-client's components/booking/ReservationSummary.tsx -- `selectedOutlet` is now
// a prop (see bookingData.ts's MOCK_OUTLET), everything else unchanged.
import React from 'react';
import { AMBIENCE_IMAGES, GRACE_HOLD_MINUTES } from './bookingData';
import type { MOCK_OUTLET } from './bookingData';

interface ReservationSummaryProps {
  outlet: typeof MOCK_OUTLET;
  dateSummary: string | null;
  meal: string | null;
  slotLabel: string | null;
  guestsLabel: string;
  areaName: string;
  occasion: string;
  preorderCount: number;
  preorderTotal: number;
  canConfirm: boolean;
  isConfirming: boolean;
  blockedHint: string | null;
  onConfirm: () => void;
}

export function ReservationSummary({
  outlet,
  dateSummary,
  meal,
  slotLabel,
  guestsLabel,
  areaName,
  occasion,
  preorderCount,
  preorderTotal,
  canConfirm,
  isConfirming,
  blockedHint,
  onConfirm,
}: ReservationSummaryProps) {
  const rows = [
    {
      icon: 'event',
      label: 'Date & Meal',
      value: dateSummary ? `${dateSummary}${meal ? ` • ${meal}` : ''}` : '—',
      emphasis: false,
    },
    {
      icon: 'alarm',
      label: 'Reserved Slot',
      value: slotLabel ? `${slotLabel} (${GRACE_HOLD_MINUTES}m hold)` : 'Not selected',
      emphasis: true,
    },
    { icon: 'group', label: 'Party & Area', value: `${guestsLabel} • ${areaName}`, emphasis: false },
    { icon: 'celebration', label: 'Occasion', value: occasion || 'None', emphasis: false },
    {
      icon: 'shopping_bag',
      label: 'Pre-ordered Items',
      value: preorderCount > 0 ? `${preorderCount} ${preorderCount === 1 ? 'item' : 'items'} (₹${preorderTotal})` : 'None',
      emphasis: false,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-sf-surface rounded-2xl p-5 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-sf-border-divider/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-sf-body text-[11px] text-sf-primary uppercase font-bold tracking-wider">
              Reservation Summary
            </span>
            <h3 className="font-sf-body text-lg text-sf-on-surface font-bold mt-0.5 truncate">
              {outlet.brand} {outlet.branch}
            </h3>
          </div>
          <span className="w-10 h-10 rounded-full bg-sf-primary-light text-sf-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">restaurant</span>
          </span>
        </div>

        <dl className="py-4 space-y-2.5 font-sf-body text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="flex items-center gap-2 text-sf-text-muted shrink-0">
                <span className="material-symbols-outlined text-[18px]">{row.icon}</span>
                {row.label}
              </dt>
              <dd
                className={
                  row.emphasis && slotLabel
                    ? 'font-bold text-sf-primary text-right'
                    : 'font-semibold text-sf-on-surface text-right'
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="p-3 rounded-xl bg-gradient-to-r from-sf-surface-container-low via-sf-primary-light/40 to-sf-surface-container-low mb-4">
          <div className="flex items-start gap-2.5">
            <span
              className="material-symbols-outlined text-sf-rating-amber text-[20px] shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              workspace_premium
            </span>
            <div>
              <p className="font-sf-body text-xs text-sf-on-surface font-bold">Daap Gourmet Gold Perk Unlocked</p>
              <p className="font-sf-body text-xs text-sf-text-body leading-tight mt-0.5">
                Complimentary Chef&apos;s Bruschetta on arrival + priority valet parking at the outlet.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-sf-surface-container-low p-3 rounded-lg mb-5 space-y-1">
          <div className="flex items-center gap-1.5 text-sf-veg-green font-sf-body text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Zero Reservation Deposit • Free Cancellation
          </div>
          <p className="font-sf-body text-[11px] text-sf-text-muted leading-tight">
            Table held for {GRACE_HOLD_MINUTES} minutes past reserved time. Pre-ordered food is billed only at the
            restaurant checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isConfirming}
          className="w-full h-12 bg-sf-primary hover:bg-sf-secondary text-sf-on-primary rounded-xl font-sf-body text-base font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>{isConfirming ? 'Securing your table...' : 'Confirm Table Reservation'}</span>
          <span className="material-symbols-outlined text-[20px]">
            {isConfirming ? 'hourglass_top' : 'arrow_forward'}
          </span>
        </button>
        {blockedHint && !isConfirming && (
          <p className="mt-2 text-center font-sf-body text-xs text-sf-primary font-medium">{blockedHint}</p>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sf-text-muted font-sf-body text-xs">
            <span className="material-symbols-outlined text-sf-veg-green text-[18px]">mark_chat_read</span>
            Instant SMS, WhatsApp &amp; email passes with directions
          </div>
          <div className="flex items-center gap-2 text-sf-text-muted font-sf-body text-xs">
            <span className="material-symbols-outlined text-sf-primary text-[18px]">qr_code_2</span>
            Direct check-in pass for seamless host arrival
          </div>
        </div>
      </div>

      <div className="bg-sf-surface rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-sf-border-divider/60">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-sf-body text-base text-sf-on-surface font-bold">Ambience &amp; Location</h4>
          <span className="font-sf-body text-xs text-sf-text-muted">{outlet.branch}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {AMBIENCE_IMAGES.map((item) => (
            <div key={item.label} className="h-28 rounded-lg overflow-hidden relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                alt={item.label}
                src={item.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sf-inverse-surface/80 via-transparent to-transparent flex items-end p-2">
                <span className="font-sf-body text-[11px] text-sf-on-primary font-semibold">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-sf-surface-container-low rounded-lg p-2.5 flex items-center justify-between gap-2 text-sf-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sf-primary text-[20px]">local_parking</span>
            <div className="leading-tight">
              <span className="font-sf-body text-xs font-semibold block">Complimentary Valet</span>
              <span className="font-sf-body text-[11px] text-sf-text-muted">Available at main entrance</span>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${outlet.brand} ${outlet.address}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sf-body text-xs text-sf-primary font-semibold hover:underline shrink-0"
          >
            Get Directions
          </a>
        </div>
      </div>
    </div>
  );
}
