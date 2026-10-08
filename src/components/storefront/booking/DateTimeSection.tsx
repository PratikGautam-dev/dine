"use client";

// Ported from dine-client's components/booking/DateTimeSection.tsx -- props and logic unchanged,
// classes re-skinned with sf- tokens, CheckoutSection -> local BookingSection.
import React, { useState } from 'react';
import { cn } from '@/lib/cn';
import {
  DINNER_SLOTS,
  GRACE_HOLD_MINUTES,
  LUNCH_SLOTS,
  MAX_ADVANCE_DAYS,
  fromDayKey,
  toDayKey,
  type BookingDay,
  type SlotState,
  type TimeSlot,
} from './bookingData';
import { BookingSection } from './BookingSection';

interface DateTimeSectionProps {
  /** Null until the client clock is available, so server markup never depends on the date */
  days: BookingDay[] | null;
  /** Chip for a date picked through "Custom", when it is not one of the quick days */
  customDay: BookingDay | null;
  todayKey: string | null;
  activeDayKey: string | null;
  onSelectDay: (key: string) => void;
  slotState: (slot: TimeSlot) => SlotState;
  selectedSlotId: string | null;
  onSelectSlot: (id: string) => void;
}

function SlotGrid({
  slots,
  slotState,
  selectedSlotId,
  onSelectSlot,
  columns,
  pending,
}: {
  pending: boolean;
  slots: TimeSlot[];
  slotState: (slot: TimeSlot) => SlotState;
  selectedSlotId: string | null;
  onSelectSlot: (id: string) => void;
  columns: string;
}) {
  return (
    <div role="radiogroup" className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2', columns)}>
      {slots.map((slot) => {
        const state = pending ? { tablesLeft: 0, bookable: false } : slotState(slot);
        const selected = slot.id === selectedSlotId;
        const fillingFast = state.bookable && state.tablesLeft <= 2;
        return (
          <button
            key={slot.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!state.bookable}
            onClick={() => onSelectSlot(slot.id)}
            className={cn(
              'py-2 px-1 rounded-lg text-center font-sf-body text-sm transition-all cursor-pointer disabled:cursor-not-allowed',
              selected
                ? 'bg-sf-primary text-sf-on-primary font-bold shadow-sm'
                : pending
                  ? 'bg-sf-surface-container-low text-sf-text-muted animate-pulse'
                  : state.bookable
                    ? 'bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface font-medium'
                    : 'bg-sf-surface-container-low text-sf-text-muted/70 line-through'
            )}
          >
            {slot.label}
            {selected ? (
              <span className="block text-[9px] text-sf-primary-light font-medium leading-none mt-0.5">Your Pick</span>
            ) : fillingFast ? (
              <span className="block text-[9px] text-sf-primary font-semibold leading-none mt-0.5">
                Filling Fast
              </span>
            ) : !pending && !state.bookable ? (
              <span className="block text-[9px] text-sf-text-muted no-underline leading-none mt-0.5">Unavailable</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function DateTimeSection({
  days,
  customDay,
  todayKey,
  activeDayKey,
  onSelectDay,
  slotState,
  selectedSlotId,
  onSelectSlot,
}: DateTimeSectionProps) {
  const [showPicker, setShowPicker] = useState(false);

  const chips = days ? (customDay ? [...days, customDay] : days) : [];
  const maxDate = todayKey
    ? (() => {
        const t = fromDayKey(todayKey);
        return toDayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() + MAX_ADVANCE_DAYS));
      })()
    : undefined;

  return (
    <BookingSection
      id="booking-step-2"
      step={2}
      title="Date & Dining Time Slot"
      subtitle="Choose your planned arrival window"
      action={
        <div className="flex items-center gap-1 font-sf-body text-xs text-sf-text-muted">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          <span>{GRACE_HOLD_MINUTES} min grace hold</span>
        </div>
      }
    >
      <div className="mb-6">
        <p className="font-sf-body text-sm font-semibold text-sf-on-surface mb-2">Select Day</p>
        <div role="radiogroup" aria-label="Day" className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {days === null
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="shrink-0 w-[118px] h-[58px] rounded-lg bg-sf-surface-container-low animate-pulse" />
              ))
            : chips.map((day) => {
                const selected = day.key === activeDayKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelectDay(day.key)}
                    className={cn(
                      'shrink-0 px-4 py-2.5 rounded-lg text-left transition-colors cursor-pointer',
                      selected
                        ? 'bg-sf-primary text-sf-on-primary shadow-sm'
                        : 'bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface'
                    )}
                  >
                    <span
                      className={cn(
                        'font-sf-body text-xs font-semibold block',
                        selected
                          ? 'opacity-90'
                          : day.tag === 'WEEKEND'
                            ? 'text-sf-rating-amber'
                            : 'text-sf-text-muted'
                      )}
                    >
                      {day.tag}
                    </span>
                    <span className="font-sf-body text-base font-bold block">{day.label}</span>
                  </button>
                );
              })}
          {days !== null && (
            <button
              type="button"
              aria-expanded={showPicker}
              onClick={() => setShowPicker((open) => !open)}
              className="shrink-0 px-4 py-2.5 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] text-sf-text-muted">calendar_month</span>
              <span className="font-sf-body text-sm font-semibold">Custom</span>
            </button>
          )}
        </div>
        {showPicker && todayKey && (
          <input
            type="date"
            aria-label="Pick a custom date"
            min={todayKey}
            max={maxDate}
            value={activeDayKey ?? ''}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDay(e.target.value);
                setShowPicker(false);
              }
            }}
            className="mt-2 h-11 px-4 bg-sf-surface-container-low rounded-lg font-sf-body text-sm text-sf-on-surface focus:outline-none focus:ring-2 focus:ring-sf-primary"
          />
        )}
      </div>

      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-sf-body text-sm font-semibold text-sf-on-surface">
              <span className="material-symbols-outlined text-sf-primary text-[18px]">dinner_dining</span>
              Dinner Slots (High Demand)
            </div>
            <span className="font-sf-body text-xs text-sf-primary font-medium">Evening Seating</span>
          </div>
          <SlotGrid
            slots={DINNER_SLOTS}
            slotState={slotState}
            selectedSlotId={selectedSlotId}
            onSelectSlot={onSelectSlot}
            columns="md:grid-cols-6"
            pending={days === null}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-sf-body text-sm font-semibold text-sf-on-surface">
              <span className="material-symbols-outlined text-sf-rating-amber text-[18px]">lunch_dining</span>
              Lunch Slots
            </div>
            <span className="font-sf-body text-xs text-sf-text-muted">Daylight Seating</span>
          </div>
          <SlotGrid
            slots={LUNCH_SLOTS}
            slotState={slotState}
            selectedSlotId={selectedSlotId}
            onSelectSlot={onSelectSlot}
            columns="md:grid-cols-5"
            pending={days === null}
          />
        </div>
      </div>
    </BookingSection>
  );
}
