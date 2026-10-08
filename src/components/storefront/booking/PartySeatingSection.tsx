"use client";

// Ported from dine-client's components/booking/PartySeatingSection.tsx -- props and logic
// unchanged, classes re-skinned with sf- tokens, CheckoutSection -> local BookingSection.
import React from 'react';
import { cn } from '@/lib/cn';
import { PARTY_OPTIONS, SEATING_AREAS, isAreaSuitable } from './bookingData';
import { BookingSection } from './BookingSection';

interface PartySeatingSectionProps {
  partyId: string;
  onPartyChange: (id: string) => void;
  areaId: string;
  onAreaChange: (id: string) => void;
}

export function PartySeatingSection({ partyId, onPartyChange, areaId, onAreaChange }: PartySeatingSectionProps) {
  const party = PARTY_OPTIONS.find((p) => p.id === partyId) ?? PARTY_OPTIONS[1];

  return (
    <BookingSection
      id="booking-step-1"
      step={1}
      title="Guests & Seating Preference"
      subtitle="Select party size and experience space"
      action={
        <span className="font-sf-body text-xs text-sf-veg-green font-semibold bg-sf-surface-container-low px-2 py-1 rounded">
          No Cover Charge
        </span>
      }
    >
      <div className="mb-6">
        <p className="font-sf-body text-sm font-semibold text-sf-on-surface mb-2">Party Size</p>
        <div role="radiogroup" aria-label="Party size" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {PARTY_OPTIONS.map((option) => {
            const selected = option.id === partyId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPartyChange(option.id)}
                className={cn(
                  'flex flex-col items-center justify-center py-3 px-2 rounded-lg text-center transition-all cursor-pointer',
                  selected
                    ? 'bg-sf-primary-light text-sf-primary ring-2 ring-sf-primary'
                    : 'bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface'
                )}
              >
                <span className="font-sf-body text-sm font-bold">{option.label}</span>
                <span
                  className={cn(
                    'font-sf-body text-[11px]',
                    selected ? 'text-sf-primary font-semibold' : 'text-sf-text-muted'
                  )}
                >
                  {option.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-sf-body text-sm font-semibold text-sf-on-surface mb-2">Preferred Seating Area</p>
        <div role="radiogroup" aria-label="Seating area" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SEATING_AREAS.map((area) => {
            const selected = area.id === areaId;
            const suitable = isAreaSuitable(area, party);
            return (
              <button
                key={area.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!suitable}
                onClick={() => onAreaChange(area.id)}
                className={cn(
                  'relative rounded-xl p-3.5 text-left transition-all flex gap-3 items-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'bg-sf-primary-light ring-2 ring-sf-primary'
                    : 'bg-sf-surface-container-low enabled:hover:bg-sf-surface-container'
                )}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-sf-surface-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="w-full h-full object-cover" alt={area.name} src={area.image} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={cn(
                        'font-sf-body text-sm font-bold truncate',
                        selected ? 'text-sf-primary' : 'text-sf-on-surface'
                      )}
                    >
                      {area.name}
                    </h4>
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px] shrink-0',
                        selected ? 'text-sf-primary' : 'text-sf-text-muted'
                      )}
                    >
                      {selected ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>
                  <p className="font-sf-body text-xs text-sf-text-muted line-clamp-1">{area.description}</p>
                  <span
                    className={cn(
                      'inline-block mt-1 bg-sf-surface px-1.5 py-0.5 rounded font-sf-body text-[10px] font-semibold',
                      suitable ? area.tagTone : 'text-sf-text-muted'
                    )}
                  >
                    {suitable
                      ? area.tag
                      : `Seats ${area.minGuests === area.maxGuests ? area.minGuests : `${area.minGuests}-${area.maxGuests}`} guests`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BookingSection>
  );
}
